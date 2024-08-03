export interface RepoRestaurant {
	name: string;
	mapsUrl: string;
	longitude: number;
	latitude: number;
	visited: boolean;
	rating: string;
	dishPrice: string;
	ambience: { tag: string; color: string }[];
	tags: { tag: string; color: string }[];
	textValues: { label: string; value: string }[];
}

export interface RestaurantsRepository {
    getDBEntries(databaseID: string): Promise<RepoRestaurant[]>;
    getDBLastUpdatedDate(databaseID: string): Promise<Date>;
}