import {
    RepoDatabaseSchema,
    RepoNewRestaurant,
    RepoRestaurant,
    RepoRestaurantMetadata,
} from "../../places/repository/interface";
import VercelKVCache from "@/lib/cache/vercel-kv";
import { buildCreatePagePayload } from "./create-payload";
import { NotionAPIError, notionErrorFromResponse } from "./errors";
import { resolvePropertyNames } from "./property-map";

const NOTION_API_URL = "https://api.notion.com/v1";

interface POSTBody {
    filter?: {
        timestamp: string;
        last_edited_time: {
            after: string;
        };
    };
    start_cursor?: string;
}

interface CacheValue {
    restaurantMap: Object; // map converted to object to be json serializable
    lastUpdated: string;
}

export default class NotionAPIClient {
    static async getUserRole(
        databaseID: string,
        email: string
    ): Promise<string> {
        return getUserRole(databaseID, email);
    }

    static async getCachedPlace(
        databaseID: string,
        placeID: string
    ): Promise<RepoRestaurant | null> {
        const cachedValue: CacheValue | undefined = await VercelKVCache.get(
            databaseID
        );

        if (cachedValue !== undefined) {
            const restaurantMap = new Map(
                Object.entries(cachedValue.restaurantMap)
            );
            return restaurantMap.get(placeID);
        }

        return null;
    }

    // Read-only lookup used by the duplicate pre-check on create. Deliberately touches nothing
    // but the cache: calling getRestaurants for this would re-sync from Notion *and* rewrite the
    // cached lastUpdated, which would force a full refetch on every subsequent load.
    static async findCachedPlaceByMapsUrl(
        databaseID: string,
        mapsUrl: string
    ): Promise<RepoRestaurant | null> {
        const cachedValue: CacheValue | undefined = await VercelKVCache.get(
            databaseID
        );

        if (cachedValue === undefined || cachedValue === null) {
            return null;
        }

        const restaurants = Object.values(cachedValue.restaurantMap) as RepoRestaurant[];
        for (let i = 0; i < restaurants.length; i++) {
            if (restaurants[i] && restaurants[i].mapsUrl === mapsUrl) {
                return restaurants[i];
            }
        }

        return null;
    }

    static async getDBLastUpdatedDate(databaseID: string): Promise<Date> {
        return fetchDBLastUpdatedDate(databaseID);
    }

    static async getPlacesForDBAfterModifiedDate(
        databaseID: string,
        lastModifiedDate: Date
    ): Promise<RepoRestaurant[]> {
        return fetchPlacesFromNotion(databaseID, lastModifiedDate);
    }

    static async patchPlaceMetadata(
        databaseID: string,
        placeID: string,
        metadata: RepoRestaurantMetadata
    ): Promise<void> {
        return patchPlaceMetadata(databaseID, placeID, metadata);
    }

    static async patchPlaceRating(
        databaseID: string,
        placeID: string,
        propertyID: string,
        ratingID: string
    ): Promise<void> {
        await fetch(`${NOTION_API_URL}/pages/${placeID}`, {
            method: "PATCH",
            headers: {
                Authorization: `Bearer ${process.env.NOTION_API_KEY}`,
                "Notion-Version": `${process.env.NOTION_API_VERSION}`,
                "Content-type": "application/json",
            },
            body: JSON.stringify({
                properties: {
                    Rating: {
                        id: propertyID,
                        status: {
                            id: ratingID,
                        },
                    },
                },
            }),
        });
    }

    static async createPlace(
        databaseID: string,
        place: RepoNewRestaurant
    ): Promise<RepoRestaurant> {
        return createPlace(databaseID, place);
    }

    static async getDatabaseSchema(
        databaseID: string
    ): Promise<RepoDatabaseSchema> {
        return getDatabaseSchema(databaseID);
    }
}

