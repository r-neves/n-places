// Extracts a place's name, address and coordinates from a Google Maps page.
//
// Google's Maps HTML is unversioned and has already drifted once: the previous scraper looked
// for "%40" (a URL-encoded "@") and the captured response in backup/maps_resp_example.txt does
// not contain that string at all, so it silently produced NaN coordinates. Everything here is
// therefore built around several *independent* extraction sources, each of which is enough on
// its own, and every field is separately nullable. A partial result is a normal outcome, not a
// failure — the caller shows an editable form either way.
//
// The most reliable source turns out not to be the page at all but the redirect chain. A
// maps.app.goo.gl link answers with a 302 whose Location carries the canonical permalink —
// name, viewport and the place's own "!3d<lat>!4d<lng>" pin — and that header is identical
// whether the request comes from a home connection or from a datacenter. The *page* behind it
// is not: to Vercel's IP Google serves a lean variant with no canonical URL and no og:title.
// So every intermediate URL is retained and parsed, which is why redirects are followed by hand
// rather than with fetch's `redirect: "follow"` (that discards everything but the last hop).
//
// The parsing half is deliberately pure and separate from the network half so it can be tested
// against the captured fixture without touching the network.

import { parse } from "node-html-parser";
import { isGoogleMapsUrl } from "./maps-share";

