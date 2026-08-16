import { NotionAPIRestaurantsRepository } from "@/lib/places/repository/notion/repository";
import { RestaurantsImpl, RestaurantsService } from "@/lib/places/service";
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/require-role";
import { NotionAPIError } from "@/lib/client/notion/errors";
import {
    notionErrorResponse,
    placeFromRequestBody,
} from "@/lib/places/place-request";

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

// Replaces every editable property of an existing place. Deliberately a whole-form write rather
// than a sparse patch: the edit screen always submits the complete set, and the update payload
// has to send blank fields explicitly for clearing a value to be possible at all.
export async function PATCH(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const auth = await requireAdmin();
    if (!auth.ok) {
        return auth.response;
    }

    const id = (await params).id;

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
        return NextResponse.json(
            { error: "schema_unavailable" },
            { status: 502 }
        );
    }

    const parsed = placeFromRequestBody(body, schema);
    if (!parsed.ok) {
        return parsed.response;
    }

    try {
        const updated = await restaurantService.updateRestaurant(
            id,
            parsed.place
        );
        console.info(
            "Updated place %s (%s) by %s",
            updated.name,
            updated.id,
            auth.email
        );

        return NextResponse.json(updated);
    } catch (e) {
        if (e instanceof NotionAPIError) {
            return notionErrorResponse(e);
        }

        console.error("Failed to update place %s: %s", id, e);
        return NextResponse.json({ error: "update_failed" }, { status: 502 });
    }
}
