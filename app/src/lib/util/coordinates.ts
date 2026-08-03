import { resolveGoogleMapsPlace, isValidCoordinate } from "./maps-scrape";

export interface IndexedCoordinates {
    index: number;
    latitude: number;
    longitude: number;
}

// Resolves a stored Google Maps link to coordinates, for the batch backfill in
// NotionAPIRestaurantsRepository.getRestaurants.
//
// Returns null rather than throwing, and never returns a non-finite value. Both matter: the
// caller awaits these with Promise.all, so a single rejected link would fail getRestaurants and
// blank the entire map, and a NaN result used to be written back to Notion as
// {"latitude":null,"longitude":null} — permanently, since the row then no longer looked faulty.
// A null here leaves hasFaultyMetadata set, so the place is simply retried on the next sync.
export async function getCoordinatesFromMapsUrl(
    index: number,
    mapsUrl: string
): Promise<IndexedCoordinates | null> {
    try {
        const place = await resolveGoogleMapsPlace(mapsUrl);

        if (
            place.latitude === null ||
            place.longitude === null ||
            !isValidCoordinate(place.latitude, place.longitude)
        ) {
            console.warn("Could not resolve coordinates for %s", mapsUrl);
            return null;
        }

        return {
            index: index,
            latitude: place.latitude,
            longitude: place.longitude,
        };
    } catch (e) {
        console.warn("Failed to resolve coordinates for %s: %s", mapsUrl, e);
        return null;
    }
}
