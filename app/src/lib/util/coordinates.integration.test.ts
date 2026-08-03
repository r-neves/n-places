import { describe, expect, test } from "@jest/globals";
import { getCoordinatesFromMapsUrl } from "./coordinates";
import { resolveGoogleMapsPlace } from "./maps-scrape";

// These hit Google over the network, so they are excluded from `npm test` (see
// testPathIgnorePatterns in jest.config.js) and run via `npm run test:integration`.
//
// Run them whenever the scrapers are touched, and periodically regardless: they are the only
// check that Google has not changed their markup out from under the parsers. The deterministic
// coverage lives in maps-scrape.test.ts, which parses the captured fixture instead.
describe("Google Maps scraping (live network)", () => {
    const mapsUrl = "https://maps.app.goo.gl/GcMfNb5CeNQ4nRsu8"; // Clube 1886
    const latitude = 38.9549507;
    const longitude = -8.9910923;

    test("resolves coordinates from a share link", async () => {
        const coordinates = await getCoordinatesFromMapsUrl(0, mapsUrl);

        expect(coordinates).not.toBeNull();
        expect(coordinates!.index).toBe(0);
        expect(coordinates!.latitude).toBeCloseTo(latitude, 4);
        expect(coordinates!.longitude).toBeCloseTo(longitude, 4);
    }, 20000);

    test("resolves a name alongside the coordinates", async () => {
        const place = await resolveGoogleMapsPlace(mapsUrl);

        expect(place.name).toBeTruthy();
        expect(place.latitude).toBeCloseTo(latitude, 4);
        expect(place.longitude).toBeCloseTo(longitude, 4);
        // If these start coming back null, Google has changed their markup.
        expect(place.sources.coordinates).not.toBeNull();
        expect(place.sources.name).not.toBeNull();
    }, 20000);

    test("returns null rather than throwing for an unresolvable link", async () => {
        const coordinates = await getCoordinatesFromMapsUrl(
            3,
            "https://maps.app.goo.gl/thisdoesnotexist000"
        );

        expect(coordinates).toBeNull();
    }, 20000);
});
