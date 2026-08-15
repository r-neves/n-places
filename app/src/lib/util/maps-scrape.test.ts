import { describe, expect, test } from "@jest/globals";
import * as fs from "fs";
import * as path from "path";
import {
    isValidCoordinate,
    parseBlobPlace,
    parseGoogleMapsHtml,
    parseOgTitle,
    parsePlacePin,
    parsePlaceUrl,
} from "./maps-scrape";

// A real Google Maps response, captured Aug 2024. Everything below parses this rather than the
// network, so the suite stays deterministic.
const FIXTURE = fs.readFileSync(
    path.join(__dirname, "../../../backup/maps_resp_example.txt"),
    "utf8"
);

const EXPECTED_NAME = "Xiaolongkan Hot Pot 小龙坎火锅";
const EXPECTED_LATITUDE = 38.767198;
const EXPECTED_LONGITUDE = -9.0991259;

// The Location header maps.app.goo.gl/e5WSmqyn4Z8unJzC9 answers with, verbatim. Captured from
// both a home connection and a datacenter IP: the 302 is byte-identical from either, which is
// what makes the redirect chain the one dependable source of the place.
const MERCEARIA_PERMALINK =
    "https://www.google.com/maps/place/Mercearia+do+Largo/@39.8025986,-8.098671,17z/" +
    "data=!3m1!4b1!4m6!3m5!1s0xd22a2484bce43d5:0xd4981929fd7f8624!8m2!3d39.8025986!4d-8.098671" +
    "!16s%2Fg%2F11c2nz8gyr!18m1!1e1?entry=tts";

