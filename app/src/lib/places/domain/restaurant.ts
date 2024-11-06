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
	metadata: RestaurantMetadata;
}

export interface RestaurantMetadata {
	coordinates: { 
		latitude: number; 
		longitude: number;
	};
}