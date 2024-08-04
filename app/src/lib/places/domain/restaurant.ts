export interface Restaurant {
    name: string;
	mapsUrl: string;
	visited: boolean;
	rating: string;
	dishPrice: string;
	ambience: { tag: string; color: string }[];
	tags: { tag: string; color: string }[];
	textValues: { label: string; value: string }[];
	metadata: RestaurantMetadata;
}

export interface RestaurantMetadata {
	coordinates: { 
		latitude: number; 
		longitude: number;
	};
}