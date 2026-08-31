export type RestaurantProblemType = "duplicate" | "parse-error";

export interface RestaurantProblem {
	type: RestaurantProblemType;
	placeIds: string[];
	placeNames: string[];
	reason: string;
	notionUrls?: string[];
}
