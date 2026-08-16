import { NotionAPIRestaurantsRepository } from "@/lib/places/repository/notion/repository";
import { RestaurantsImpl, RestaurantsService } from "@/lib/places/service";
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/require-role";
import { Restaurant } from "@/lib/places/domain/restaurant";
import { NotionAPIError } from "@/lib/client/notion/errors";
import {
    notionErrorResponse,
    placeFromRequestBody,
} from "@/lib/places/place-request";

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

export async function POST(req: NextRequest) {
    const auth = await requireAdmin();
    if (!auth.ok) {
        return auth.response;
    }

    let body: any;
    try {
        body = await req.json();
    } catch (e) {
        return NextResponse.json({ error: "invalid_body" }, { status: 400 });
    }

    const repoImpl = new NotionAPIRestaurantsRepository();
    const restaurantService: RestaurantsService = new RestaurantsImpl(repoImpl);

    let schema;
    try {
        schema = await restaurantService.getDatabaseSchema();
    } catch (e) {
        if (e instanceof NotionAPIError) {
            return notionErrorResponse(e);
        }

        console.error("Failed to read Notion schema: %s", e);
        return NextResponse.json({ error: "schema_unavailable" }, { status: 502 });
    }

    const parsed = placeFromRequestBody(body, schema);
    if (!parsed.ok) {
        return parsed.response;
    }

    const place = parsed.place;

    // Re-sharing a place that is already saved is the most likely real-world mistake, so it is
    // caught rather than silently duplicated. ?force=true is the "yes, add it anyway" escape.
    if (req.nextUrl.searchParams.get("force") !== "true") {
        const duplicate = await findDuplicate(restaurantService, place.mapsUrl);
        if (duplicate !== null) {
            return NextResponse.json(
                { error: "duplicate", code: "duplicate", existing: duplicate },
                { status: 409 }
            );
        }
    }

    try {
        const created = await restaurantService.createRestaurant(place);
        console.info("Created place %s (%s) by %s", created.name, created.id, auth.email);

        return NextResponse.json(created, { status: 201 });
    } catch (e) {
        if (e instanceof NotionAPIError) {
            return notionErrorResponse(e);
        }

        console.error("Failed to create place: %s", e);
        return NextResponse.json({ error: "create_failed" }, { status: 502 });
    }
}

async function findDuplicate(
    service: RestaurantsService,
    mapsUrl: string
): Promise<Restaurant | null> {
    try {
        // Cache-only, and side-effect free. If the cache is cold this simply finds nothing,
        // which is the right trade — a missed duplicate is a far smaller problem than making
        // every save wait on a full Notion sync.
        return await service.findByMapsUrl(mapsUrl);
    } catch (e) {
        console.warn("Duplicate check failed, continuing: %s", e);
        return null;
    }
}