async function getDatabaseSchema(
    databaseID: string
): Promise<RepoDatabaseSchema> {
    const request = new Request(`${NOTION_API_URL}/data_sources/${databaseID}`, {
        headers: {
            Authorization: `Bearer ${process.env.NOTION_API_KEY}`,
            "Notion-Version": `${process.env.NOTION_API_VERSION}`,
            "Content-Type": "application/json",
        },
    });

    const response = await fetch(request);

    // Unlike the other readers in this file, this one surfaces the failure: the create path
    // depends on the schema to resolve property names and to validate option values, so a
    // silently empty schema would turn into a confusing Notion validation error later.
    if (!response.ok) {
        throw await notionErrorFromResponse(response);
    }

    return await response.json();
}

async function getUserRole(databaseID: string, email: string): Promise<string> {
    if (email === "") {
        return "";
    }

    const request = new Request(
        `${NOTION_API_URL}/data_sources/${databaseID}/query`,
        {
            cache: "no-store",
            method: "POST",
            headers: {
                Authorization: `Bearer ${process.env.NOTION_API_KEY}`,
                "Notion-Version": `${process.env.NOTION_API_VERSION}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                filter: {
                    property: "email",
                    title: {
                        equals: email,
                    },
                },
            }),
        }
    );

    const res = await fetch(request);

    return res
        .json()
        .then((response) => {
            if (response.results.length === 0) {
                return "";
            }

            return response.results[0].properties.role.select.name;
        })
        .catch((error) => {
            console.error(error);
            return Response.error();
        });
}

async function fetchDBLastUpdatedDate(databaseID: string): Promise<Date> {
    const request = new Request(
        `${NOTION_API_URL}/data_sources/${databaseID}/query`,
        {
            cache: "no-store",
            method: "POST",
            headers: {
                Authorization: `Bearer ${process.env.NOTION_API_KEY}`,
                "Notion-Version": `${process.env.NOTION_API_VERSION}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                page_size: 1,
                sorts: [
                    {
                        timestamp: "last_edited_time",
                        direction: "descending",
                    },
                ],
            }),
        }
    );

    const res = await fetch(request);

    return res
        .json()
        .then((response) => {
            return response.results[0].last_edited_time;
        })
        .catch((error) => {
            console.error(error);
            return Response.error();
        });
}

async function fetchPlacesFromNotion(
    databaseID: string,
    lastModifiedDate: Date
): Promise<RepoRestaurant[]> {
    const cachedValue: CacheValue | undefined = await VercelKVCache.get(
        databaseID
    );

    if (cachedValue === null || cachedValue === undefined) {
        console.debug(
            "Cache not found for database %s, fetching all results",
            databaseID
        );
        const results = await fetchAllResults(databaseID);
        const restaurantMap = new Map();

        results.forEach((restaurant) => {
            restaurantMap.set(restaurant.id, restaurant);
        });

        const newCacheValue: CacheValue = {
            restaurantMap: Object.fromEntries(restaurantMap),
            lastUpdated: lastModifiedDate.toISOString(),
        };

        await VercelKVCache.set(databaseID, newCacheValue);

        return results;
    }

    if (cachedValue.lastUpdated === lastModifiedDate.toISOString()) {
        console.debug(
            "Cache found for database %s, returning cached results",
            databaseID
        );
        const restaurantMap = new Map(
            Object.entries(cachedValue.restaurantMap)
        );
        return Array.from(restaurantMap.values());
    }

    console.debug(
        "Cache found for database %s, but last updated date is different, fetching new results",
        databaseID
    );
    console.debug("Last updated date in cache: %s", cachedValue.lastUpdated);
    console.debug(
        "Last updated date in request: %s",
        lastModifiedDate.toISOString()
    );

    // Fetch only new entries not in the cache
    const newEntries = await fetchAllResults(
        databaseID,
        new Date(cachedValue.lastUpdated)
    );
    const restaurantMap = new Map(Object.entries(cachedValue.restaurantMap));

    newEntries.forEach((restaurant) => {
        restaurantMap.set(restaurant.id, restaurant);
    });

    cachedValue.lastUpdated = lastModifiedDate.toISOString();
    cachedValue.restaurantMap = Object.fromEntries(restaurantMap);

    await VercelKVCache.set(databaseID, cachedValue);

    return Array.from(restaurantMap.values());
}

