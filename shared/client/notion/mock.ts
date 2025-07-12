import { UserRole } from "../../constants/enums";
import { RepoRestaurant, RepoRestaurantMetadata } from "../../places/repository/interface";

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
}