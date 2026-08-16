import { describe, expect, test } from "@jest/globals";
import { buildBrowserUrl, isAndroid, isIOS } from "./open-in-browser";

const ANDROID =
    "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36";
const IPHONE =
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";
const DESKTOP =
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36";

const SHORT_LINK = "https://maps.app.goo.gl/mA3Yy2DizAz8chFh8";

describe("buildBrowserUrl", () => {
    // The whole point of the Android branch. A plain https link to a Maps URL is claimed by the
    // Maps app, which shows no address bar — so there is nothing for the user to copy, and the
    // recovery flow dead-ends. Naming the browser package is what keeps it in a window with a URL.
    test("hands Android an intent aimed at Chrome rather than the Maps app", () => {
        const result = buildBrowserUrl(SHORT_LINK, ANDROID);

        expect(result).toContain("intent://maps.app.goo.gl/mA3Yy2DizAz8chFh8");
        expect(result).toContain("package=com.android.chrome");
        expect(result).toContain("scheme=https");
        expect(result.endsWith(";end")).toBe(true);
    });

    test("gives Android a fallback for a phone with no Chrome installed", () => {
        const result = buildBrowserUrl(SHORT_LINK, ANDROID);

        expect(result).toContain(
            "S.browser_fallback_url=" + encodeURIComponent(SHORT_LINK)
        );
    });

    test("uses Chrome's own scheme on iOS", () => {
        expect(buildBrowserUrl(SHORT_LINK, IPHONE)).toBe(
            "googlechromes://maps.app.goo.gl/mA3Yy2DizAz8chFh8"
        );
    });

    test("leaves the link alone everywhere else", () => {
        expect(buildBrowserUrl(SHORT_LINK, DESKTOP)).toBe(SHORT_LINK);
        // No user agent yet is the server render and the first client render.
        expect(buildBrowserUrl(SHORT_LINK, "")).toBe(SHORT_LINK);
    });

    // An intent: URI carries its own parameters in the fragment, so a URL that already has one
    // cannot be expressed as an intent without mangling it. Falling back to the plain link is
    // worse for the user than the intent, and far better than a broken one.
    test("falls back to the plain link when the URL has a fragment of its own", () => {
        const withFragment = "https://www.google.com/maps/place/X/@1.5,2.5#panel";

        expect(buildBrowserUrl(withFragment, ANDROID)).toBe(withFragment);
    });

    test("survives the long permalink form intact", () => {
        const permalink =
            "https://www.google.com/maps/place/Mercearia+do+Largo,+Tv.+S%C3%A3o+Sebasti%C3%A3o+6," +
            "+6100-737+Sert%C3%A3/data=!4m2!3m1!1s0xd22a2484bce43d5:0xd4981929fd7f8624!18m1!1e1" +
            "?utm_source=mstt_1&entry=gps";

        const result = buildBrowserUrl(permalink, ANDROID);

        expect(result).toContain("!4m2!3m1!1s0xd22a2484bce43d5");
        expect(result).toContain("?utm_source=mstt_1&entry=gps#Intent;");
    });
});

describe("platform detection", () => {
    test("recognises the platforms it branches on", () => {
        expect(isAndroid(ANDROID)).toBe(true);
        expect(isAndroid(IPHONE)).toBe(false);
        expect(isIOS(IPHONE)).toBe(true);
        expect(isIOS(ANDROID)).toBe(false);
        expect(isIOS(DESKTOP)).toBe(false);
        expect(isAndroid("")).toBe(false);
    });
});
