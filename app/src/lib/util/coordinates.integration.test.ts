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
    // The pin from the permalink's `data=` parameter, not the "@lat,lng" viewport that used to
    // be asserted here. They sit 220m apart, and the pin is the correct one: it reverse-geocodes
    // to Av. Combatentes da Grande Guerra, the restaurant's address, whereas the viewport lands
    // on Rua da Barroca de Cima. Google offsets the map centre to make room for the side panel.
    const latitude = 38.9549507;
    const longitude = -8.9885174;

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

    // Mercearia do Largo, in Leiria. Production resolved this one to Southwark, London: the
    // datacenter page carries no place at all, so the coordinates came from the map viewport,
    // which is centred wherever Google geolocates the caller. The redirect chain is the fix, so
    // this asserts the country as much as the coordinates.
    test("keeps the place in the right country", async () => {
        const place = await resolveGoogleMapsPlace(
            "https://maps.app.goo.gl/e5WSmqyn4Z8unJzC9"
        );

        expect(place.name).toBe("Mercearia do Largo");
        expect(place.latitude).toBeCloseTo(39.8025986, 4);
        expect(place.longitude).toBeCloseTo(-8.098671, 4);
    }, 20000);

    test("returns null rather than throwing for an unresolvable link", async () => {
        const coordinates = await getCoordinatesFromMapsUrl(
            3,
            "https://maps.app.goo.gl/thisdoesnotexist000"
        );

        expect(coordinates).toBeNull();
    }, 20000);
});
