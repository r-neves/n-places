import { RestaurantsService, RestaurantsImpl } from "@/lib/places/service";
import { NotionAPIRestaurantsRepository } from "@/lib/places/repository/notion-api";
import { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
	const repoImpl = new NotionAPIRestaurantsRepository();
    const restaurantService: RestaurantsService = new RestaurantsImpl(repoImpl);

	const restaurants = await restaurantService.getRestaurants().then((restaurants) => {
		return Response.json(restaurants);
	}).catch((error) => {
		console.log(error);
		return Response.error();
	});

	return restaurants;
}