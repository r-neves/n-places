export interface Restaurant {
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
	metadata: RestaurantMetadata;
}

export interface RestaurantMetadata {
	coordinates: { 
		latitude: number; 
		longitude: number;
	};
}

export interface SchemaOption {
	id: string;
	color: string;
	name: string;
}

export interface DatabaseSchema {
	properties: {
		[key: string]: {
			id: string;
			type: string;
			name: string;
			// Notion returns these as arrays. `status` was previously typed as an object map,
			// but every consumer iterates them (schemaOptions maps over the list to build the
			// pickers), so an array is what it has always actually been.
			status?: {
				options?: SchemaOption[];
			};
			multi_select?: {
				options?: SchemaOption[];
			};
			select?: {
				options?: SchemaOption[];
			};
		};
	};
}

// The fields needed to create a place. Separate from Restaurant because a new page has no id
// yet, and because the select/multi-select values are plain option names on the way in.
export interface NewRestaurant {
	name: string;
	mapsUrl: string;
	location: string;
	rating: string;
	dishPrice: string;
	tags: string[];
	ambience: string[];
	recommender: string;
	description: string;
	review: string;
	metadata: RestaurantMetadata | null;
}