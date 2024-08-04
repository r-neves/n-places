import { parse } from "node-html-parser";
import { RepoRestaurant, RepoRestaurantMetadata, RestaurantsRepository } from "./interface";

const NOTION_API_URL = "https://api.notion.com/v1";

const nameLabel = "name";
const mapLabel = "map";
const visitedLabel = "rating";
const typeLabel = "type";
const priceLabel = "dish price";
const ambienceLabel = "ambience";
const metadataLabel = "metadata";

const notVisitedValue = "not visited";

export class NotionAPIRestaurantsRepository implements RestaurantsRepository {
	_databaseID: string;

	constructor(databaseID: string) {
		this._databaseID = databaseID;
	}

	async getDBLastUpdatedDate(): Promise<Date> {
		const res = await fetch(`${NOTION_API_URL}/databases/${this._databaseID}`, {
			method: "GET",
			headers: {
				Authorization: `Bearer ${process.env.NOTION_API_KEY}`,
				"Notion-Version": `${process.env.NOTION_API_VERSION}`,
			},
		});
	
		return res
			.json()
			.then((response) => {
				return new Date(response.last_edited_time);
			})
			.catch((error) => {
				console.log(error);
				return error;
			});
	}
	
	async getRestaurants(databaseID: string): Promise<RepoRestaurant[]> {
		const restaurants: RepoRestaurant[] = [];
	
		let res = await fetch(`${NOTION_API_URL}/databases/${databaseID}/query`, {
			method: "POST",
			headers: {
				Authorization: `Bearer ${process.env.NOTION_API_KEY}`,
				"Notion-Version": `${process.env.NOTION_API_VERSION}`,
			},
		}).then((response) => response.json());
	
		console.log(`Received response from Notion ${res.results.length}`);
	
		res.results.map((entry: any) => {
			restaurants.push(this.jsonEntryToPlaceItem(entry));
		});
	
		while (res.has_more) {
			res = await fetch(`${NOTION_API_URL}/databases/${databaseID}/query`, {
				method: "POST",
				headers: {
					Authorization: `Bearer ${process.env.NOTION_API_KEY}`,
					"Content-type": "application/json",
					"Notion-Version": `${process.env.NOTION_API_VERSION}`,
				},
				body: JSON.stringify({
					start_cursor: res.next_cursor,
				}),
			}).then((response) => response.json());
	
			console.log(`Received response from Notion ${res.results.length}`);
	
			res.results.map((entry: any) => {
				restaurants.push(this.jsonEntryToPlaceItem(entry));
			});
		}
	
		const coordinatePromises: Promise<{ index: number; latitude: number; longitude: number }>[] =
			[];
		for (let i = 0; i < restaurants.length; i++) {
			if (restaurants[i].hasFaultyMetadata) {
				coordinatePromises.push(this.getCoordinatesFromMapsUrl(i, restaurants[i].mapsUrl));
			}
		}

		const rowMetadataUpdatePromises: Promise<void>[] = [];
	
		await Promise.all(coordinatePromises).then((coordinates) => {
			coordinates.forEach(c => {
				const metadata: RepoRestaurantMetadata = {
					coordinates: {
						latitude: c.latitude,
						longitude: c.longitude,
					},
				};

				rowMetadataUpdatePromises.push(
					this.updateRowMetadata(restaurants[c.index].id, metadata)
				);
				restaurants[c.index].metadata = metadata;
			});
		});

		await Promise.all(rowMetadataUpdatePromises);
	
		console.log("Finished getting coordinates");
	
		return restaurants;
	}
	
