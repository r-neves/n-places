import VercelKVCache from "../shared/cache/vercel-kv.ts";
import NotionAPIClient from "../shared/client/notion/client.ts";

console.log('Cache Hydration Job Started');

let dbsToHydrate = new Map<string, string>();
let lastUpdatedDates = new Map<string, Date>();

if (process.env.RESTAURANTS_DB_ID) {
    dbsToHydrate.set("restaurants", process.env.RESTAURANTS_DB_ID);
} else {
    console.error('RESTAURANTS_DB_ID is not defined in the environment variables');
}

while (true) {
    for (const [dbName, dbId] of dbsToHydrate.entries()) {
        console.log(`Hydrating cache for ${dbName} with ID ${dbId}`);
        const lastModifiedOnDB = await NotionAPIClient.getDBLastUpdatedDate(dbId);
        let lastUpdatedOnCache: Date | null | undefined = null;
        if (lastUpdatedDates.has(dbId)) {
            lastUpdatedOnCache = lastUpdatedDates.get(dbId);
        } else {
            VercelKVCache.get(dbId).then((value) => {
                if (value !== null) {
                    lastUpdatedOnCache = new Date(value.lastModified);
                }
            });
        }

        if (lastUpdatedOnCache && lastModifiedOnDB <= lastUpdatedOnCache) {
            console.log(`Cache for ${dbName} is up to date, skipping hydration`);
            continue;
        }

        let lastUpdatedOnCacheDate = lastUpdatedOnCache ? new Date(lastUpdatedOnCache) : new Date();
        console.log(`Last updated on cache for ${dbName}: ${lastUpdatedOnCacheDate}`);

        // The get will automatically update the cache
        NotionAPIClient.getPlacesForDBAfterModifiedDate(dbId, lastUpdatedOnCacheDate)

        lastUpdatedDates.set(dbId, lastModifiedOnDB);
    }

    break;
}