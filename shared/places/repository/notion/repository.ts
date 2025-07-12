import { parse } from "node-html-parser";
import {
    RepoRestaurant,
    RepoRestaurantMetadata,
    RestaurantsRepository,
} from "../interface";
import NotionAPIClient from "../../../client/notion/client";

export class NotionAPIRestaurantsRepository implements RestaurantsRepository {
    constructor() {}
    async getRestaurant(id: string): Promise<RepoRestaurant | null> {
        return await NotionAPIClient.getCachedPlace(
            process.env.RESTAURANTS_DB_ID!,
            id
        );
    }

    async getDBLastUpdatedDate(): Promise<Date> {
        return await NotionAPIClient.getDBLastUpdatedDate(
            process.env.RESTAURANTS_DB_ID!
        );
    }

    async getRestaurants(lastModifiedDate: Date): Promise<RepoRestaurant[]> {
        const restaurants: RepoRestaurant[] =
            await NotionAPIClient.getPlacesForDBAfterModifiedDate(
                process.env.RESTAURANTS_DB_ID!,
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
                    this.getCoordinatesFromMapsUrl(i, restaurants[i].mapsUrl)
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
                        process.env.RESTAURANTS_DB_ID!,
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

    async getCoordinatesFromMapsUrl(
        index: number,
        mapsUrl: string
    ): Promise<{ index: number; latitude: number; longitude: number }> {
        return await fetch(mapsUrl)
            .then((response) => response.text())
            .then((text) => {
                const doc = parse(text).toString();
                const mapsLinkIndex = doc.search(
                    "https://www.google.com/maps/place/"
                );
                const subString = doc.substring(mapsLinkIndex);
                const coordinatesBeginIndex = subString.indexOf("@") + 1;
                const includedCoordinates = subString
                    .substring(
                        coordinatesBeginIndex,
                        coordinatesBeginIndex + 30
                    )
                    .split(",");
                return {
                    index: index,
                    latitude: parseFloat(includedCoordinates[0]),
                    longitude: parseFloat(includedCoordinates[1]),
                };
            });
    }

    async editRating(
        placeID: string,
        propertyID: string,
        ratingID: string,
    ): Promise<void> {
        await NotionAPIClient.patchPlaceRating(
            process.env.RESTAURANTS_DB_ID!,
            placeID,
            propertyID,
            ratingID,
        );
    }

    async getDatabaseSchema() {
        return await NotionAPIClient.getDatabaseSchema(
            process.env.RESTAURANTS_DB_ID!
        );
    }
}
