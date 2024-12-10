export interface RepoRestaurant {
	id: string;
	name: string;
	mapsUrl: string;
	visited: boolean;
	rating: string;
	dishPrice: string;
	ambience: { tag: string; color: string }[];
	tags: { tag: string; color: string }[];
	location: string;
	recommender: string;
	description: string;
	metadata: RepoRestaurantMetadata;
	hasFaultyMetadata: boolean;
}

export interface RepoRestaurantMetadata {
	coordinates: { latitude: number; longitude: number };
}

export interface RepoDatabaseSchema {
	properties: {
		[key: string]: {
			id: string;
			type: string;
			name: string;
			status?: {
				options?: {
					[key: string]: {
						id: string;
						color: string;
						name: string;
					};
				};
			};
		};
	};
}

export interface RestaurantsRepository {
	getRestaurant(id: string): Promise<RepoRestaurant | null>;
    getRestaurants(lastModifiedDate: Date): Promise<RepoRestaurant[]>;
    getDBLastUpdatedDate(): Promise<Date>;
	editRating(placeID: string, propertyID: string, ratingID: string): Promise<void>;
	getDatabaseSchema(): Promise<RepoDatabaseSchema>;
}