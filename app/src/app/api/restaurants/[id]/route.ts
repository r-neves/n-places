import { NotionAPIRestaurantsRepository } from "@/lib/places/repository/notion/repository";
import { RestaurantsImpl, RestaurantsService } from "@/lib/places/service";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(
    _: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const repoImpl = new NotionAPIRestaurantsRepository();
    const restaurantService: RestaurantsService = new RestaurantsImpl(repoImpl);

    return await restaurantService
        .getRestaurant((await params).id)
        .then((restaurant) => {
            return NextResponse.json(restaurant);
        })
        .catch((error) => {
            console.error(error);
            return Response.error();
        });
}
