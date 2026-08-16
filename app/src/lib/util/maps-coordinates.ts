// Reading coordinates out of a Google Maps URL.
//
// Split out of maps-scrape so the browser can use it. maps-scrape pulls in node-html-parser for
// the og:title tag, which has no business in a client bundle, and the add screen needs exactly
// these two patterns: when a link carries no coordinates the user is asked to open it in a
// browser and paste back the URL Maps rewrites itself to, and that URL is parsed here.
//
// Nothing in this file touches the network or the DOM, so both halves share one definition of
// what a usable coordinate is.

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

// The "!3d<lat>!4d<lng>" pair inside a permalink's `data=` parameter. Unlike the "@lat,lng"
// prefix — which is the map viewport and can sit anywhere near the place — this is the pin
// itself, so it is preferred wherever both are present.
export const PLACE_PIN_PATTERN = /!3d(-?\d{1,3}\.\d+)!4d(-?\d{1,3}\.\d+)/;

// The "@lat,lng" prefix. Matches both "/maps/place/" and "/maps/preview/place/", and both "@"
// and "%40" — the latter is what an older scraper assumed was always present.
//
// The name segment is `*` rather than `+`: Google's own canonical form for a place is sometimes
// "/maps/place//data=..." with the segment empty, and those coordinates are still good.
export const PLACE_URL_PATTERN =
    /\/maps(?:\/preview)?\/place\/([^\/"\\?]*)\/(?:@|%40)(-?\d{1,3}\.\d+),(-?\d{1,3}\.\d+)/;

export interface Coordinates {
    latitude: number;
    longitude: number;
}

export function parsePlacePin(text: string): Coordinates | null {
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

export function parsePlaceViewport(text: string): Coordinates | null {
    const match = text.match(PLACE_URL_PATTERN);
    if (match === null) {
        return null;
    }

    const latitude = parseFloat(match[2]);
    const longitude = parseFloat(match[3]);
    if (!isValidCoordinate(latitude, longitude)) {
        return null;
    }

    return { latitude: latitude, longitude: longitude };
}

// Coordinates from anywhere in a Maps URL, pin first. Takes free text rather than a URL so it
// can be handed a whole clipboard without the caller tidying it up.
export function parseCoordinatesFromUrl(text: string): Coordinates | null {
    return parsePlacePin(text) || parsePlaceViewport(text);
}
