import { UserRole } from "@/lib/constants/enums";
import { RepoNewRestaurant, RepoRestaurant, RepoRestaurantMetadata } from "../../places/repository/interface";

const mockRestaurants: RepoRestaurant[] = [
    {
        ambience: [
            {
                tag: "Modern",
                color: "purple",
            }
        ],
        description: "",
        review: "",
        dishPrice: "",
        id: "e0b6b3d6-8b16-4643-bb6c-0f73683d38a5",
        location: "Parque das Nações, Lisboa",
        name: "Xiaolongkan Hot Pot",
        mapsUrl: "https://maps.app.goo.gl/GPNU4Cid78suxXH28",
        recommender: "BJSS",
        tags: [
            {
                tag: "Asian",
                color: "grey"
            }
        ],
        visited: true,
        rating: "1/10",
        hasFaultyMetadata: false,
        metadata: {
            coordinates: {
                latitude: 38.773776659219195,
                longitude: -9.100364651707808,
            }
        }
    },
]

export default class NotionAPIClient {
    static async getUserRole(_databaseID: string, _email: string): Promise<string> {
        return UserRole.ADMIN;
    }

    static async fetchDBLastUpdatedDate(_databaseID: string): Promise<Date> {
        return new Date();
    }

    static async fetchPlacesFromNotion(_databaseID: string, _lastModifiedDate: Date): Promise<RepoRestaurant[]> {
        return mockRestaurants;
    }

    static async patchPlaceMetadata(_databaseID: string, _placeID: string, _metadata: RepoRestaurantMetadata): Promise<void> {
        // Do nothing
    }

    static async createPlace(_databaseID: string, place: RepoNewRestaurant): Promise<RepoRestaurant> {
        return {
            ...mockRestaurants[0],
            id: "00000000-0000-4000-8000-000000000001",
            name: place.name,
            mapsUrl: place.mapsUrl,
            location: place.location,
            rating: place.rating,
            visited: place.rating !== "" && place.rating.toLocaleLowerCase() !== "not visited",
            dishPrice: place.dishPrice,
            recommender: place.recommender,
            description: place.description,
            tags: place.tags.map((tag) => ({ tag: tag, color: "default" })),
            ambience: place.ambience.map((tag) => ({ tag: tag, color: "default" })),
            metadata: place.metadata ?? { coordinates: { latitude: 0, longitude: 0 } },
            hasFaultyMetadata: place.metadata === null,
        };
    }
}