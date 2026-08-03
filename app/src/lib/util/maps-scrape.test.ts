import { describe, expect, test } from "@jest/globals";
import * as fs from "fs";
import * as path from "path";
import {
    isValidCoordinate,
    parseAppInitState,
    parseBlobPlace,
    parseGoogleMapsHtml,
    parseOgTitle,
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
    // og:title, so the blob is the only thing left carrying the name. Production hit exactly
    // this: sources={"name":null,"coordinates":"app-init-state"}.
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

describe("parseAppInitState", () => {
    test("reads coordinates from the init blob, longitude first", () => {
        const result = parseAppInitState(FIXTURE);

        expect(result).not.toBeNull();
        expect(result!.latitude).toBeCloseTo(EXPECTED_LATITUDE, 5);
        expect(result!.longitude).toBeCloseTo(EXPECTED_LONGITUDE, 5);
    });

    test("returns null when the blob is absent", () => {
        expect(parseAppInitState("<html></html>")).toBeNull();
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
