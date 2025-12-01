import { parse } from "node-html-parser";
import {
    RepoRestaurant,
    RepoRestaurantMetadata,
    RestaurantsRepository,
} from "../interface";
import NotionAPIClient from "../../../client/notion/client";
import {getCoordinatesFromMapsUrl} from "../../../util/coordinates";

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

        const coordinatePromises: Promise<{
            index: number;
            latitude: number;
            longitude: number;
        }>[] = [];
        for (let i = 0; i < restaurants.length; i++) {
            if (restaurants[i].hasFaultyMetadata) {
                coordinatePromises.push(
                    getCoordinatesFromMapsUrl(i, restaurants[i].mapsUrl)
                );
            }
        }

        const rowMetadataUpdatePromises: Promise<void>[] = [];

        await Promise.all(coordinatePromises).then((coordinates) => {
            coordinates.forEach((c) => {
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
                "Finished updating %d coordinates",
                coordinatePromises.length
            );
        }

        return restaurants;
    }

    async editRating(
        placeID: string,
        propertyID: string,
        ratingID: string,
    ): Promise<void> {
        await NotionAPIClient.patchPlaceRating(
            process.env.RESTAURANTS_DATA_SOURCE_ID!,
            placeID,
            propertyID,
            ratingID,
        );
    }

    async getDatabaseSchema() {
        return await NotionAPIClient.getDatabaseSchema(
            process.env.RESTAURANTS_DATA_SOURCE_ID!
        );
    }
}
