import { describe, expect, test } from "@jest/globals";
import { normalizeMapsUrl } from "./format";

describe("normalizeMapsUrl", () => {
    test("treats different share-link formats for the same place as equal", () => {
        const a = normalizeMapsUrl("https://maps.app.goo.gl/8diDjjA6Vxte8AYG8");
        const b = normalizeMapsUrl("https://maps.app.goo.gl/8diDjjA6Vxte8AYG8/");
        const c = normalizeMapsUrl(
            "http://maps.app.goo.gl/8diDjjA6Vxte8AYG8?g_ep=tracking"
        );

        expect(a).toBe(b);
        expect(a).toBe(c);
    });

    test("treats different places as different", () => {
        const a = normalizeMapsUrl("https://maps.app.goo.gl/8diDjjA6Vxte8AYG8");
        const b = normalizeMapsUrl("https://maps.app.goo.gl/GcMfNb5CeNQ4nRsu8");

        expect(a).not.toBe(b);
    });

    test("falls back to a lowercased/trimmed string for unparseable urls", () => {
        expect(normalizeMapsUrl("  Not A Url  ")).toBe("not a url");
    });
});
