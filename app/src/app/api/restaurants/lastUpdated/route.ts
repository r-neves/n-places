import { RestaurantsService, RestaurantsImpl } from "@/lib/places/service";
import { NotionAPIRestaurantsRepository } from "@/lib/places/repository/notion/repository";

export const dynamic = 'force-dynamic';

export async function GET() {
    const restaurantService: RestaurantsService = 
		new RestaurantsImpl(new NotionAPIRestaurantsRepository());

	const resp = await restaurantService.getDBLastUpdatedDate().then((resp) => {
        return Response.json(resp);
    }).catch((_) => {
        console.error("Failed to get last updated date");
        return Response.error();
    });

    return resp;
}