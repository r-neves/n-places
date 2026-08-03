import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/require-role";
import { isGoogleMapsUrl } from "@/lib/util/maps-share";
import { MapsFetchError, resolveGoogleMapsPlace } from "@/lib/util/maps-scrape";

export const dynamic = "force-dynamic";

const MAX_URL_LENGTH = 2048;

export type ResolveStatus = "ok" | "partial" | "failed";
export type ResolveMissingField = "name" | "address" | "coordinates";

export interface ResolvePlaceResponse {
    status: ResolveStatus;
    resolvedUrl: string;
    name: string | null;
    address: string | null;
    coordinates: { latitude: number; longitude: number } | null;
    missing: ResolveMissingField[];
    warning?: string;
}

// Deliberately human-readable: these are rendered directly in a banner on the add screen.
function warningFor(reason: string): string {
    switch (reason) {
        case "consent-wall":
            return "Google showed a consent page instead of the place. Fill the details in below.";
        case "timeout":
            return "Google took too long to respond. Fill the details in below.";
        case "http-error":
            return "Google returned an error for that link. Check it, or fill the details in below.";
        case "blocked-host":
            return "That link did not lead to Google Maps.";
        default:
            return "Could not read the place from Google. Fill the details in below.";
    }
}

export async function POST(req: NextRequest) {
    const auth = await requireAdmin();
    if (!auth.ok) {
        return auth.response;
    }

    let mapsUrl: string;
    try {
        const body = await req.json();
        mapsUrl = typeof body?.mapsUrl === "string" ? body.mapsUrl.trim() : "";
    } catch (e) {
        return NextResponse.json({ error: "invalid_body" }, { status: 400 });
    }

    if (
        mapsUrl.length === 0 ||
        mapsUrl.length > MAX_URL_LENGTH ||
        !isGoogleMapsUrl(mapsUrl)
    ) {
        return NextResponse.json({ error: "invalid_url" }, { status: 400 });
    }

    // Everything past this point returns 200. A scrape that comes back empty is a normal
    // outcome, not a server error: the client still needs somewhere to put the link, and the
    // form it renders is editable either way. Only bad input and auth failures are non-200.
    try {
        const place = await resolveGoogleMapsPlace(mapsUrl);

        const missing: ResolveMissingField[] = [];
        if (place.name === null) {
            missing.push("name");
        }
        if (place.address === null) {
            missing.push("address");
        }

        const hasCoordinates =
            place.latitude !== null && place.longitude !== null;
        if (!hasCoordinates) {
            missing.push("coordinates");
        }

        const found = 3 - missing.length;
        const status: ResolveStatus =
            found === 3 ? "ok" : found === 0 ? "failed" : "partial";

        // The only telemetry for "Google changed their markup again": if these start coming
        // back null across the board, the parsers need revisiting.
        console.info(
            "Resolved %s -> status=%s sources=%s",
            mapsUrl,
            status,
            JSON.stringify(place.sources)
        );

        const response: ResolvePlaceResponse = {
            status: status,
            resolvedUrl: place.resolvedUrl,
            name: place.name,
            address: place.address,
            coordinates: hasCoordinates
                ? {
                      latitude: place.latitude as number,
                      longitude: place.longitude as number,
                  }
                : null,
            missing: missing,
        };

        if (status === "failed") {
            response.warning = warningFor("");
        }

        return NextResponse.json(response);
    } catch (e) {
        const reason = e instanceof MapsFetchError ? e.reason : "unknown";
        console.warn("Failed to resolve %s: %s", mapsUrl, reason);

        const response: ResolvePlaceResponse = {
            status: "failed",
            // Echo the input back so the client always has a link to save, even when the
            // lookup itself was a total loss.
            resolvedUrl: mapsUrl,
            name: null,
            address: null,
            coordinates: null,
            missing: ["name", "address", "coordinates"],
            warning: warningFor(reason),
        };

        return NextResponse.json(response);
    }
}
