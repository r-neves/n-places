import { NotionAPIRestaurantsRepository } from "@/lib/places/repository/notion/repository";
import { RestaurantsImpl, RestaurantsService } from "@/lib/places/service";

export const dynamic = "force-dynamic";

export async function GET() {
    const repoImpl = new NotionAPIRestaurantsRepository();
    const restaurantService: RestaurantsService = new RestaurantsImpl(repoImpl);

    return await restaurantService
        .getDatabaseSchema()
        .then((schema) => Response.json(schema))
        .catch((error) => {
            console.error(error);
            return Response.error();
        });
}
