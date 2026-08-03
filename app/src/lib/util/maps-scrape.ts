// Extracts a place's name, address and coordinates from a Google Maps page.
//
// Google's Maps HTML is unversioned and has already drifted once: the previous scraper looked
// for "%40" (a URL-encoded "@") and the captured response in backup/maps_resp_example.txt does
// not contain that string at all, so it silently produced NaN coordinates. Everything here is
// therefore built around three *independent* extraction sources, each of which is enough on its
// own, and every field is separately nullable. A partial result is a normal outcome, not a
// failure — the caller shows an editable form either way.
//
// The parsing half is deliberately pure and separate from the network half so it can be tested
// against the captured fixture without touching the network.

import { parse } from "node-html-parser";
import { isGoogleMapsUrl } from "./maps-share";

export type FieldSource =
    | "og:title"
    | "place-url"
    | "final-url"
    | "blob"
    | "app-init-state"
    | null;

export interface ScrapedPlace {
    name: string | null;
    address: string | null;
    latitude: number | null;
    longitude: number | null;
    // Records which parser produced each field. Logged server-side: if these start coming back
    // null in production, Google has changed their markup again.
    sources: {
        name: FieldSource;
        address: FieldSource;
        coordinates: FieldSource;
    };
}

export type MapsFetchFailure =
    | "blocked-host"
    | "http-error"
    | "timeout"
    | "consent-wall"
    | "network-error";

export class MapsFetchError extends Error {
    reason: MapsFetchFailure;
    status?: number;

    constructor(reason: MapsFetchFailure, status?: number) {
        super("Failed to fetch Google Maps page: " + reason);
        this.name = "MapsFetchError";
        this.reason = reason;
        this.status = status;
        // Required for `instanceof` to survive the es5 downlevel in tsconfig.
        Object.setPrototypeOf(this, MapsFetchError.prototype);
    }
}

// og:title reads "<name> · <address>". Verified against the fixture: the separator is U+00B7
// wrapped in plain spaces, but \s also covers the non-breaking-space variant Google sometimes
// emits.
const OG_TITLE_SEPARATOR = /\s*\u00b7\s*/;

