export interface RepoRestaurant {
	id: string;
	name: string;
	mapsUrl: string;
	visited: boolean;
	rating: string;
	dishPrice: string;
	ambience: { tag: string; color: string }[];
	tags: { tag: string; color: string }[];
	textValues: { label: string; value: string }[];
	metadata: RepoRestaurantMetadata;
	hasFaultyMetadata: boolean;
}

export interface RepoRestaurantMetadata {
	coordinates: { latitude: number; longitude: number };
}

export interface RestaurantsRepository {
    getRestaurants(lastModifiedDate: Date): Promise<RepoRestaurant[]>;
    getDBLastUpdatedDate(): Promise<Date>;
}