async function patchPlaceMetadata(
    databaseID: string,
    placeID: string,
    metadata: RepoRestaurantMetadata
): Promise<void> {
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
                            },
                        },
                    ],
                },
            },
        }),
    });

    const cachedValue: CacheValue | undefined = await VercelKVCache.get(
        databaseID
    );

    if (cachedValue !== undefined && cachedValue !== null) {
        const restaurantMap = new Map(
            Object.entries(cachedValue.restaurantMap)
        );

        const restaurant = restaurantMap.get(placeID);
        if (restaurant !== undefined) {
            restaurant.metadata = metadata;
            await VercelKVCache.set(databaseID, cachedValue);
        }
    }
}

// Retried once, since both are transient by definition.
const RETRYABLE_NOTION_CODES = ["rate_limited", "conflict_error"];
const DEFAULT_RETRY_AFTER_MS = 1000;

async function createPlace(
    databaseID: string,
    place: RepoNewRestaurant
): Promise<RepoRestaurant> {
    // The live schema is read first so the write uses whatever casing the database actually
    // has ("Dish Price" vs "dish price"). Reads lowercase before comparing and so never had to
    // care; a write does. Creates are rare enough that the extra call costs nothing.
    const schema = await getDatabaseSchema(databaseID);
    const propertyNames = resolvePropertyNames(schema);

    if (propertyNames.name === undefined) {
        throw new NotionAPIError(
            500,
            "schema_error",
            "Could not find a title property in the Notion data source"
        );
    }

    const payload = buildCreatePagePayload(databaseID, place, propertyNames);
    const created = await postPageWithRetry(payload);
    const restaurant = jsonEntryToPlaceItem(created);

    await insertPlaceIntoCache(databaseID, restaurant);

    return restaurant;
}

async function postPageWithRetry(payload: object): Promise<any> {
    for (let attempt = 0; attempt < 2; attempt++) {
        const response = await fetch(`${NOTION_API_URL}/pages`, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${process.env.NOTION_API_KEY}`,
                "Notion-Version": `${process.env.NOTION_API_VERSION}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify(payload),
        });

        if (response.ok) {
            return await response.json();
        }

        const retryAfterHeader = response.headers.get("Retry-After");
        const error = await notionErrorFromResponse(response);

        const isLastAttempt = attempt === 1;
        if (isLastAttempt || RETRYABLE_NOTION_CODES.indexOf(error.code) === -1) {
            console.error(
                "Notion create failed: %s (%d) request_id=%s",
                error.code,
                error.status,
                error.requestId
            );
            throw error;
        }

        const retryAfterMs = retryAfterHeader
            ? parseFloat(retryAfterHeader) * 1000
            : DEFAULT_RETRY_AFTER_MS;

        console.warn(
            "Notion create failed with %s, retrying in %dms",
            error.code,
            retryAfterMs
        );

        await new Promise((resolve) =>
            setTimeout(resolve, Math.min(retryAfterMs, 10000))
        );
    }

    // Unreachable: the loop either returns or throws.
    throw new NotionAPIError(500, "unknown_error", "Notion create failed");
}

// Puts a freshly created place into the cache so it shows on the map immediately rather than
// after the next sync.
//
// Deliberately does NOT touch lastUpdated. fetchPlacesFromNotion short-circuits only when the
// cached timestamp matches, so leaving it alone means the next load still does its incremental
// fetch and re-reads this page — picking up whatever Notion normalised on its side. Advancing
// it would skip that resync.
async function insertPlaceIntoCache(
    databaseID: string,
    restaurant: RepoRestaurant
): Promise<void> {
    try {
        const cachedValue: CacheValue | undefined = await VercelKVCache.get(
            databaseID
        );

        if (cachedValue === undefined || cachedValue === null) {
            return;
        }

        const restaurantMap = new Map(Object.entries(cachedValue.restaurantMap));
        restaurantMap.set(restaurant.id, restaurant);

        // patchPlaceMetadata gets away without this because it mutates an object that is still
        // shared with cachedValue.restaurantMap. Adding a *new* key does not propagate that way,
        // so the map has to be serialised back explicitly.
        cachedValue.restaurantMap = Object.fromEntries(restaurantMap);

        await VercelKVCache.set(databaseID, cachedValue);
    } catch (e) {
        // The page is already in Notion; a cache miss just means it appears on the next sync.
        console.warn("Failed to insert new place into cache: %s", e);
    }
}

