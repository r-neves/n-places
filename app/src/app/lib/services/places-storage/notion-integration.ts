import { parse } from "node-html-parser";
import { dummyData } from "./dummy-data";

const NOTION_API_URL = "https://api.notion.com/v1";

const nameLabel = "name";
const mapLabel = "map";
const visitedLabel = "rating";
const typeLabel = "type";
const priceLabel = "dish price";
const ambienceLabel = "ambience";

const notVisitedValue = "not visited";

export interface PlaceItem {
	name: string;
	mapsUrl: string;
	longitude: number;
	latitude: number;
	visited: boolean;
	rating: string;
	dishPrice: string;
	ambience: { tag: string; color: string }[];
	tags: { tag: string; color: string }[];
	textValues: { label: string; value: string }[];
}

export async function getDBLastUpdatedDate(databaseID: string): Promise<Date> {
	const res = await fetch(`${NOTION_API_URL}/databases/${databaseID}`, {
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

export async function getDBEntries(databaseID: string): Promise<PlaceItem[]> {
	const placeItems: PlaceItem[] = [];

	// const jsonResponse = JSON.parse(dummyData);
	// jsonResponse.results.map((entry: any) => {
	// 	placeItems.push(jsonEntryToPlaceItem(entry));
	// });

	let res = await fetch(`${NOTION_API_URL}/databases/${databaseID}/query`, {
		method: "POST",
		headers: {
			Authorization: `Bearer ${process.env.NOTION_API_KEY}`,
			"Notion-Version": `${process.env.NOTION_API_VERSION}`,
		},
	}).then((response) => response.json());

	console.log("Received response from Notion " + res.results.length);

	res.results.map((entry: any) => {
		placeItems.push(jsonEntryToPlaceItem(entry));
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

		console.log("Received response from Notion: " + res.results.length);

		res.results.map((entry: any) => {
			placeItems.push(jsonEntryToPlaceItem(entry));
		});
	}

	const coordinatePromises: Promise<{ latitude: number; longitude: number }>[] =
		[];
	for (let i = 0; i < placeItems.length; i++) {
		coordinatePromises.push(getCoordinatesFromMapsUrl(placeItems[i].mapsUrl));
	}

	await Promise.all(coordinatePromises).then((coordinates) => {
		for (let i = 0; i < placeItems.length; i++) {
			placeItems[i].latitude = coordinates[i].latitude;
			placeItems[i].longitude = coordinates[i].longitude;
		}
	});

	console.log("Finished getting coordinates");

	return placeItems;
}

function jsonEntryToPlaceItem(entry: any): PlaceItem {
	const newPlace: PlaceItem = {
		name: "",
		mapsUrl: "",
		visited: false,
		rating: "",
		longitude: 0,
		latitude: 0,
		dishPrice: "",
		ambience: [],
		tags: [],
		textValues: [],
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

async function getCoordinatesFromMapsUrl(
	mapsUrl: string,
): Promise<{ latitude: number; longitude: number }> {
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
				latitude: parseFloat(includedCoordinates[0]),
				longitude: parseFloat(includedCoordinates[1]),
			};
		});
}