describe("parseGoogleMapsHtml", () => {
    test("extracts name, address and coordinates from the captured response", () => {
        const result = parseGoogleMapsHtml(FIXTURE);

        expect(result.name).toBe(EXPECTED_NAME);
        expect(result.address).toContain("Avenida Dom João II");
        expect(result.latitude).toBeCloseTo(EXPECTED_LATITUDE, 5);
        expect(result.longitude).toBeCloseTo(EXPECTED_LONGITUDE, 5);
    });

    // The bug this module replaces: the old scraper searched for "%40", which this response does
    // not contain, so parseFloat received garbage and wrote NaN (serialised as null) to Notion.
    test("returns finite coordinates for a response containing no %40", () => {
        expect(FIXTURE).not.toContain("%40");

        const result = parseGoogleMapsHtml(FIXTURE);

        expect(Number.isFinite(result.latitude as number)).toBe(true);
        expect(Number.isFinite(result.longitude as number)).toBe(true);
    });

    test("reports which parser produced each field", () => {
        const result = parseGoogleMapsHtml(FIXTURE);

        expect(result.sources.name).toBe("og:title");
        expect(result.sources.address).toBe("og:title");
        expect(result.sources.coordinates).toBe("place-url");
    });

    test("prefers the resolved URL for coordinates when one is supplied", () => {
        const result = parseGoogleMapsHtml(
            FIXTURE,
            "https://www.google.com/maps/place/Clube+1886/@38.9549507,-8.9910923,17z/data=x"
        );

        expect(result.sources.coordinates).toBe("final-url");
        expect(result.latitude).toBeCloseTo(38.9549507, 5);
        expect(result.longitude).toBeCloseTo(-8.9910923, 5);
        // og:title still wins for the name, since it separates name from address explicitly.
        expect(result.name).toBe(EXPECTED_NAME);
    });

    // The bug: Mercearia do Largo, a grocer in Leiria, came back pinned at 51.489,-0.088 —
    // Southwark, London. Nothing in the lean page Google serves to Vercel identifies the place,
    // so the coordinates fell through to APP_INITIALIZATION_STATE's leading triple, which is the
    // map viewport — centred on where Google geolocates the *caller*, i.e. the datacenter.
    describe("the lean page Google serves to a datacenter IP", () => {
        // No canonical place URL, no og:title, no blob, and a viewport sitting in London.
        const LEAN_PAGE =
            '<meta content="Google Maps" property="og:title">' +
            "window.APP_INITIALIZATION_STATE=[[[17.1,-0.0881552,51.4893323],null];";

        test("never yields the viewport centre as the place's coordinates", () => {
            const result = parseGoogleMapsHtml(LEAN_PAGE);

            expect(result.latitude).toBeNull();
            expect(result.longitude).toBeNull();
            expect(result.sources.coordinates).toBeNull();
        });

        test("recovers the real place from the redirect that led to it", () => {
            const result = parseGoogleMapsHtml(
                LEAN_PAGE,
                "https://www.google.com/maps/place//data=!4m2!3m1!1s0xd22a2484bce43d5",
                ["https://maps.app.goo.gl/e5WSmqyn4Z8unJzC9", MERCEARIA_PERMALINK]
            );

            expect(result.name).toBe("Mercearia do Largo");
            expect(result.sources.name).toBe("redirect-url");
            // Leiria, Portugal — not London.
            expect(result.latitude).toBeCloseTo(39.8025986, 5);
            expect(result.longitude).toBeCloseTo(-8.098671, 5);
            expect(result.sources.coordinates).toBe("place-pin");
        });
    });

    // Google's canonical permalink for a place often has an empty name segment, which the
    // previous pattern required to be non-empty — so those coordinates were skipped entirely.
    test("reads coordinates from a place URL with no name segment", () => {
        const result = parseGoogleMapsHtml(
            "",
            "https://www.google.com/maps/place//@39.8025986,-8.098671,17z/data=x"
        );

        expect(result.name).toBeNull();
        expect(result.latitude).toBeCloseTo(39.8025986, 5);
        expect(result.sources.coordinates).toBe("final-url");
    });

    // "@lat,lng" is where the map was pointed; "!3d/!4d" is the pin. They usually agree, and
    // when they do not the pin is the place.
    test("prefers the data-parameter pin over the viewport in the same URL", () => {
        const result = parseGoogleMapsHtml("", MERCEARIA_PERMALINK);

        expect(result.sources.coordinates).toBe("place-pin");
        expect(result.latitude).toBeCloseTo(39.8025986, 5);
        expect(result.longitude).toBeCloseTo(-8.098671, 5);
    });

    test("degrades to all-nulls instead of throwing on unusable input", () => {
        const empty = parseGoogleMapsHtml("");

        expect(empty.name).toBeNull();
        expect(empty.address).toBeNull();
        expect(empty.latitude).toBeNull();
        expect(empty.longitude).toBeNull();
        expect(empty.sources.coordinates).toBeNull();

        expect(() => parseGoogleMapsHtml("<html><body>nope</body></html>")).not.toThrow();
    });

    test("treats the generic 'Google Maps' title as no name at all", () => {
        const result = parseGoogleMapsHtml(
            '<meta content="Google Maps" property="og:title">'
        );

        expect(result.name).toBeNull();
    });

    test("falls back to the URL segment for the name when og:title is absent", () => {
        const html =
            'x /maps/place/Clube+1886,+Rua+Teste/@38.9549507,-8.9910923,17z y';
        const result = parseGoogleMapsHtml(html);

        expect(result.name).toBe("Clube 1886");
        expect(result.address).toBe("Rua Teste");
        expect(result.sources.name).toBe("place-url");
    });
});

