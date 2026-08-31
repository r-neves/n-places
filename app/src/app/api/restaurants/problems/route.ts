import { NotionAPIRestaurantsRepository } from "@/lib/places/repository/notion/repository";
import { RestaurantsImpl, RestaurantsService } from "@/lib/places/service";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
    const repoImpl = new NotionAPIRestaurantsRepository();
    const restaurantService: RestaurantsService = new RestaurantsImpl(repoImpl);

    return await restaurantService
        .getProblems()
        .then((problems) => {
            return NextResponse.json(problems);
        })
        .catch((error) => {
            console.error(error);
            return NextResponse.error();
        });
}
