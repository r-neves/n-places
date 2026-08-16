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
import {
    PLACE_PIN_PATTERN,
    PLACE_URL_PATTERN,
    isValidCoordinate,
    parsePlacePin,
} from "./maps-coordinates";

// Re-exported so the server-side callers that already import them from here keep working, and
// so there is still one obvious place to look for them.
export { isValidCoordinate, parsePlacePin };

export type FieldSource =
    | "og:title"
    | "place-pin"
    | "place-url"
    | "place-label"
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

// The label of a place URL, with no coordinates required after it. Sharing from the Maps *app*
// produces a permalink of exactly this shape:
//     /maps/place/Mercearia+do+Largo,+Tv.+São+Sebastião+6,+6100-737+Sertã/data=!4m2!3m1!1s0x…
// — full name and postal address, no "@lat,lng" and no "!3d/!4d" pin anywhere. PLACE_URL_PATTERN
// requires the coordinates, so it skips these entirely and the name has to come from the blob.
// This is the same segment, read for its label alone.
const PLACE_LABEL_PATTERN = /\/maps(?:\/preview)?\/place\/([^\/"\\?]+)(?:[\/"\\?]|$)/;

// Inside the page's JS blob the place label appears as a quoted string immediately before a
// [<altitude>,<longitude>,<latitude>] triple:
//     \"Restaurante Clube 1886\",[[3102.64,-8.9910923,38.9549507],null,...
//
// This is the only name source that survives the leaner page Google serves to a datacenter IP,
// where the response has no canonical /maps/place/ URL and no usable og:title.
//
// Only the *label* is taken. The triple is deliberately parsed and thrown away: on the lean page
// it is not the place's location but the map viewport, byte-identical to the one in
// APP_INITIALIZATION_STATE, and the viewport is centred whereever Google geolocates the caller.
// From Vercel that is London, which is how a grocer in Sertã came to be pinned in Southwark. It
// is still matched rather than made optional because it is what anchors the pattern to a place
// entry instead of any quoted string on the page.
const BLOB_PLACE_PATTERN =
    /\\"([^"\\]{2,120})\\",\[\[-?[\d.]+,(-?\d{1,3}\.\d+),(-?\d{1,3}\.\d+)\]/;

// Google serves this as the og:title for pages that aren't a specific place.
const GENERIC_TITLE = "google maps";

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

    // The segment is "<name>, <address>" when Google includes the address at all.
    const decoded = decodePlaceSegment(match[1]);
    const split =
        decoded === null ? { name: null, address: null } : splitLabel(decoded);

    return {
        name: split.name,
        address: split.address,
        latitude: latitude,
        longitude: longitude,
    };
}

// A label is sometimes just the name ("Xiaolongkan Hot Pot") and sometimes name plus address
// ("Lupita Pizzaria Alvalade, Av. da Igreja 15D, 1700-237 Lisboa"), so it splits on the first
// ", ". Shared by all three label sources so they cannot drift apart.
function splitLabel(label: string): {
    name: string | null;
    address: string | null;
} {
    const separatorIndex = label.indexOf(", ");
    if (separatorIndex === -1) {
        return { name: label.trim() || null, address: null };
    }

    return {
        name: label.substring(0, separatorIndex).trim() || null,
        address: label.substring(separatorIndex + 2).trim() || null,
    };
}

// Name and address from a place URL that carries no coordinates — the shape the Maps app
// produces. Coordinates are not returned because there are none to return.
export function parsePlaceLabel(
    text: string
): { name: string | null; address: string | null } | null {
    const match = text.match(PLACE_LABEL_PATTERN);
    if (match === null) {
        return null;
    }

    const decoded = decodePlaceSegment(match[1]);
    if (decoded === null) {
        return null;
    }

    const split = splitLabel(decoded);
    if (split.name === null) {
        return null;
    }

    return split;
}

// Returns the place's label only. See BLOB_PLACE_PATTERN: the triple that follows it is the map
// viewport, not the place, so there are deliberately no coordinates here.
export function parseBlobPlace(
    html: string
): { name: string; address: string | null } | null {
    const match = html.match(BLOB_PLACE_PATTERN);
    if (match === null) {
        return null;
    }

    const label = match[1].trim();
    const longitude = parseFloat(match[2]);
    const latitude = parseFloat(match[3]);

    // The coordinates are checked but never returned: a triple that is not a plausible
    // coordinate pair means this was some other quoted string, not a place entry.
    if (label.length === 0 || !isValidCoordinate(latitude, longitude)) {
        return null;
    }

    const split = splitLabel(label);
    if (split.name === null) {
        return null;
    }

    return { name: split.name, address: split.address };
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
    const urlCandidates = finalUrl ? [finalUrl].concat(hops) : hops;
    const pinFromUrl = firstNonNull(urlCandidates, parsePlacePin);
    const pinFromHtml = parsePlacePin(html);

    // Label-only fallback for URLs with no coordinates at all, which is every link shared from
    // the Maps app. Searched over the URLs rather than the body: the body's first
    // "/maps/place/..." need not be this place, whereas the resolved URL is by definition.
    const fromLabel = firstNonNull(urlCandidates, parsePlaceLabel);

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

    if (result.name === null && fromLabel !== null && fromLabel.name !== null) {
        result.name = fromLabel.name;
        result.sources.name = "place-label";
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

    if (result.address === null && fromLabel !== null && fromLabel.address !== null) {
        result.address = fromLabel.address;
        result.sources.address = "place-label";
    }

    if (result.address === null && fromHtml !== null && fromHtml.address !== null) {
        result.address = fromHtml.address;
        result.sources.address = "place-url";
    }

    if (result.address === null && fromBlob !== null && fromBlob.address !== null) {
        result.address = fromBlob.address;
        result.sources.address = "blob";
    }

    // Every coordinate source here is a *coordinate* Google published for this place, in a URL
    // or in the page's `data=` parameter. Nothing viewport-derived is accepted, at any priority:
    // the map centre on a lean page is wherever Google thinks the caller is, which from Vercel
    // is London. Coordinates that get written back to Notion and then look settled are worse
    // than no coordinates at all, so a link that carries none — every Maps-app share does — is
    // left blank for the form to fill in by hand.
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