export type FieldSource =
    | "og:title"
    | "place-pin"
    | "place-url"
    | "final-url"
    | "redirect-url"
    | "blob"
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
//
// The name segment is `*` rather than `+`: Google's own canonical form for a place is sometimes
// "/maps/place//data=..." with the segment empty, and those coordinates are still good.
const PLACE_URL_PATTERN =
    /\/maps(?:\/preview)?\/place\/([^\/"\\?]*)\/(?:@|%40)(-?\d{1,3}\.\d+),(-?\d{1,3}\.\d+)/;

// The "!3d<lat>!4d<lng>" pair inside a permalink's `data=` parameter. Unlike the "@lat,lng"
// prefix — which is the map viewport and can sit anywhere near the place — this is the pin
// itself, so it is preferred wherever both are present.
const PLACE_PIN_PATTERN = /!3d(-?\d{1,3}\.\d+)!4d(-?\d{1,3}\.\d+)/;

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

export function parsePlacePin(
    text: string
): { latitude: number; longitude: number } | null {
    const match = text.match(PLACE_PIN_PATTERN);
    if (match === null) {
        return null;
    }

    const latitude = parseFloat(match[1]);
    const longitude = parseFloat(match[2]);
    if (!isValidCoordinate(latitude, longitude)) {
        return null;
    }

    return { latitude: latitude, longitude: longitude };
}

function firstNonNull<T>(
    values: string[],
    parser: (value: string) => T | null
): T | null {
    for (let i = 0; i < values.length; i++) {
        const parsed = parser(values[i]);
        if (parsed !== null) {
            return parsed;
        }
    }

    return null;
}

export function parseGoogleMapsHtml(
    html: string,
    finalUrl?: string,
    // Every URL visited on the way to `finalUrl`, oldest first, excluding it. The 302 from the
    // short link is the one that reliably carries the place, so it is parsed even though the
    // page it led to may not.
    redirectChain?: string[]
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

    // The redirect hops, newest first: the closer a hop is to the final page, the more likely
    // it is the canonical permalink rather than the short link that started it all.
    const hops = (redirectChain || []).filter((url) => !!url).reverse();
    const fromRedirect = firstNonNull(hops, parsePlaceUrl);

    // The pin is searched across the whole chain, the final URL and the page body, because any
    // of them may be the only one carrying a `data=` parameter.
    const pinCandidates = finalUrl ? [finalUrl].concat(hops) : hops;
    const pinFromUrl = firstNonNull(pinCandidates, parsePlacePin);
    const pinFromHtml = parsePlacePin(html);

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

    if (result.name === null && fromRedirect !== null && fromRedirect.name !== null) {
        result.name = fromRedirect.name;
        result.sources.name = "redirect-url";
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

    if (
        result.address === null &&
        fromRedirect !== null &&
        fromRedirect.address !== null
    ) {
        result.address = fromRedirect.address;
        result.sources.address = "redirect-url";
    }

    if (result.address === null && fromHtml !== null && fromHtml.address !== null) {
        result.address = fromHtml.address;
        result.sources.address = "place-url";
    }

    if (result.address === null && fromBlob !== null && fromBlob.address !== null) {
        result.address = fromBlob.address;
        result.sources.address = "blob";
    }

    // Coordinate precedence runs from "definitely this place" to "probably this place", and
    // stops there. Nothing viewport-derived is ever accepted as a last resort: the map centre
    // on the lean page Google serves to a datacenter is wherever *Google* thinks the caller is,
    // which in production meant a restaurant in Portugal being pinned in London. Coordinates
    // that get written back to Notion and then look settled are worse than no coordinates at
    // all, so an unresolvable place is left blank for the form to fill in by hand.
    if (pinFromUrl !== null) {
        result.latitude = pinFromUrl.latitude;
        result.longitude = pinFromUrl.longitude;
        result.sources.coordinates = "place-pin";
    } else if (fromFinalUrl !== null) {
        result.latitude = fromFinalUrl.latitude;
        result.longitude = fromFinalUrl.longitude;
        result.sources.coordinates = "final-url";
    } else if (fromRedirect !== null) {
        result.latitude = fromRedirect.latitude;
        result.longitude = fromRedirect.longitude;
        result.sources.coordinates = "redirect-url";
    } else if (pinFromHtml !== null) {
        result.latitude = pinFromHtml.latitude;
        result.longitude = pinFromHtml.longitude;
        result.sources.coordinates = "place-pin";
    } else if (fromHtml !== null) {
        result.latitude = fromHtml.latitude;
        result.longitude = fromHtml.longitude;
        result.sources.coordinates = "place-url";
    } else if (fromBlob !== null) {
        // The blob triple belongs to the place itself, so it is trustworthy in a way
        // APP_INITIALIZATION_STATE's leading triple — the viewport centre — never was.
        result.latitude = fromBlob.latitude;
        result.longitude = fromBlob.longitude;
        result.sources.coordinates = "blob";
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

// One deadline for the whole chain, not per hop, so a link that redirects five times can still
// only cost this much wall clock.
const SCRAPE_TIMEOUT_MS = 8000;

// Google's own chains are one or two hops. Anything longer is a loop or a link that was never a
// place to begin with.
const MAX_REDIRECTS = 5;

// Throws the right MapsFetchError for a URL the chain must not follow. Consent is checked before
// the host allowlist because "Google asked for consent" is a far more useful thing to tell the
// user than "that link did not lead to Google Maps".
function assertFollowable(url: string): void {
    let host = "";
    try {
        host = new URL(url).hostname.toLowerCase();
    } catch (e) {
        host = "";
    }

    if (host.indexOf("consent.") === 0) {
        throw new MapsFetchError("consent-wall");
    }

    if (!isGoogleMapsUrl(url)) {
        throw new MapsFetchError("blocked-host");
    }
}

export async function fetchGoogleMapsHtml(
    mapsUrl: string
): Promise<{ html: string; finalUrl: string; redirectChain: string[] }> {
    // The URL originates from a client, so this is the SSRF boundary. Every hop is re-checked
    // below, since a short link could have been pointed anywhere.
    assertFollowable(mapsUrl);

    // Redirects are followed by hand rather than by fetch: `redirect: "follow"` reports only
    // where it ended up, and here the intermediate Location header is the single most reliable
    // carrier of the place's name and coordinates.
    const signal = AbortSignal.timeout(SCRAPE_TIMEOUT_MS);
    const redirectChain: string[] = [];
    let currentUrl = mapsUrl;
    let response: Response;

    for (let hop = 0; ; hop++) {
        try {
            response = await fetch(currentUrl, {
                headers: SCRAPE_HEADERS,
                redirect: "manual",
                signal: signal,
                cache: "no-store",
            });
        } catch (e) {
            const name = e instanceof Error ? e.name : "";
            if (name === "TimeoutError" || name === "AbortError") {
                throw new MapsFetchError("timeout");
            }

            throw new MapsFetchError("network-error");
        }

        const location =
            response.status >= 300 && response.status < 400
                ? response.headers.get("location")
                : null;

        if (location === null) {
            break;
        }

        if (hop >= MAX_REDIRECTS) {
            throw new MapsFetchError("http-error", response.status);
        }

        let nextUrl: string;
        try {
            // Resolved against the current URL: Location is allowed to be relative.
            nextUrl = new URL(location, currentUrl).toString();
        } catch (e) {
            throw new MapsFetchError("network-error");
        }

        assertFollowable(nextUrl);

        redirectChain.push(currentUrl);
        currentUrl = nextUrl;
    }

    if (!response.ok) {
        throw new MapsFetchError("http-error", response.status);
    }

    const html = await response.text();

    return { html: html, finalUrl: currentUrl, redirectChain: redirectChain };
}

export async function resolveGoogleMapsPlace(
    mapsUrl: string
): Promise<ScrapedPlace & { resolvedUrl: string }> {
    const fetched = await fetchGoogleMapsHtml(mapsUrl);
    const parsed = parseGoogleMapsHtml(
        fetched.html,
        fetched.finalUrl,
        fetched.redirectChain
    );

    return {
        name: parsed.name,
        address: parsed.address,
        latitude: parsed.latitude,
        longitude: parsed.longitude,
        sources: parsed.sources,
        resolvedUrl: fetched.finalUrl,
    };
}
