import { NotionAPIRestaurantsRepository } from "@/lib/places/repository/notion/repository";
import { RestaurantsImpl, RestaurantsService } from "@/lib/places/service";
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/require-role";
import { NewRestaurant, Restaurant } from "@/lib/places/domain/restaurant";
import { NotionAPIError } from "@/lib/client/notion/errors";
import {
    matchSchemaOption,
    matchSchemaOptions,
    resolvePropertyNames,
    schemaOptionNames,
} from "@/lib/client/notion/property-map";
import { isGoogleMapsUrl } from "@/lib/util/maps-share";
import { isValidCoordinate } from "@/lib/util/maps-scrape";

export const dynamic = 'force-dynamic';

const MAX_NAME_LENGTH = 200;

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

function asStringArray(value: unknown): string[] {
    if (!Array.isArray(value)) {
        return [];
    }

    return value.filter((item): item is string => typeof item === "string");
}

function asString(value: unknown): string {
    return typeof value === "string" ? value.trim() : "";
}

// Maps a Notion failure onto something the add screen can show the user, rather than a blanket
// 500. The distinction matters: a validation error is usually a fixable field, whereas a
// permissions error means the integration itself needs attention.
function errorResponse(error: NotionAPIError): NextResponse {
    const payload = {
        error: "notion_error",
        code: error.code,
        message: error.message,
        requestId: error.requestId,
    };

    switch (error.code) {
        case "validation_error":
            return NextResponse.json(
                {
                    ...payload,
                    message:
                        "Notion rejected one of the fields. An option may not exist in the database yet.",
                },
                { status: 422 }
            );
        case "rate_limited":
            return NextResponse.json(payload, { status: 429 });
        case "unauthorized":
        case "restricted_resource":
            return NextResponse.json(
                {
                    ...payload,
                    message:
                        "The Notion integration is not allowed to write to this database.",
                },
                { status: 502 }
            );
        case "object_not_found":
            return NextResponse.json(
                {
                    ...payload,
                    message:
                        "Notion could not find the data source. Check RESTAURANTS_DATA_SOURCE_ID.",
                },
                { status: 502 }
            );
        default:
            return NextResponse.json(payload, { status: 502 });
    }
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

    const name = asString(body?.name).substring(0, MAX_NAME_LENGTH);
    if (name.length === 0) {
        return NextResponse.json({ error: "name_required" }, { status: 400 });
    }

    const mapsUrl = asString(body?.mapsUrl);
    if (mapsUrl.length === 0 || !isGoogleMapsUrl(mapsUrl)) {
        return NextResponse.json({ error: "invalid_maps_url" }, { status: 400 });
    }

    const repoImpl = new NotionAPIRestaurantsRepository();
    const restaurantService: RestaurantsService = new RestaurantsImpl(repoImpl);

    // Option values are validated against the live schema rather than trusted from the client.
    // A multi_select or select silently creates any name it has not seen, which is how a tag
    // nobody defined ends up in the database and then crashes PlaceCard's RestaurantTypeMap
    // lookup; a status property does the opposite and hard-fails. Sending only live schema
    // values avoids both.
    let schema;
    try {
        schema = await restaurantService.getDatabaseSchema();
    } catch (e) {
        if (e instanceof NotionAPIError) {
            return errorResponse(e);
        }

        console.error("Failed to read Notion schema: %s", e);
        return NextResponse.json({ error: "schema_unavailable" }, { status: 502 });
    }

    const propertyNames = resolvePropertyNames(schema);
    const ratingOptions = schemaOptionNames(schema, "rating", propertyNames);
    const typeOptions = schemaOptionNames(schema, "type", propertyNames);
    const priceOptions = schemaOptionNames(schema, "dishPrice", propertyNames);
    const ambienceOptions = schemaOptionNames(schema, "ambience", propertyNames);

    // An unknown status name is a hard Notion error, so fall back to the first option (which is
    // "Not visited" in this database) rather than sending something unrecognised.
    const rating =
        matchSchemaOption(asString(body?.rating), ratingOptions) ||
        (ratingOptions.length > 0 ? ratingOptions[0] : "");

    let metadata = null;
    const coordinates = body?.coordinates;
    if (
        coordinates &&
        typeof coordinates.latitude === "number" &&
        typeof coordinates.longitude === "number" &&
        isValidCoordinate(coordinates.latitude, coordinates.longitude)
    ) {
        metadata = {
            coordinates: {
                latitude: coordinates.latitude,
                longitude: coordinates.longitude,
            },
        };
    }

    const place: NewRestaurant = {
        name: name,
        mapsUrl: mapsUrl,
        location: asString(body?.location),
        rating: rating,
        dishPrice:
            matchSchemaOption(asString(body?.dishPrice), priceOptions) || "",
        tags: matchSchemaOptions(asStringArray(body?.tags), typeOptions),
        ambience: matchSchemaOptions(
            asStringArray(body?.ambience),
            ambienceOptions
        ),
        recommender: asString(body?.recommender),
        description: asString(body?.description),
        metadata: metadata,
    };

    // Re-sharing a place that is already saved is the most likely real-world mistake, so it is
    // caught rather than silently duplicated. ?force=true is the "yes, add it anyway" escape.
    if (req.nextUrl.searchParams.get("force") !== "true") {
        const duplicate = await findDuplicate(restaurantService, mapsUrl);
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
            return errorResponse(e);
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
