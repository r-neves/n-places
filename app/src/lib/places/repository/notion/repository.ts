import {
    RepoNewRestaurant,
    RepoRestaurant,
    RepoRestaurantMetadata,
    RestaurantsRepository,
} from "../interface";
import NotionAPIClient from "../../../client/notion/client";
import {
    getCoordinatesFromMapsUrl,
    IndexedCoordinates,
} from "../../../util/coordinates";

export class NotionAPIRestaurantsRepository implements RestaurantsRepository {
    constructor() {}
    async getRestaurant(id: string): Promise<RepoRestaurant | null> {
        return await NotionAPIClient.getCachedPlace(
            process.env.RESTAURANTS_DATA_SOURCE_ID!,
            id
        );
    }

    async getDBLastUpdatedDate(): Promise<Date> {
        return await NotionAPIClient.getDBLastUpdatedDate(
            process.env.RESTAURANTS_DATA_SOURCE_ID!
        );
    }

    async getRestaurants(lastModifiedDate: Date): Promise<RepoRestaurant[]> {
        const restaurants: RepoRestaurant[] =
            await NotionAPIClient.getPlacesForDBAfterModifiedDate(
                process.env.RESTAURANTS_DATA_SOURCE_ID!,
                lastModifiedDate
            );

        const coordinatePromises: Promise<IndexedCoordinates | null>[] = [];
        for (let i = 0; i < restaurants.length; i++) {
            if (restaurants[i].hasFaultyMetadata) {
                coordinatePromises.push(
                    getCoordinatesFromMapsUrl(i, restaurants[i].mapsUrl)
                );
            }
        }

        const rowMetadataUpdatePromises: Promise<void>[] = [];

        await Promise.all(coordinatePromises).then((coordinates) => {
            // Links that could not be resolved come back as null and are simply skipped: they
            // keep hasFaultyMetadata and get retried on the next sync, rather than having
            // unusable coordinates written back to Notion.
            const resolved = coordinates.filter(
                (c): c is IndexedCoordinates => c !== null
            );

            resolved.forEach((c) => {
                const metadata: RepoRestaurantMetadata = {
                    coordinates: {
                        latitude: c.latitude,
                        longitude: c.longitude,
                    },
                };

                rowMetadataUpdatePromises.push(
                    NotionAPIClient.patchPlaceMetadata(
                        process.env.RESTAURANTS_DATA_SOURCE_ID!,
                        restaurants[c.index].id,
                        metadata
                    )
                );
                restaurants[c.index].metadata = metadata;
            });
        });

        await Promise.all(rowMetadataUpdatePromises);

        if (coordinatePromises.length > 0) {
            console.info(
                "Finished updating %d of %d coordinates",
                rowMetadataUpdatePromises.length,
                coordinatePromises.length
            );
        }

        return restaurants;
    }

    async getDatabaseSchema() {
        return await NotionAPIClient.getDatabaseSchema(
            process.env.RESTAURANTS_DATA_SOURCE_ID!
        );
    }

    async createRestaurant(place: RepoNewRestaurant): Promise<RepoRestaurant> {
        return await NotionAPIClient.createPlace(
            process.env.RESTAURANTS_DATA_SOURCE_ID!,
            place
        );
    }

    async updateRestaurant(
        id: string,
        place: RepoNewRestaurant
    ): Promise<RepoRestaurant> {
        return await NotionAPIClient.updatePlace(
            process.env.RESTAURANTS_DATA_SOURCE_ID!,
            id,
            place
        );
    }

    async findByMapsUrl(mapsUrl: string): Promise<RepoRestaurant | null> {
        return await NotionAPIClient.findCachedPlaceByMapsUrl(
            process.env.RESTAURANTS_DATA_SOURCE_ID!,
            mapsUrl
        );
    }

    async listRecommenders(): Promise<string[]> {
        return await NotionAPIClient.listCachedRecommenders(
            process.env.RESTAURANTS_DATA_SOURCE_ID!
        );
    }
}
