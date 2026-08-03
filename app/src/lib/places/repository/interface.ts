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
	review: string;
	metadata: RepoRestaurantMetadata;
	hasFaultyMetadata: boolean;
}

export interface RepoRestaurantMetadata {
	coordinates: { latitude: number; longitude: number };
}

export interface RepoSchemaOption {
	id: string;
	color: string;
	name: string;
}

export interface RepoDatabaseSchema {
	properties: {
		[key: string]: {
			id: string;
			type: string;
			name: string;
			// Notion returns these as arrays. `status` was previously typed as an object map,
			// but every consumer indexes it numerically (see editRating's options[0] and
			// options.slice(1, 6)), so an array is what it has always actually been.
			status?: {
				options?: RepoSchemaOption[];
			};
			multi_select?: {
				options?: RepoSchemaOption[];
			};
			select?: {
				options?: RepoSchemaOption[];
			};
		};
	};
}

// The fields needed to create a place. Separate from RepoRestaurant because a new page has no
// id yet, and because the select/multi-select values are plain option names on the way in —
// Notion assigns the colours.
export interface RepoNewRestaurant {
	name: string;
	mapsUrl: string;
	location: string;
	rating: string;
	dishPrice: string;
	tags: string[];
	ambience: string[];
	recommender: string;
	description: string;
	metadata: RepoRestaurantMetadata | null;
}

export interface RestaurantsRepository {
	getRestaurant(id: string): Promise<RepoRestaurant | null>;
    getRestaurants(lastModifiedDate: Date): Promise<RepoRestaurant[]>;
    getDBLastUpdatedDate(): Promise<Date>;
	editRating(placeID: string, propertyID: string, ratingID: string): Promise<void>;
	getDatabaseSchema(): Promise<RepoDatabaseSchema>;
	createRestaurant(place: RepoNewRestaurant): Promise<RepoRestaurant>;
	findByMapsUrl(mapsUrl: string): Promise<RepoRestaurant | null>;
}