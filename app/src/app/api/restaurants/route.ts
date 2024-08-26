import { NotionAPIRestaurantsRepository } from "@/lib/places/repository/notion/repository";
import { RestaurantsImpl, RestaurantsService } from "@/lib/places/service";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
	const repoImpl = new NotionAPIRestaurantsRepository();
    const restaurantService: RestaurantsService = new RestaurantsImpl(repoImpl);

	const lastModifiedDateStr = req.nextUrl.searchParams.get("lastModifiedDate");
	if (lastModifiedDateStr === null) {
		console.error("lastModifiedDate not found in request");
		return NextResponse.error();
	}

	const lastModifiedDate = new Date(lastModifiedDateStr);

  	console.debug("Date in notion request: %s", lastModifiedDate.toISOString());

	const restaurants = await restaurantService.getRestaurants(lastModifiedDate).then((restaurants) => {
		return Response.json(restaurants);
	}).catch((error) => {
		console.error(error);
		return Response.error();
	});

	return restaurants;
}