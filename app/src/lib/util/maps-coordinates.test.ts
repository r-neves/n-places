import { describe, expect, test } from "@jest/globals";
import { parseCoordinatesFromUrl } from "./maps-coordinates";

// Exactly what the address bar holds after Google's own JavaScript has resolved a Maps-app share
// link — the URL the add screen asks the user to copy back. Both coordinate forms are present,
// and they disagree: "@" is the viewport, "!3d/!4d" is the pin.
const REWRITTEN =
    "https://www.google.com/maps/place/Mercearia+do+Largo/@39.8025986,-8.098671,17z/" +
    "data=!3m1!4b1!4m6!3m5!1s0xd22a2484bce43d5:0xd4981929fd7f8624!8m2!3d39.8025986!4d-8.098671" +
    "!16s%2Fg%2F11c2nz8gyr!18m1!1e1?entry=ttu";

describe("parseCoordinatesFromUrl", () => {
    test("reads the coordinates out of the URL Maps rewrites itself to", () => {
        const result = parseCoordinatesFromUrl(REWRITTEN);

        expect(result).not.toBeNull();
        expect(result!.latitude).toBeCloseTo(39.8025986, 5);
        expect(result!.longitude).toBeCloseTo(-8.098671, 5);
    });

    // Clube 1886: the pin and the viewport sit 220m apart, and the pin is the restaurant.
    test("prefers the pin over the viewport when the two disagree", () => {
        const result = parseCoordinatesFromUrl(
            "https://www.google.com/maps/place/Clube+1886/@38.9549507,-8.9910923,17z/" +
                "data=!4m6!3m5!8m2!3d38.9549507!4d-8.9885174"
        );

        expect(result!.longitude).toBeCloseTo(-8.9885174, 5);
    });

    test("falls back to the viewport when there is no pin", () => {
        const result = parseCoordinatesFromUrl(
            "https://www.google.com/maps/place/Clube+1886/@38.9549507,-8.9910923,17z/data=x"
        );

        expect(result!.longitude).toBeCloseTo(-8.9910923, 5);
    });

    // People copy whatever the address bar hands them, sometimes with a title or a newline
    // attached, so this takes free text rather than a tidy URL.
    test("finds the coordinates inside surrounding text", () => {
        const result = parseCoordinatesFromUrl(
            "Mercearia do Largo - Google Maps\n" + REWRITTEN + "\n"
        );

        expect(result!.latitude).toBeCloseTo(39.8025986, 5);
    });

    // The link before the browser has resolved it — pasting it back changes nothing, and the
    // screen has to be able to say so rather than fill the fields with a wrong answer.
    test("returns null for the app-share link that started all this", () => {
        expect(
            parseCoordinatesFromUrl(
                "https://www.google.com/maps/place/Mercearia+do+Largo,+Tv.+S%C3%A3o+Sebasti%C3%A3o+6," +
                    "+6100-737+Sert%C3%A3/data=!4m2!3m1!1s0xd22a2484bce43d5:0xd4981929fd7f8624!18m1!1e1"
            )
        ).toBeNull();

        expect(
            parseCoordinatesFromUrl("https://maps.app.goo.gl/mA3Yy2DizAz8chFh8")
        ).toBeNull();
    });

    test("rejects unusable values rather than passing them through", () => {
        expect(parseCoordinatesFromUrl("")).toBeNull();
        expect(parseCoordinatesFromUrl("not a link at all")).toBeNull();
        expect(parseCoordinatesFromUrl("/maps/place/A/@0.0,0.0")).toBeNull();
        expect(parseCoordinatesFromUrl("/data=!8m2!3d999.0!4d1.5")).toBeNull();
    });
});