// fetchAllResults fetches all results from a Notion database, making multiple requests while the has_more field is true.
// If lastModifiedDate is provided, it will only fetch entries that were last edited after that date.
async function fetchAllResults(
    databaseID: string,
    lastModifiedDate?: Date
): Promise<RepoRestaurant[]> {
    let results: RepoRestaurant[] = [];
    let hasMore = true;
    let start_cursor: string | undefined = undefined;

    while (hasMore) {
        const req = buildDatabasePOSTRequest(
            databaseID,
            lastModifiedDate,
            start_cursor
        );

        const res: any = await fetch(req, { cache: "no-store" }).then(
            (response) => {
                console.debug(
                    "Notion API response status: %s",
                    response.status
                );

                return response.json();
            }
        );

        res.results.map((entry: any) => {
            results.push(jsonEntryToPlaceItem(entry));
        });

        console.debug(`Received response from Notion ${res.results.length}`);

        hasMore = res.has_more;
        start_cursor = res.next_cursor;
    }

    return results;
}

function buildDatabasePOSTRequest(
    databaseID: string,
    lastModifiedDate?: Date,
    start_cursor?: string
): Request {
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

    return new Request(`${NOTION_API_URL}/data_sources/${databaseID}/query`, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${process.env.NOTION_API_KEY}`,
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
    const locationLabel = "location";
    const recommenderLabel = "recommender";
    const descriptionLabel = "description";
    const reviewLabel = "review";

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
        location: "",
        recommender: "",
        description: "",
        review: "",
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
                    break;
                }

                const visitedValue =
                    entry.properties[key].status.name.toLocaleLowerCase();
                if (visitedValue === notVisitedValue) {
                    newPlace.visited = false;
                } else {
                    newPlace.visited = true;
                    newPlace.rating = visitedValue;
                }

                break;
            }
            case typeLabel: {
                const typeValue = entry.properties[key].multi_select;
                for (const tagItem of typeValue) {
                    newPlace.tags.push({
                        tag: tagItem.name,
                        color: tagItem.color,
                    });
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
                        newPlace.ambience.push({
                            tag: tagItem.name,
                            color: tagItem.color,
                        });
                    }
                }

                break;
            }
            case metadataLabel: {
                try {
                    newPlace.metadata = tryParseMetadataField(
                        entry.properties[key].rich_text
                    );
                } catch (e) {
                    newPlace.hasFaultyMetadata = true;
                }

                break;
            }
            case locationLabel: {
                if (
                    entry.properties[key].rich_text !== null &&
                    entry.properties[key].rich_text.length > 0
                ) {
                    newPlace.location =
                        entry.properties[key].rich_text[0].text.content;
                }

                break;
            }
            case recommenderLabel: {
                if (
                    entry.properties[key].rich_text !== null &&
                    entry.properties[key].rich_text.length > 0
                ) {
                    newPlace.recommender =
                        entry.properties[key].rich_text[0].text.content;
                }

                break;
            }
            case descriptionLabel: {
                if (
                    entry.properties[key].rich_text !== null &&
                    entry.properties[key].rich_text.length > 0
                ) {
                    newPlace.description =
                        entry.properties[key].rich_text[0].text.content;
                }

                break;
            }
            case reviewLabel: {
                if (
                    entry.properties[key].rich_text !== null &&
                    entry.properties[key].rich_text.length > 0
                ) {
                    newPlace.review =
                        entry.properties[key].rich_text[0].text.content;
                }

                break;
            }
            default: {
                console.error("Unknown notion property: %s", key);
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
            },
        };
    } catch (e) {
        throw new Error("Metadata field is not a valid JSON");
    }
}
