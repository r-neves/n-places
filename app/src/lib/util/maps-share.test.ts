import { describe, expect, test } from "@jest/globals";
import {
    extractMapsUrl,
    isGoogleMapsUrl,
    parseShareParams,
} from "./maps-share";

describe("isGoogleMapsUrl", () => {
    test("accepts the short link Android's Maps app shares", () => {
        expect(isGoogleMapsUrl("https://maps.app.goo.gl/GcMfNb5CeNQ4nRsu8")).toBe(
            true
        );
    });

    test("accepts regional and legacy Maps hosts", () => {
        expect(isGoogleMapsUrl("https://maps.google.com/?q=lisbon")).toBe(true);
        expect(isGoogleMapsUrl("https://maps.google.pt/?q=lisbon")).toBe(true);
        expect(isGoogleMapsUrl("https://www.google.com/maps/place/X/@1.0,2.0")).toBe(
            true
        );
        expect(isGoogleMapsUrl("https://www.google.co.uk/maps/place/X")).toBe(true);
        expect(isGoogleMapsUrl("https://google.com.br/maps/place/X")).toBe(true);
        expect(isGoogleMapsUrl("https://goo.gl/maps/abc")).toBe(true);
        expect(isGoogleMapsUrl("https://g.co/kgs/abc")).toBe(true);
    });

    test("rejects Google URLs that are not Maps links", () => {
        expect(isGoogleMapsUrl("https://www.google.com/search?q=lisbon")).toBe(
            false
        );
        expect(isGoogleMapsUrl("https://goo.gl/abc")).toBe(false);
        expect(isGoogleMapsUrl("https://g.co/abc")).toBe(false);
    });

    // This predicate gates a server-side fetch, so lookalike hosts matter.
    test("rejects lookalike hosts", () => {
        expect(isGoogleMapsUrl("https://google.evil.com/maps/place/X")).toBe(false);
        expect(isGoogleMapsUrl("https://maps.app.goo.gl.evil.com/x")).toBe(false);
        expect(isGoogleMapsUrl("https://notgoogle.com/maps")).toBe(false);
        expect(isGoogleMapsUrl("https://maps.google.evil.com/x")).toBe(false);
    });

    test("rejects non-https and malformed input", () => {
        expect(isGoogleMapsUrl("http://maps.app.goo.gl/abc")).toBe(false);
        expect(isGoogleMapsUrl("file:///etc/passwd")).toBe(false);
        expect(isGoogleMapsUrl("not a url")).toBe(false);
        expect(isGoogleMapsUrl("")).toBe(false);
    });
});

describe("extractMapsUrl", () => {
    // The shape Android's Google Maps is documented to send.
    test("finds the link when text is 'Name\\nURL'", () => {
        expect(
            extractMapsUrl({
                text: "Xiaolongkan Hot Pot\nhttps://maps.app.goo.gl/abc",
            })
        ).toBe("https://maps.app.goo.gl/abc");
    });

    test("finds a bare link in text", () => {
        expect(extractMapsUrl({ text: "https://maps.app.goo.gl/abc" })).toBe(
            "https://maps.app.goo.gl/abc"
        );
    });

    test("finds the link mid-sentence and keeps its query string", () => {
        expect(
            extractMapsUrl({
                title: "Xiaolongkan",
                text: "Check this out https://maps.app.goo.gl/abc?g_st=ic",
            })
        ).toBe("https://maps.app.goo.gl/abc?g_st=ic");
    });

    test("reads the url field when it is the one populated", () => {
        expect(
            extractMapsUrl({
                url: "https://www.google.com/maps/place/X/@38.7,-9.1,17z",
            })
        ).toBe("https://www.google.com/maps/place/X/@38.7,-9.1,17z");
    });

    test("prefers url over text when both carry a link", () => {
        expect(
            extractMapsUrl({
                url: "https://maps.app.goo.gl/fromurl",
                text: "https://maps.app.goo.gl/fromtext",
            })
        ).toBe("https://maps.app.goo.gl/fromurl");
    });

    test("skips non-Maps links and keeps looking", () => {
        expect(
            extractMapsUrl({
                text: "https://example.com/x and https://maps.app.goo.gl/abc",
            })
        ).toBe("https://maps.app.goo.gl/abc");
    });

    test("strips trailing prose punctuation", () => {
        expect(
            extractMapsUrl({ text: "go here: https://maps.app.goo.gl/abc." })
        ).toBe("https://maps.app.goo.gl/abc");
        expect(
            extractMapsUrl({ text: "(see https://maps.app.goo.gl/abc)" })
        ).toBe("https://maps.app.goo.gl/abc");
    });

    // Someone pasting by hand may well drop the scheme.
    test("accepts a bare host with no scheme", () => {
        expect(extractMapsUrl({ text: "maps.app.goo.gl/abc" })).toBe(
            "https://maps.app.goo.gl/abc"
        );
    });

    test("returns null when there is nothing usable", () => {
        expect(extractMapsUrl({})).toBeNull();
        expect(extractMapsUrl({ text: "https://evil.example.com/x" })).toBeNull();
        expect(extractMapsUrl({ text: "just some words" })).toBeNull();
        expect(extractMapsUrl({ text: "", title: "", url: "" })).toBeNull();
    });
});

describe("parseShareParams", () => {
    test("takes the name hint from the non-URL line of text", () => {
        expect(
            parseShareParams({
                text: "Xiaolongkan Hot Pot\nhttps://maps.app.goo.gl/abc",
            })
        ).toEqual({
            mapsUrl: "https://maps.app.goo.gl/abc",
            nameHint: "Xiaolongkan Hot Pot",
        });
    });

    test("falls back to title when text is only a URL", () => {
        expect(
            parseShareParams({
                title: "Clube 1886",
                text: "https://maps.app.goo.gl/abc",
            })
        ).toEqual({
            mapsUrl: "https://maps.app.goo.gl/abc",
            nameHint: "Clube 1886",
        });
    });

    test("reports a null hint when only a link was shared", () => {
        expect(parseShareParams({ url: "https://maps.app.goo.gl/abc" })).toEqual({
            mapsUrl: "https://maps.app.goo.gl/abc",
            nameHint: null,
        });
    });

    test("still returns a hint when no link could be found", () => {
        expect(parseShareParams({ text: "Xiaolongkan Hot Pot" })).toEqual({
            mapsUrl: null,
            nameHint: "Xiaolongkan Hot Pot",
        });
    });
});
