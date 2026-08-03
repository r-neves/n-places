// Extracts a Google Maps URL out of the payload delivered by the Web Share Target API.
//
// Android's Google Maps does not commit to which share field carries the link: it is usually
// `text` (often as "Place Name\nhttps://maps.app.goo.gl/xxx"), sometimes `title`, rarely `url`.
// So every field is scanned and the first Google-Maps-looking URL wins.
//
// `isGoogleMapsUrl` is deliberately exported: it backs both the client-side "that doesn't look
// like a Maps link" check and the server-side SSRF guard in the resolve route. One definition,
// two consumers.

export interface ShareParams {
    url?: string | null;
    text?: string | null;
    title?: string | null;
}

export interface ParsedShare {
    mapsUrl: string | null;
    // Best-effort place name taken straight from the share payload. Used as the fallback name
    // when scraping the Maps page fails entirely, so the form is never completely empty.
    nameHint: string | null;
}

// Matches an http(s) URL up to the first whitespace or quote/bracket character.
const URL_PATTERN = /https?:\/\/[^\s<>"']+/g;

// Punctuation that commonly trails a URL pasted into prose ("...see https://x.co/y.").
const TRAILING_PUNCTUATION = /[.,;:!?)\]}>'"]+$/;

// Google serves Maps from a lot of hostnames. The shapes accepted here are, deliberately, only
// the ones that can carry a place link:
//   maps.app.goo.gl/xxx     - what Android's Maps app actually shares
//   goo.gl/maps/xxx         - the legacy short form
//   g.co/kgs/xxx            - knowledge-graph short links
//   maps.google.<tld>/...   - the regional Maps hosts
//   google.<tld>/maps/...   - Maps served under the main search domain
//
// The <tld> pattern is intentionally strict (`com`, a two-letter ccTLD, or `co`/`com` + ccTLD)
// rather than something like [a-z.]+ — a loose pattern would accept an attacker-controlled
// `google.evil.com`, and this predicate gates a server-side fetch.
const GOOGLE_TLD = "(?:com|[a-z]{2}|com?\\.[a-z]{2})";
const MAPS_GOOGLE_HOST = new RegExp("^maps\\.google\\." + GOOGLE_TLD + "$");
const GOOGLE_HOST = new RegExp("^google\\." + GOOGLE_TLD + "$");

export function isGoogleMapsUrl(candidate: string): boolean {
    let parsed: URL;

    try {
        parsed = new URL(candidate);
    } catch (e) {
        return false;
    }

    // Only https: an http link would be silently upgraded or downgraded by the redirect chain,
    // and there is no legitimate reason for a shared Maps link to be plaintext.
    if (parsed.protocol !== "https:") {
        return false;
    }

    const host = parsed.hostname.toLowerCase().replace(/^www\./, "");
    const path = parsed.pathname;

    if (host === "maps.app.goo.gl") {
        return true;
    }

    if (host === "goo.gl") {
        return path.indexOf("/maps") === 0;
    }

    if (host === "g.co") {
        return path.indexOf("/kgs") === 0;
    }

    if (MAPS_GOOGLE_HOST.test(host)) {
        return true;
    }

    if (GOOGLE_HOST.test(host)) {
        return path.indexOf("/maps") === 0;
    }

    return false;
}

// Pulls every http(s) URL out of a string, trimming trailing prose punctuation.
function findUrls(value: string): string[] {
    const matches = value.match(URL_PATTERN);
    if (matches === null) {
        return [];
    }

    return matches.map((match) => match.replace(TRAILING_PUNCTUATION, ""));
}

export function extractMapsUrl(params: ShareParams): string | null {
    const candidates = [params.url, params.text, params.title];

    for (let i = 0; i < candidates.length; i++) {
        const candidate = candidates[i];
        if (!candidate) {
            continue;
        }

        const urls = findUrls(candidate);
        for (let j = 0; j < urls.length; j++) {
            if (isGoogleMapsUrl(urls[j])) {
                return urls[j];
            }
        }
    }

    // Nothing with a scheme matched. Someone pasting a link by hand may well have dropped the
    // "https://", so give a bare host one more chance before giving up.
    for (let i = 0; i < candidates.length; i++) {
        const candidate = candidates[i];
        if (!candidate) {
            continue;
        }

        const bare = candidate.trim().replace(TRAILING_PUNCTUATION, "");
        if (bare.length === 0 || /\s/.test(bare) || bare.indexOf("://") !== -1) {
            continue;
        }

        const withScheme = "https://" + bare;
        if (isGoogleMapsUrl(withScheme)) {
            return withScheme;
        }
    }

    return null;
}

function looksLikeUrl(value: string): boolean {
    return /https?:\/\//.test(value);
}

export function parseShareParams(params: ShareParams): ParsedShare {
    const mapsUrl = extractMapsUrl(params);

    let nameHint: string | null = null;

    // Android typically sends "Place Name\nhttps://maps.app.goo.gl/xxx" in `text`, so the first
    // line that isn't itself a URL is a decent guess at the place name.
    if (params.text) {
        const lines = params.text.split("\n");
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            if (line.length > 0 && !looksLikeUrl(line)) {
                nameHint = line;
                break;
            }
        }
    }

    if (nameHint === null && params.title) {
        const title = params.title.trim();
        if (title.length > 0 && !looksLikeUrl(title)) {
            nameHint = title;
        }
    }

    return { mapsUrl: mapsUrl, nameHint: nameHint };
}