describe("parseOgTitle", () => {
    test("splits the captured title into name and address", () => {
        const result = parseOgTitle(FIXTURE);

        expect(result).not.toBeNull();
        expect(result!.name).toBe(EXPECTED_NAME);
        expect(result!.address).toContain("Avenida Dom João II");
        expect(result!.address).toContain("1990-233 Lisboa");
    });

    // In the captured response `content=` precedes `property=`, which defeats an
    // attribute-order-sensitive regex — hence the real HTML parser.
    test("finds the tag regardless of attribute order", () => {
        const before = parseOgTitle('<meta content="A · B" property="og:title">');
        const after = parseOgTitle('<meta property="og:title" content="A · B">');

        expect(before).toEqual({ name: "A", address: "B" });
        expect(after).toEqual({ name: "A", address: "B" });
    });

    test("returns a null address when the title carries no separator", () => {
        expect(parseOgTitle('<meta property="og:title" content="Just A Name">')).toEqual(
            { name: "Just A Name", address: null }
        );
    });

    test("returns null when there is no usable title", () => {
        expect(parseOgTitle("")).toBeNull();
        expect(parseOgTitle("<html></html>")).toBeNull();
        expect(parseOgTitle('<meta property="og:title" content="">')).toBeNull();
        expect(parseOgTitle('<meta property="og:title" content="Google Maps">')).toBeNull();
    });
});

describe("parsePlaceUrl", () => {
    test("reads name, address and coordinates out of the captured response", () => {
        const result = parsePlaceUrl(FIXTURE);

        expect(result).not.toBeNull();
        expect(result!.name).toBe(EXPECTED_NAME);
        expect(result!.address).toContain("Avenida Dom João II");
        expect(result!.latitude).toBeCloseTo(EXPECTED_LATITUDE, 5);
        expect(result!.longitude).toBeCloseTo(EXPECTED_LONGITUDE, 5);
    });

    test("accepts both the plain and preview URL forms, and both @ and %40", () => {
        expect(parsePlaceUrl("/maps/place/A/@1.5,2.5")!.latitude).toBeCloseTo(1.5, 5);
        expect(parsePlaceUrl("/maps/preview/place/A/@1.5,2.5")!.latitude).toBeCloseTo(
            1.5,
            5
        );
        expect(parsePlaceUrl("/maps/place/A/%401.5,2.5")!.longitude).toBeCloseTo(
            2.5,
            5
        );
    });

    test("decodes percent-encoded and plus-encoded segments", () => {
        const result = parsePlaceUrl("/maps/place/Caf%C3%A9+Central/@1.5,2.5");

        expect(result!.name).toBe("Café Central");
    });

    // Inside the page body Google double-encodes the segment, so "%2B" arrives where the
    // canonical URL would use "+". Observed live, Nov 2025.
    test("decodes a double-encoded segment", () => {
        const result = parsePlaceUrl(
            "/maps/place/Restaurante%2BClube%2B1886%2B-%2BVila%2BFranca%2Bde%2BXira/@38.9549507,-8.9910923"
        );

        expect(result!.name).toBe("Restaurante Clube 1886 - Vila Franca de Xira");
    });

    test("keeps a plus sign that is part of the name", () => {
        const result = parsePlaceUrl("/maps/place/Bar+24%2B+Lisboa/@1.5,2.5");

        expect(result!.name).toBe("Bar 24+ Lisboa");
    });

    test("survives a malformed percent sequence without throwing", () => {
        const result = parsePlaceUrl("/maps/place/bad%ZZname/@1.5,2.5");

        expect(result).not.toBeNull();
        expect(result!.name).toBeNull();
        expect(result!.latitude).toBeCloseTo(1.5, 5);
    });

    test("returns null when there is no place URL or the coordinates are unusable", () => {
        expect(parsePlaceUrl("")).toBeNull();
        expect(parsePlaceUrl("https://example.com/nothing")).toBeNull();
        expect(parsePlaceUrl("/maps/place/A/@0.0,0.0")).toBeNull();
        expect(parsePlaceUrl("/maps/place/A/@999.0,2.5")).toBeNull();
    });
});