// The place URL appears inside a JS blob rather than the DOM, so this runs against raw HTML.
// Matches both "/maps/place/" and "/maps/preview/place/", and both "@" and "%40" — the latter
// is what the old scraper assumed was always present.
const PLACE_URL_PATTERN =
    /\/maps(?:\/preview)?\/place\/([^\/"\\?]+)\/(?:@|%40)(-?\d{1,3}\.\d+),(-?\d{1,3}\.\d+)/;

// APP_INITIALIZATION_STATE=[[[<altitude>,<longitude>,<latitude>,...
// Note the ordering: longitude comes before latitude.
const APP_INIT_STATE_PATTERN =
    /APP_INITIALIZATION_STATE=\[\[\[-?[\d.]+,(-?\d{1,3}\.\d+),(-?\d{1,3}\.\d+)/;

// Inside the page's JS blob the place name appears as a quoted string immediately before its
// own [<altitude>,<longitude>,<latitude>] triple:
//     \"Restaurante Clube 1886\",[[3102.64,-8.9910923,38.9549507],null,...
//
// This matters because it is the only name source that survives the leaner page Google serves
// to a datacenter IP: production saw sources={"name":null,"coordinates":"app-init-state"},
// meaning the response had no canonical /maps/place/ URL and no usable og:title, but the blob
// was present and parsing.
const BLOB_PLACE_PATTERN =
    /\\"([^"\\]{2,120})\\",\[\[-?[\d.]+,(-?\d{1,3}\.\d+),(-?\d{1,3}\.\d+)\]/;

// Google serves this as the og:title for pages that aren't a specific place.
const GENERIC_TITLE = "google maps";

export function isValidCoordinate(latitude: number, longitude: number): boolean {
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
        return false;
    }

    if (latitude < -90 || latitude > 90) {
        return false;
    }

    if (longitude < -180 || longitude > 180) {
        return false;
    }

    // Null Island is always a parse failure, never a restaurant.
    if (latitude === 0 && longitude === 0) {
        return false;
    }

    return true;
}

export function parseOgTitle(
    html: string
): { name: string; address: string | null } | null {
    let content: string | undefined;

    try {
        // Parsed rather than regexed on purpose: in the captured response `content=` appears
        // *before* `property=`, so an attribute-order-sensitive regex misses it entirely.
        const meta = parse(html).querySelector('meta[property="og:title"]');
        content = meta ? meta.getAttribute("content") : undefined;
    } catch (e) {
        return null;
    }

    if (!content) {
        return null;
    }

    const trimmed = content.trim();
    if (trimmed.length === 0 || trimmed.toLowerCase() === GENERIC_TITLE) {
        return null;
    }

    const parts = trimmed.split(OG_TITLE_SEPARATOR);
    const name = parts[0].trim();
    if (name.length === 0) {
        return null;
    }

    // Rejoin any remaining parts: an address may legitimately contain the separator.
    const address = parts.length > 1 ? parts.slice(1).join(" \u00b7 ").trim() : "";

    return { name: name, address: address.length > 0 ? address : null };
}

function decodePlaceSegment(segment: string): string | null {
    try {
        const decoded = decodeURIComponent(segment.replace(/\+/g, " "));

        // Inside the page body Google double-encodes the segment ("%2B" where the canonical URL
        // uses "+"), so one decode pass leaves literal plus signs where the spaces belong. A
        // decoded segment with no spaces at all but several pluses is that case, not a name that
        // genuinely contains "+".
        if (decoded.indexOf(" ") === -1 && decoded.indexOf("+") !== -1) {
            return decoded.replace(/\+/g, " ");
        }

        return decoded;
    } catch (e) {
        // decodeURIComponent throws URIError on a malformed % sequence.
        return null;
    }
}

export function parsePlaceUrl(text: string): {
    name: string | null;
    address: string | null;
    latitude: number;
    longitude: number;
} | null {
    const match = text.match(PLACE_URL_PATTERN);
    if (match === null) {
        return null;
    }

    const latitude = parseFloat(match[2]);
    const longitude = parseFloat(match[3]);
    if (!isValidCoordinate(latitude, longitude)) {
        return null;
    }

    let name: string | null = null;
    let address: string | null = null;

    const decoded = decodePlaceSegment(match[1]);
    if (decoded !== null) {
        // The segment is "<name>, <address>" when Google includes the address at all.
        const separatorIndex = decoded.indexOf(", ");
        if (separatorIndex === -1) {
            name = decoded.trim() || null;
        } else {
            name = decoded.substring(0, separatorIndex).trim() || null;
            address = decoded.substring(separatorIndex + 2).trim() || null;
        }
    }

    return {
        name: name,
        address: address,
        latitude: latitude,
        longitude: longitude,
    };
}

export function parseBlobPlace(html: string): {
    name: string;
    address: string | null;
    latitude: number;
    longitude: number;
} | null {
    const match = html.match(BLOB_PLACE_PATTERN);
    if (match === null) {
        return null;
    }

    const label = match[1].trim();
    const longitude = parseFloat(match[2]);
    const latitude = parseFloat(match[3]);

    if (label.length === 0 || !isValidCoordinate(latitude, longitude)) {
        return null;
    }

    // The label is sometimes just the name ("Xiaolongkan Hot Pot") and sometimes name plus
    // address ("Lupita Pizzaria Alvalade, Av. da Igreja 15D, 1700-237 Lisboa"), so it is split
    // on the first ", " exactly as the place-URL segment is.
    const separatorIndex = label.indexOf(", ");
    if (separatorIndex === -1) {
        return {
            name: label,
            address: null,
            latitude: latitude,
            longitude: longitude,
        };
    }

    return {
        name: label.substring(0, separatorIndex).trim(),
        address: label.substring(separatorIndex + 2).trim() || null,
        latitude: latitude,
        longitude: longitude,
    };
}

export function parseAppInitState(
    html: string
): { latitude: number; longitude: number } | null {
    const match = html.match(APP_INIT_STATE_PATTERN);
    if (match === null) {
        return null;
    }

    const longitude = parseFloat(match[1]);
    const latitude = parseFloat(match[2]);
    if (!isValidCoordinate(latitude, longitude)) {
        return null;
    }

    return { latitude: latitude, longitude: longitude };
}

export function parseGoogleMapsHtml(
    html: string,
    finalUrl?: string
): ScrapedPlace {
    const result: ScrapedPlace = {
        name: null,
        address: null,
        latitude: null,
        longitude: null,
        sources: { name: null, address: null, coordinates: null },
    };

    const ogTitle = parseOgTitle(html);
    const fromFinalUrl = finalUrl ? parsePlaceUrl(finalUrl) : null;
    const fromHtml = parsePlaceUrl(html);
    const fromBlob = parseBlobPlace(html);
    const fromAppInit = parseAppInitState(html);

    // Name and address both come from og:title first: it separates the two with an explicit
    // "·", whereas splitting the URL segment on ", " guesses wrong whenever the name itself
    // contains a comma.
    if (ogTitle !== null) {
        result.name = ogTitle.name;
        result.sources.name = "og:title";
        if (ogTitle.address !== null) {
            result.address = ogTitle.address;
            result.sources.address = "og:title";
        }
    }

    if (result.name === null && fromFinalUrl !== null && fromFinalUrl.name !== null) {
        result.name = fromFinalUrl.name;
        result.sources.name = "final-url";
    }

    if (result.name === null && fromHtml !== null && fromHtml.name !== null) {
        result.name = fromHtml.name;
        result.sources.name = "place-url";
    }

    if (result.name === null && fromBlob !== null) {
        result.name = fromBlob.name;
        result.sources.name = "blob";
    }

    if (
        result.address === null &&
        fromFinalUrl !== null &&
        fromFinalUrl.address !== null
    ) {
        result.address = fromFinalUrl.address;
        result.sources.address = "final-url";
    }

    if (result.address === null && fromHtml !== null && fromHtml.address !== null) {
        result.address = fromHtml.address;
        result.sources.address = "place-url";
    }

    if (result.address === null && fromBlob !== null && fromBlob.address !== null) {
        result.address = fromBlob.address;
        result.sources.address = "blob";
    }

    // Coordinates prefer the resolved URL, which is the canonical place permalink.
    if (fromFinalUrl !== null) {
        result.latitude = fromFinalUrl.latitude;
        result.longitude = fromFinalUrl.longitude;
        result.sources.coordinates = "final-url";
    } else if (fromHtml !== null) {
        result.latitude = fromHtml.latitude;
        result.longitude = fromHtml.longitude;
        result.sources.coordinates = "place-url";
    } else if (fromBlob !== null) {
        // Preferred over app-init-state: the blob triple belongs to the place itself, whereas
        // APP_INITIALIZATION_STATE's leading triple is the map viewport centre.
        result.latitude = fromBlob.latitude;
        result.longitude = fromBlob.longitude;
        result.sources.coordinates = "blob";
    } else if (fromAppInit !== null) {
        result.latitude = fromAppInit.latitude;
        result.longitude = fromAppInit.longitude;
        result.sources.coordinates = "app-init-state";
    }

    return result;
}

// The user agent matters more than it looks. Sending a *desktop browser* UA makes
// maps.app.goo.gl serve Google's "durable deep link" interstitial — an install-the-app landing
// page that contains no place data at all and never redirects. Every other user agent tried
// (this one, curl's, Android Chrome's, none at all) gets the real 30x to the canonical
// /maps/place/... URL. So identify honestly rather than impersonating a browser: it is both
// more truthful and, here, the thing that actually works.
//
// Accept-Language is pinned because an unset one makes the address format vary by server region.
const SCRAPE_HEADERS = {
    "User-Agent": "n-places/1.0 (+https://n-places.vercel.app)",
    "Accept-Language": "en-US,en;q=0.9",
    Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    // Skips the EU consent interstitial, which would otherwise be all we ever parse.
    Cookie: "CONSENT=YES+cb; SOCS=CAI",
};

const SCRAPE_TIMEOUT_MS = 8000;

export async function fetchGoogleMapsHtml(
    mapsUrl: string
): Promise<{ html: string; finalUrl: string }> {
    // The URL originates from a client, so this is the SSRF boundary.
    if (!isGoogleMapsUrl(mapsUrl)) {
        throw new MapsFetchError("blocked-host");
    }

    let response: Response;

    try {
        response = await fetch(mapsUrl, {
            headers: SCRAPE_HEADERS,
            redirect: "follow",
            signal: AbortSignal.timeout(SCRAPE_TIMEOUT_MS),
            cache: "no-store",
        });
    } catch (e) {
        const name = e instanceof Error ? e.name : "";
        if (name === "TimeoutError" || name === "AbortError") {
            throw new MapsFetchError("timeout");
        }

        throw new MapsFetchError("network-error");
    }

    // Re-check the host after redirects: the short link could have been pointed anywhere, and
    // this is also how the consent interstitial announces itself.
    let finalHost = "";
    try {
        finalHost = new URL(response.url).hostname.toLowerCase();
    } catch (e) {
        finalHost = "";
    }

    if (finalHost.indexOf("consent.") === 0 || finalHost === "consent.google.com") {
        throw new MapsFetchError("consent-wall");
    }

    if (response.url && !isGoogleMapsUrl(response.url)) {
        throw new MapsFetchError("blocked-host");
    }

    if (!response.ok) {
        throw new MapsFetchError("http-error", response.status);
    }

    const html = await response.text();

    return { html: html, finalUrl: response.url || mapsUrl };
}

export async function resolveGoogleMapsPlace(
    mapsUrl: string
): Promise<ScrapedPlace & { resolvedUrl: string }> {
    const fetched = await fetchGoogleMapsHtml(mapsUrl);
    const parsed = parseGoogleMapsHtml(fetched.html, fetched.finalUrl);

    return {
        name: parsed.name,
        address: parsed.address,
        latitude: parsed.latitude,
        longitude: parsed.longitude,
        sources: parsed.sources,
        resolvedUrl: fetched.finalUrl,
    };
}
