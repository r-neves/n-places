import { NotionAPIRestaurantsRepository } from "@/lib/places/repository/notion/repository";
import { RestaurantsImpl, RestaurantsService } from "@/lib/places/service";
import { NextRequest, NextResponse } from "next/server";

export async function PATCH(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const repoImpl = new NotionAPIRestaurantsRepository();
    const restaurantService: RestaurantsService = new RestaurantsImpl(repoImpl);

    const body = await req.json();
    
    return await restaurantService
        .editRating((await params).id, body.propertyID, body.ratingID)
        .then(() => {
            return NextResponse.json({});
        })
        .catch((error) => {
            console.error(error);
            return NextResponse.error();
        });
}
