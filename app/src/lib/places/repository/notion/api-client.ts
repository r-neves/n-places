import NodeCache from "node-cache";
import { RepoRestaurant, RepoRestaurantMetadata } from "../interface";

const NOTION_API_URL = "https://api.notion.com/v1";

const cache = new NodeCache({ stdTTL: 60 * 60 * 24 * 7 }); // 1 week 

interface POSTBody{
    filter?: {
        timestamp: string;
        last_edited_time: {
            after: string;
        };
    };
    start_cursor?: string;
}

interface CacheValue {
    restaurants: Map<String, RepoRestaurant>;
    lastUpdated: Date;
}

export default class NotionAPIClient {
    static async fetchDBLastUpdatedDate(databaseID: string): Promise<Date> {
        return fetchDBLastUpdatedDate(databaseID);
    }

    static async fetchPlacesFromNotion(databaseID: string, lastModifiedDate: Date): Promise<RepoRestaurant[]> {
        return fetchPlacesFromNotion(databaseID, lastModifiedDate);
    }

    static async patchPlaceMetadata(databaseID: string, placeID: string, metadata: RepoRestaurantMetadata): Promise<void> {
        return patchPlaceMetadata(databaseID, placeID, metadata);
    }
}

async function fetchDBLastUpdatedDate(databaseID: string): Promise<Date> {
    const request = new Request(`${NOTION_API_URL}/databases/${databaseID}/query`, {
        cache: "no-store",
        method: "POST",
        headers: {
            "Authorization": `Bearer ${process.env.NOTION_API_KEY}`,
            "Notion-Version": `${process.env.NOTION_API_VERSION}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            page_size: 1,
            sorts: [
                {
                    timestamp: "last_edited_time",
                    direction: "descending"
                }
            ]
        }),
    });

    const res = await fetch(request);

    return res.json()
        .then((response) => {
            return response.results[0].last_edited_time;
        })
        .catch((error) => {
            console.error(error);
            return
        });
}

async function fetchPlacesFromNotion(databaseID: string, lastModifiedDate: Date): Promise<RepoRestaurant[]> {
    const cachedValue: CacheValue | undefined = cache.get(databaseID);
    
    if (cachedValue === undefined) {
        console.debug("Cache not found for database %s, fetching all results", databaseID);
        const results = await fetchAllResults(databaseID);

        const newCacheValue: CacheValue = {
            restaurants: new Map(),
            lastUpdated: lastModifiedDate,
        };

        results.forEach((restaurant) => {
            newCacheValue.restaurants.set(restaurant.id, restaurant);
        });

        cache.set(databaseID, newCacheValue);

        return results;
    }

    if (cachedValue.lastUpdated.toISOString() === lastModifiedDate.toISOString()) {
        console.debug("Cache found for database %s, returning cached results", databaseID);
        return Array.from(cachedValue.restaurants.values());
    }

    console.debug("Cache found for database %s, but last updated date is different, fetching new results", databaseID);
    console.debug("Last updated date in cache: %s", cachedValue.lastUpdated.toISOString());
    console.debug("Last updated date in request: %s", lastModifiedDate.toISOString());

    // Fetch only new entries not in the cache
    const newEntries = await fetchAllResults(databaseID, cachedValue.lastUpdated);

    newEntries.forEach((restaurant) => {
        cachedValue.restaurants.set(restaurant.id, restaurant);
    });
    cachedValue.lastUpdated = lastModifiedDate;

    cache.set(databaseID, cachedValue);

    return Array.from(cachedValue.restaurants.values());
}

async function patchPlaceMetadata(databaseID: string, placeID: string, metadata: RepoRestaurantMetadata): Promise<void> {
    const metadataString = JSON.stringify(metadata);

    await fetch(`${NOTION_API_URL}/pages/${placeID}`, {
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

    const cachedValue: CacheValue | undefined = cache.get(databaseID);

    if (cachedValue !== undefined) {
        const restaurant = cachedValue.restaurants.get(placeID);
        if (restaurant !== undefined) {
            restaurant.metadata = metadata;
            cache.set(databaseID, cachedValue);
        }
    }
}

// fetchAllResults fetches all results from a Notion database, making multiple requests while the has_more field is true.
// If lastModifiedDate is provided, it will only fetch entries that were last edited after that date.
async function fetchAllResults(databaseID: string, lastModifiedDate?: Date): Promise<RepoRestaurant[]> {
    let results: RepoRestaurant[] = [];
    let hasMore = true;
    let start_cursor: string | undefined = undefined;

    while(hasMore) {
        const req = buildDatabasePOSTRequest(databaseID, lastModifiedDate, start_cursor);

        const res: any = await fetch(req, {cache: "no-store"}).then((response) => { 
            console.debug("Notion API response status: %s", response.status);

            return response.json()
        });

        res.results.map((entry: any) => {
            results.push(jsonEntryToPlaceItem(entry));
        });

        console.debug(`Received response from Notion ${res.results.length}`);

        hasMore = res.has_more;
        start_cursor = res.next_cursor;
    }

    return results;
}

function buildDatabasePOSTRequest(databaseID: string, lastModifiedDate?: Date, start_cursor?: string): Request {
    let body: POSTBody | undefined = undefined;
    if (lastModifiedDate !== undefined || start_cursor !== undefined) {
        body = {};
    }

    if (lastModifiedDate !== undefined) {
        body!.filter = {
            timestamp: "last_edited_time",
            last_edited_time: {
                after: lastModifiedDate.toISOString(),
            },
        };
    }

    if (start_cursor !== undefined) {
        body!.start_cursor = start_cursor;
    }

    return new Request(`${NOTION_API_URL}/databases/${databaseID}/query`, {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${process.env.NOTION_API_KEY}`,
            "Notion-Version": `${process.env.NOTION_API_VERSION}`,
            "Content-Type": "application/json",
        },
        body: body === undefined ? undefined : JSON.stringify(body),
    });
}

function jsonEntryToPlaceItem(entry: any): RepoRestaurant {
    const nameLabel = "name";
    const mapLabel = "map";
    const visitedLabel = "rating";
    const typeLabel = "type";
    const priceLabel = "dish price";
    const ambienceLabel = "ambience";
    const metadataLabel = "metadata";

    const notVisitedValue = "not visited";

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
                    console.error("Name is null");
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
                    newPlace.metadata = tryParseMetadataField(entry.properties[key].rich_text);
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

function tryParseMetadataField(metadataField: any[]): RepoRestaurantMetadata {
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