	jsonEntryToPlaceItem(entry: any): RepoRestaurant {
		const newPlace: RepoRestaurant = {
			id: entry.id,
			name: "",
			mapsUrl: "",
			visited: false,
			rating: "",
			dishPrice: "",
			ambience: [],
			tags: [],
			textValues: [],
			metadata: { coordinates: { latitude: 0, longitude: 0 } },
			hasFaultyMetadata: false,
		};
	
		Object.keys(entry.properties).forEach((key, _) => {
			switch (key.toLocaleLowerCase()) {
				case nameLabel: {
					if (entry.properties[key].title[0] === undefined) {
						console.log("Name is null");
					}
	
					newPlace.name = entry.properties[key].title[0].text.content;
					break;
				}
				case mapLabel: {
					if (entry.properties[key].url !== null) {
						newPlace.mapsUrl = entry.properties[key].url;
					}
					
					break;
				}
				case visitedLabel: {
					if (entry.properties[key].status.name === null) {
						break
					}
	
					const visitedValue =
						entry.properties[key].status.name.toLocaleLowerCase();
					if (visitedValue === notVisitedValue) {
						newPlace.visited = false;
					} else {
						newPlace.visited = true;
						newPlace.rating = visitedValue
					}
	
					break;
				}
				case typeLabel: {
					const typeValue = entry.properties[key].multi_select;
					for (const tagItem of typeValue) {
						newPlace.tags.push({ tag: tagItem.name, color: tagItem.color });
					}
	
					break;
				}
				case priceLabel: {
					if (entry.properties[key].select !== null) {
						newPlace.dishPrice = entry.properties[key].select.name;
					}
	
					break;
				}
				case ambienceLabel: {
					if (entry.properties[key].multi_select !== null) {
						const ambienceValue = entry.properties[key].multi_select;
						for (const tagItem of ambienceValue) {
							newPlace.ambience.push({ tag: tagItem.name, color: tagItem.color });
						}
					}
	
					break;
				}
				case metadataLabel: {
					try {
						newPlace.metadata = this.tryParseMetadataField(entry.properties[key].rich_text);
					} catch (e) {
						newPlace.hasFaultyMetadata = true;
					}
					
					break;
				}
				default: {
					if (Object.keys(entry.properties[key].rich_text).length > 0) {
						newPlace.textValues.push({
							label: key,
							value: entry.properties[key].rich_text[0].text.content,
						});
					}
					break;
				}
			}
		});
	
		return newPlace;
	}
	
	async getCoordinatesFromMapsUrl(
		index: number,
		mapsUrl: string,
	): Promise<{ index: number; latitude: number; longitude: number }> {
		return await fetch(mapsUrl)
			.then((response) => response.text())
			.then((text) => {
				const doc = parse(text).toString();
				const mapsLinkIndex = doc.search("https://www.google.com/maps/place/");
				const subString = doc.substring(mapsLinkIndex);
				const coordinatesBeginIndex = subString.indexOf("@") + 1;
				const includedCoordinates = subString
					.substring(coordinatesBeginIndex, coordinatesBeginIndex + 30)
					.split(",");
				return {
					index: index,
					latitude: parseFloat(includedCoordinates[0]),
					longitude: parseFloat(includedCoordinates[1]),
				};
			});
	}
	
	tryParseMetadataField(metadataField: any[]): RepoRestaurantMetadata {
		if (Object.keys(metadataField).length <= 0) {
			throw new Error("Metadata field is empty");
		}

		try {
			const value: string = metadataField[0].text.content;
			const parsedMetadata = JSON.parse(value);

			return {
				coordinates: {
					latitude: parsedMetadata.coordinates.latitude,
					longitude: parsedMetadata.coordinates.longitude,
				}
			}
		} catch (e) {
			throw new Error("Metadata field is not a valid JSON");
		}
	}

	async updateRowMetadata(
		restaurantID: string,
		metadata: RepoRestaurantMetadata
	): Promise<void> {
		const metadataString = JSON.stringify(metadata);

		await fetch(`${NOTION_API_URL}/pages/${restaurantID}`, {
			method: "PATCH",
			headers: {
				Authorization: `Bearer ${process.env.NOTION_API_KEY}`,
				"Notion-Version": `${process.env.NOTION_API_VERSION}`,
				"Content-type": "application/json",
			},
			body: JSON.stringify({
				properties: {
					Metadata: {
						rich_text: [
							{
								type: "text",
								text: {
									content: metadataString,
								}
							}
						]
					},
				},
			}),
		});
	}
}