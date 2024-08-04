import { RestaurantsService, RestaurantsImpl } from "@/lib/places/service";
import { NotionAPIRestaurantsRepository } from "@/lib/places/repository/notion-api";

const restaurantDatabaseID = "ae713d53768640058a236c4bd1691198";

export async function GET() {
    const restaurantService: RestaurantsService = 
		new RestaurantsImpl(new NotionAPIRestaurantsRepository(restaurantDatabaseID));

	const [date, restaurants] = await Promise.all([
		restaurantService.getDBLastUpdatedDate(restaurantDatabaseID),
		restaurantService.getRestaurants(restaurantDatabaseID),
	]);

    console.log("DB last updated date", date);

    return Response.json(restaurants);
}