describe("parseBlobPlace", () => {
    test("reads the name and coordinates out of the JS blob", () => {
        const result = parseBlobPlace(FIXTURE);

        expect(result).not.toBeNull();
        expect(result!.name).toBe(EXPECTED_NAME);
        expect(result!.address).toBeNull();
        expect(result!.latitude).toBeCloseTo(EXPECTED_LATITUDE, 5);
        expect(result!.longitude).toBeCloseTo(EXPECTED_LONGITUDE, 5);
    });

    // Observed live: the blob label is sometimes "<name>, <address>" rather than just the name,
    // which is currently the only place an address is available at all.
    test("splits a label that carries the address too", () => {
        const result = parseBlobPlace(
            'x\\"Lupita Pizzaria Alvalade, Av. da Igreja 15D, 1700-237 Lisboa\\",[[3102.64,-9.0472448,38.8923392]'
        );

        expect(result!.name).toBe("Lupita Pizzaria Alvalade");
        expect(result!.address).toBe("Av. da Igreja 15D, 1700-237 Lisboa");
    });

    test("returns null when the blob is absent or the coordinates are unusable", () => {
        expect(parseBlobPlace("<html></html>")).toBeNull();
        expect(parseBlobPlace('x \\"Somewhere\\",[[10.0,0.0,0.0] y')).toBeNull();
    });

    // The page Google serves to a datacenter IP has no canonical /maps/place/ URL and no usable
    // og:title, so when the redirect chain is unavailable too the blob is the only thing left
    // carrying the name. Production hit exactly this:
    // sources={"name":null,"coordinates":"app-init-state"}.
    test("supplies the name when no place URL or og:title is available", () => {
        const leanPage =
            '<meta content="Google Maps" property="og:title">' +
            'window.APP_INITIALIZATION_STATE=[[[12443.39,-9.0991259,38.767198],null];' +
            'x\\"Xiaolongkan Hot Pot\\",[[3102.64,-9.0991259,38.767198],null,[1024,768],13.1]';

        const result = parseGoogleMapsHtml(leanPage);

        expect(result.name).toBe("Xiaolongkan Hot Pot");
        expect(result.sources.name).toBe("blob");
        expect(result.latitude).toBeCloseTo(38.767198, 5);
        // The place's own triple beats the viewport centre from APP_INITIALIZATION_STATE.
        expect(result.sources.coordinates).toBe("blob");
    });
});

describe("parsePlacePin", () => {
    test("reads the pin out of a permalink's data parameter", () => {
        const result = parsePlacePin(MERCEARIA_PERMALINK);

        expect(result).not.toBeNull();
        expect(result!.latitude).toBeCloseTo(39.8025986, 5);
        expect(result!.longitude).toBeCloseTo(-8.098671, 5);
    });

    test("returns null when there is no pin or it is unusable", () => {
        expect(parsePlacePin("<html></html>")).toBeNull();
        expect(parsePlacePin("/data=!8m2!3d0.0!4d0.0")).toBeNull();
        expect(parsePlacePin("/data=!8m2!3d999.0!4d1.5")).toBeNull();
    });
});

describe("isValidCoordinate", () => {
    test("rejects the values that made the old scraper corrupt data", () => {
        expect(isValidCoordinate(NaN, 5)).toBe(false);
        expect(isValidCoordinate(5, NaN)).toBe(false);
        expect(isValidCoordinate(Infinity, 5)).toBe(false);
        // Null Island is a parse failure, never a restaurant.
        expect(isValidCoordinate(0, 0)).toBe(false);
    });

    test("rejects out-of-range values", () => {
        expect(isValidCoordinate(91, 0)).toBe(false);
        expect(isValidCoordinate(-91, 0)).toBe(false);
        expect(isValidCoordinate(0, 181)).toBe(false);
        expect(isValidCoordinate(0, -181)).toBe(false);
    });

    test("accepts real coordinates", () => {
        expect(isValidCoordinate(EXPECTED_LATITUDE, EXPECTED_LONGITUDE)).toBe(true);
        expect(isValidCoordinate(-33.8688, 151.2093)).toBe(true);
    });
});
