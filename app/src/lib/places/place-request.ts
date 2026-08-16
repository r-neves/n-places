// Turns a request body into a validated NewRestaurant, and Notion failures into responses the
// place form can act on.
//
// Shared by create (POST /api/restaurants) and update (PATCH /api/restaurants/[id]) because both
// accept exactly the same fields and must apply exactly the same validation — a divergence here
// would mean a value the add screen refuses could still be saved from the edit screen.

import { NextResponse } from "next/server";
import { DatabaseSchema, NewRestaurant } from "./domain/restaurant";
import { NotionAPIError } from "../client/notion/errors";
import {
    matchSchemaOption,
    matchSchemaOptions,
    resolvePropertyNames,
    schemaOptionNames,
} from "../client/notion/property-map";
import { isGoogleMapsUrl } from "../util/maps-share";
import { isValidCoordinate } from "../util/maps-scrape";

const MAX_NAME_LENGTH = 200;

export function asStringArray(value: unknown): string[] {
    if (!Array.isArray(value)) {
        return [];
    }

    return value.filter((item): item is string => typeof item === "string");
}

export function asString(value: unknown): string {
    return typeof value === "string" ? value.trim() : "";
}

export type PlaceRequest =
    | { ok: true; place: NewRestaurant }
    | { ok: false; response: NextResponse };

// Option values are validated against the live schema rather than trusted from the client. A
// multi_select or select silently creates any name it has not seen, which is how a tag nobody
// defined ends up in the database and then crashes PlaceCard's RestaurantTypeMap lookup; a
// status property does the opposite and hard-fails. Sending only live schema values avoids both.
export function placeFromRequestBody(
    body: any,
    schema: DatabaseSchema
): PlaceRequest {
    const name = asString(body?.name).substring(0, MAX_NAME_LENGTH);
    if (name.length === 0) {
        return {
            ok: false,
            response: NextResponse.json(
                { error: "name_required" },
                { status: 400 }
            ),
        };
    }

    const mapsUrl = asString(body?.mapsUrl);
    if (mapsUrl.length === 0 || !isGoogleMapsUrl(mapsUrl)) {
        return {
            ok: false,
            response: NextResponse.json(
                { error: "invalid_maps_url" },
                { status: 400 }
            ),
        };
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

    return {
        ok: true,
        place: {
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
            review: asString(body?.review),
            metadata: metadata,
        },
    };
}

// Maps a Notion failure onto something the place form can show the user, rather than a blanket
// 500. The distinction matters: a validation error is usually a fixable field, whereas a
// permissions error means the integration itself needs attention.
export function notionErrorResponse(error: NotionAPIError): NextResponse {
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
