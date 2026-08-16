// Builds a link that opens a Google Maps URL in a *browser* rather than in the Maps app.
//
// This exists because of how Google publishes coordinates. A link shared from the Maps app
// resolves to a permalink carrying the place's name and address but no coordinates, and the page
// behind it does not contain them either — they arrive later, over an internal RPC, once Google's
// own JavaScript has run. The browser then rewrites its address bar to a URL that does have
// them. So the coordinates are reachable, but only by something running inside google.com: no
// amount of server-side fetching, and no service worker, can see across that origin boundary.
//
// The way out is to let the user's browser do the work and hand the result back. Which makes the
// target of this link the whole point: a plain https link to maps.app.goo.gl is captured by the
// Maps app on Android, and the Maps app has no address bar to copy from. Naming the browser as
// the target package is what keeps the link in a window that shows a URL.

export function isAndroid(userAgent: string): boolean {
    return /android/i.test(userAgent);
}

export function isIOS(userAgent: string): boolean {
    // iPadOS 13+ reports itself as a Mac, distinguishable only by having a touch screen. Left
    // out on purpose: iPad Safari is not where anyone shares a place from.
    return /iphone|ipad|ipod/i.test(userAgent);
}

export function buildBrowserUrl(mapsUrl: string, userAgent: string): string {
    // Anything with a fragment of its own cannot be expressed as an intent: URI, whose own
    // parameters live in the fragment. Maps links do not have one, but a hand-pasted URL might.
    const hasFragment = mapsUrl.indexOf("#") !== -1;

    if (isAndroid(userAgent) && !hasFragment) {
        const withoutScheme = mapsUrl.replace(/^https?:\/\//, "");
        // S.browser_fallback_url covers the phone with no Chrome installed: the intent fails to
        // resolve and Android follows the original link instead, which is no worse than today.
        return (
            "intent://" +
            withoutScheme +
            "#Intent;scheme=https;package=com.android.chrome;" +
            "S.browser_fallback_url=" +
            encodeURIComponent(mapsUrl) +
            ";end"
        );
    }

    if (isIOS(userAgent)) {
        // Chrome for iOS claims https links under its own scheme. googlechromes: is the https
        // one; the trailing "s" is not a typo.
        return mapsUrl.replace(/^https:\/\//, "googlechromes://");
    }

    return mapsUrl;
}
