import { RestaurantsService, RestaurantsImpl } from "@/lib/places/service";
import { NotionAPIRestaurantsRepository } from "@/lib/places/repository/notion-api";

export const dynamic = 'force-dynamic';

export async function GET() {
    const restaurantService: RestaurantsService = 
		new RestaurantsImpl(new NotionAPIRestaurantsRepository());

	const resp = await restaurantService.getDBLastUpdatedDate().then((resp) => {
        console.log(resp);
        return Response.json(resp);
    }).catch((_) => {
        console.log("Failed to get last updated date");
        return Response.error();
    });

    return resp;
}