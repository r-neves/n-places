"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import styles from "@/components/placeForm/place-form.module.css";
import TypeSelect from "@/components/placeForm/TypeSelect";
import OptionChips from "@/components/placeForm/OptionChips";
import RecommenderInput from "@/components/placeForm/RecommenderInput";
import {
    intersectWithKnownTypes,
    lookupColor,
    schemaOptions,
} from "@/components/placeForm/schema-options";
import { UserRole } from "@/lib/constants/enums";
import { GoogleMapsMarker } from "@/lib/constants/svg";
import { PriceMap, RatingMap, RestaurantTypeMap } from "@/components/restaurant-items";
import { extractMapsUrl, parseShareParams } from "@/lib/util/maps-share";
import { parseCoordinatesFromUrl } from "@/lib/util/maps-coordinates";
import { buildBrowserUrl } from "@/lib/util/open-in-browser";
import { DatabaseSchema, Restaurant } from "@/lib/places/domain/restaurant";

type Phase =
    | "authChecking"
    | "denied"
    | "noLink"
    | "resolving"
    | "review"
    | "saving"
    | "saved";

interface ResolveResponse {
    status: "ok" | "partial" | "failed";
    resolvedUrl: string;
    name: string | null;
    address: string | null;
    coordinates: { latitude: number; longitude: number } | null;
    missing: string[];
    warning?: string;
}

// Client-side ceiling on the resolve call. The server has its own 8s fetch timeout, but a hung
// connection must never leave the user stuck on a skeleton with no way forward.
const RESOLVE_TIMEOUT_MS = 10000;
const SAVED_REDIRECT_MS = 1200;

// The database stores neighbourhood-style locations ("Parque das Nações, Lisboa"), but a scrape
// returns a full street address. Offers the trailing comma-parts as one-tap shortenings so new
// rows stay consistent with the existing ones.
function locationSuggestions(address: string): string[] {
    const parts = address
        .split(",")
        .map((part) => part.trim())
        .filter((part) => part.length > 0);

    if (parts.length < 2) {
        return [];
    }

    const suggestions: string[] = [];
    const lastTwo = parts.slice(-2).join(", ");
    if (lastTwo !== address) {
        suggestions.push(lastTwo);
    }

    const last = parts[parts.length - 1];
    if (last !== lastTwo && last !== address) {
        suggestions.push(last);
    }

    return suggestions;
}

export default function AddPlaceScreen() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { data: session, status: sessionStatus } = useSession();

    const [phase, setPhase] = useState<Phase>("authChecking");
    const [userRole, setUserRole] = useState<string | null>(null);
    const [schema, setSchema] = useState<DatabaseSchema | null>(null);
    const [recommenderOptions, setRecommenderOptions] = useState<string[]>([]);

    const [name, setName] = useState("");
    const [location, setLocation] = useState("");
    const [mapsUrl, setMapsUrl] = useState("");
    const [latitude, setLatitude] = useState("");
    const [longitude, setLongitude] = useState("");
    const [rating, setRating] = useState("");
    const [dishPrice, setDishPrice] = useState("");
    const [tags, setTags] = useState<string[]>([]);
    const [ambience, setAmbience] = useState<string[]>([]);
    const [recommender, setRecommender] = useState("");
    const [description, setDescription] = useState("");

    const [autoFields, setAutoFields] = useState<string[]>([]);
    const [missingFields, setMissingFields] = useState<string[]>([]);
    const [scrapedAddress, setScrapedAddress] = useState("");
    const [warning, setWarning] = useState<string | null>(null);
    const [saveError, setSaveError] = useState<string | null>(null);
    const [duplicate, setDuplicate] = useState<Restaurant | null>(null);
    const [saved, setSaved] = useState<Restaurant | null>(null);
    const [pasteValue, setPasteValue] = useState("");
    const [pasteError, setPasteError] = useState<string | null>(null);
    // The link the resolve settled on, kept so the "open in a browser" recovery can point at the
    // permalink rather than the short link. Never written back over mapsUrl — see applyResolved.
    const [resolvedUrl, setResolvedUrl] = useState("");
    const [coordPaste, setCoordPaste] = useState("");
    const [coordPasteError, setCoordPasteError] = useState<string | null>(null);
    const [statusLine, setStatusLine] = useState("Reading the link…");
    // Resolved in an effect rather than inline: `navigator` does not exist during the server
    // render, so branching on it directly would produce a hydration mismatch.
    const [canReadClipboard, setCanReadClipboard] = useState(false);
    // Same reason: buildBrowserUrl branches on the platform, and reading navigator during the
    // server render would make the first client render disagree with the markup. Empty until the
    // effect runs, which buildBrowserUrl treats as "just use the plain link".
    const [userAgent, setUserAgent] = useState("");

    // Guards the resolve effect so it fires once per share, not on every render.
    const resolveStarted = useRef(false);

    const share = useMemo(
        () =>
            parseShareParams({
                url: searchParams.get("url"),
                text: searchParams.get("text"),
                title: searchParams.get("title"),
            }),
        [searchParams]
    );

    const ratingOptions = useMemo(
        () => schemaOptions(schema, "rating"),
        [schema]
    );
    const typeOptions = useMemo(
        () => intersectWithKnownTypes(schemaOptions(schema, "type")),
        [schema]
    );
    const priceOptions = useMemo(
        () => schemaOptions(schema, "dish price"),
        [schema]
    );
    const ambienceOptions = useMemo(
        () => schemaOptions(schema, "ambience"),
        [schema]
    );

    // What Android actually sends is the least predictable part of this flow, so it gets logged
    // in development to make the real payloads easy to read off a connected device.
    useEffect(() => {
        if (process.env.NODE_ENV === "development") {
            console.debug(
                "Share target params: %s",
                JSON.stringify(Object.fromEntries(searchParams.entries()))
            );
        }
    }, [searchParams]);

    useEffect(() => {
        setCanReadClipboard(
            typeof navigator !== "undefined" &&
                !!navigator.clipboard &&
                typeof navigator.clipboard.readText === "function"
        );
        setUserAgent(
            typeof navigator !== "undefined" ? navigator.userAgent : ""
        );
    }, []);

    useEffect(() => {
        if (sessionStatus === "loading") {
            return;
        }

        if (!session || !session.user || !session.user.email) {
            setUserRole(UserRole.VIEWER);
            return;
        }

        fetch("/api/auth/getRole", {
            method: "POST",
            body: JSON.stringify({ email: session.user.email }),
        })
            .then((response) => response.json())
            .then((role: string) => {
                setUserRole(role === "" ? UserRole.VIEWER : role);
            })
            .catch((error) => {
                console.error("Error fetching role:", error);
                setUserRole(UserRole.VIEWER);
            });
        // The recommender is deliberately NOT pre-filled with the signed-in user's name. Most
        // places are added on someone else's suggestion, so a prefilled name is wrong more often
        // than it is right — and being already filled in, it is the field most likely to be
        // scrolled past without a second look.
    }, [sessionStatus, session]);

    const applyResolved = useCallback((data: ResolveResponse, nameHint: string | null) => {
        // Android puts the place name in the share text ("Name\nhttps://..."), which is worth
        // falling back to whenever the scrape comes back without one — Google serves a leaner
        // page to datacenter IPs than to a phone, so a null name here is routine in production
        // rather than exceptional.
        const resolvedName = data.name || nameHint;
        if (resolvedName) {
            setName(resolvedName);
        }
        if (data.address) {
            setScrapedAddress(data.address);
            setLocation(data.address);
        }
        if (data.coordinates) {
            setLatitude(String(data.coordinates.latitude));
            setLongitude(String(data.coordinates.longitude));
        }
        setResolvedUrl(data.resolvedUrl || "");

        // Note the resolved URL is deliberately NOT written back over mapsUrl. What gets saved
        // is the short link that was shared, because the resolved one carries per-request
        // tracking parameters (entry, g_ep, skid) that expire, differ on every lookup — which
        // would defeat duplicate detection — and do not match the maps.app.goo.gl form every
        // existing row in the database uses.

        // A name taken from the share payload still counts as filled in for you, so it gets the
        // same AUTO badge and drops out of the "add this" list.
        const auto: string[] = [];
        if (resolvedName) auto.push("name");
        if (data.address) auto.push("location");
        if (data.coordinates) auto.push("coordinates");

        setAutoFields(auto);
        // The API talks about the place's "address"; this form calls that field "location", so
        // the names have to be translated or the amber prompt never lands on the input.
        setMissingFields(
            (data.missing || [])
                .filter((field) => !(field === "name" && resolvedName))
                .map((field) => (field === "address" ? "location" : field))
        );
        setWarning(data.warning || null);
    }, []);

    const resolve = useCallback(
        async (url: string, nameHint: string | null) => {
            setPhase("resolving");
            setMapsUrl(url);
            setWarning(null);
            setStatusLine("Reading the link…");

            const timer = setTimeout(
                () => setStatusLine("Finding the place…"),
                1200
            );
            const abort = new AbortController();
            const timeout = setTimeout(
                () => abort.abort(),
                RESOLVE_TIMEOUT_MS
            );

            try {
                const response = await fetch("/api/restaurants/resolve", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ mapsUrl: url }),
                    signal: abort.signal,
                });

                if (!response.ok) {
                    throw new Error("resolve failed: " + response.status);
                }

                applyResolved(await response.json(), nameHint);
            } catch (e) {
                console.warn("Could not resolve the shared link:", e);
                // A failed lookup is never fatal: the link is kept and the form opens empty.
                setMissingFields(["name", "location", "coordinates"]);
                setWarning(
                    "Could not read the place from Google. Fill the details in below."
                );
                if (nameHint) {
                    setName(nameHint);
                }
            } finally {
                clearTimeout(timer);
                clearTimeout(timeout);
                setPhase("review");
            }
        },
        [applyResolved]
    );

    // Schema and resolve are fired together rather than in sequence: the schema almost always
    // wins the race, so the chip rows are live and tappable while the scrape is still running.
    useEffect(() => {
        if (userRole !== UserRole.ADMIN) {
            return;
        }

        fetch("/api/restaurants/schema")
            .then((response) => response.json())
            .then((data: DatabaseSchema) => setSchema(data))
            .catch((error) =>
                console.error("Error fetching database schema:", error)
            );

        // Recommender is free text in Notion, so its suggestions come from the names already
        // saved rather than from the schema. Never fatal — an empty list just means no
        // autocomplete.
        fetch("/api/restaurants/recommenders")
            .then((response) => (response.ok ? response.json() : []))
            .then((names: string[]) =>
                setRecommenderOptions(Array.isArray(names) ? names : [])
            )
            .catch((error) =>
                console.warn("Error fetching recommenders:", error)
            );
    }, [userRole]);

    useEffect(() => {
        if (userRole === null) {
            return;
        }

        if (userRole !== UserRole.ADMIN) {
            setPhase("denied");
            return;
        }

        if (resolveStarted.current) {
            return;
        }
        resolveStarted.current = true;

        if (share.mapsUrl) {
            resolve(share.mapsUrl, share.nameHint);
        } else {
            if (share.nameHint) {
                setName(share.nameHint);
            }
            setPhase("noLink");
        }
    }, [userRole, share, resolve]);

    // Defaults the rating once the schema lands, so a shared place starts as "Not visited".
    useEffect(() => {
        if (rating === "" && ratingOptions.length > 0) {
            setRating(ratingOptions[0]);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [ratingOptions]);

    const markEdited = (field: string) => {
        setAutoFields((current) => current.filter((f) => f !== field));
        setMissingFields((current) => current.filter((f) => f !== field));
    };

    const toggle = (
        value: string,
        current: string[],
        setter: (next: string[]) => void
    ) => {
        setter(
            current.indexOf(value) === -1
                ? current.concat([value])
                : current.filter((item) => item !== value)
        );
    };

    const handlePasteLookup = () => {
        const found = extractMapsUrl({ text: pasteValue });
        if (found === null) {
            setPasteError("That doesn't look like a Google Maps link.");
            return;
        }

        setPasteError(null);
        resolve(found, null);
    };

    const handlePasteFromClipboard = async () => {
        try {
            const text = await navigator.clipboard.readText();
            setPasteValue(text);
            const found = extractMapsUrl({ text: text });
            if (found !== null) {
                setPasteError(null);
                resolve(found, null);
            } else {
                setPasteError("No Google Maps link found on the clipboard.");
            }
        } catch (e) {
            setPasteError("Could not read the clipboard. Paste the link instead.");
        }
    };

    // Takes the URL the user copied out of their browser's address bar after Maps rewrote it,
    // and lifts the coordinates out. Deliberately tolerant of a whole clipboard rather than a
    // tidy URL — people copy what the address bar gives them.
    const applyPastedCoordinates = (text: string) => {
        const found = parseCoordinatesFromUrl(text);
        if (found === null) {
            setCoordPasteError(
                text.indexOf("google.") === -1
                    ? "That doesn't look like a Google Maps link."
                    : "No coordinates in that link yet — give the map a moment to load, then copy the address bar again."
            );
            return;
        }

        setCoordPasteError(null);
        setLatitude(String(found.latitude));
        setLongitude(String(found.longitude));
        markEdited("coordinates");
    };

    const handleCoordPasteFromClipboard = async () => {
        try {
            const text = await navigator.clipboard.readText();
            setCoordPaste(text);
            applyPastedCoordinates(text);
        } catch (e) {
            setCoordPasteError(
                "Could not read the clipboard. Paste the link into the box instead."
            );
        }
    };

    const useCurrentLocation = () => {
        if (!navigator.geolocation) {
            return;
        }

        navigator.geolocation.getCurrentPosition(
            (position) => {
                setLatitude(String(position.coords.latitude));
                setLongitude(String(position.coords.longitude));
                markEdited("coordinates");
            },
            (error) => console.warn("Geolocation failed:", error)
        );
    };

    const save = async (force: boolean) => {
        setPhase("saving");
        setSaveError(null);
        setDuplicate(null);

        const parsedLatitude = parseFloat(latitude);
        const parsedLongitude = parseFloat(longitude);
        const hasCoordinates =
            Number.isFinite(parsedLatitude) && Number.isFinite(parsedLongitude);

        try {
            const response = await fetch(
                "/api/restaurants" + (force ? "?force=true" : ""),
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        name: name,
                        mapsUrl: mapsUrl,
                        location: location,
                        rating: rating,
                        dishPrice: dishPrice,
                        tags: tags,
                        ambience: ambience,
                        recommender: recommender,
                        description: description,
                        coordinates: hasCoordinates
                            ? {
                                  latitude: parsedLatitude,
                                  longitude: parsedLongitude,
                              }
                            : null,
                    }),
                }
            );

            if (response.status === 409) {
                const body = await response.json();
                setDuplicate(body.existing || null);
                setPhase("review");
                return;
            }

            if (!response.ok) {
                const body = await response.json().catch(() => ({}));
                setSaveError(
                    body.message || "Could not save the place. Try again."
                );
                setPhase("review");
                return;
            }

            const created: Restaurant = await response.json();
            setSaved(created);
            setPhase("saved");
        } catch (e) {
            console.error("Failed to save place:", e);
            setSaveError("Could not save the place. Try again.");
            setPhase("review");
        }
    };

    // Lands back on the map focused on the place that was just added, which doubles as
    // confirmation that the coordinates were right.
    useEffect(() => {
        if (phase !== "saved" || saved === null) {
            return;
        }

        const timer = setTimeout(
            () => router.push("/?placeId=" + saved.id),
            SAVED_REDIRECT_MS
        );

        return () => clearTimeout(timer);
    }, [phase, saved, router]);

    const resetForAnother = () => {
        setSaved(null);
        setName("");
        setLocation("");
        setMapsUrl("");
        setLatitude("");
        setLongitude("");
        setTags([]);
        setAmbience([]);
        setDishPrice("");
        setDescription("");
        setScrapedAddress("");
        setAutoFields([]);
        setMissingFields([]);
        setWarning(null);
        setSaveError(null);
        setPasteValue("");
        setPhase("noLink");
    };

    const isAuto = (field: string) => autoFields.indexOf(field) !== -1;
    const isMissing = (field: string) => missingFields.indexOf(field) !== -1;

    const badge = (field: string) => {
        if (isAuto(field)) {
            return <span className={styles.autoBadge}>auto</span>;
        }
        if (isMissing(field)) {
            return <span className={styles.missingBadge}>add this</span>;
        }
        return null;
    };

    const chrome = (children: React.ReactNode, showSave: boolean) => (
        <div className={styles.page}>
            <div className={styles.topBar}>
                <button
                    type="button"
                    className={styles.closeBtn}
                    aria-label="Close"
                    onClick={() => router.push("/")}
                >
                    ✕
                </button>
                <span className={styles.topBarTitle}>Add place</span>
                <span className={styles.topBarSpacer} />
            </div>
            <div
                className={`${styles.sheet} ${
                    phase === "saving" ? styles.busy : ""
                }`}
            >
                {children}
            </div>
            {showSave && (
                <div className={styles.saveBar}>
                    <button
                        type="button"
                        className={styles.saveBtn}
                        disabled={
                            name.trim().length === 0 ||
                            mapsUrl.trim().length === 0 ||
                            phase === "saving"
                        }
                        onClick={() => save(false)}
                    >
                        {phase === "saving" ? (
                            <>
                                <span className={styles.spinner} />
                                Saving…
                            </>
                        ) : (
                            "Save place"
                        )}
                    </button>
                </div>
            )}
        </div>
    );

    if (phase === "authChecking" || userRole === null) {
        return chrome(
            <>
                <div className={styles.hero}>
                    <div
                        className={`${styles.skeleton} ${styles.skeletonTitle}`}
                    />
                    <div
                        className={`${styles.skeleton} ${styles.skeletonLine}`}
                    />
                </div>
                <div className={styles.field}>
                    <span className={styles.caption}>Name</span>
                    <div
                        className={`${styles.skeleton} ${styles.skeletonInput}`}
                    />
                </div>
            </>,
            false
        );
    }

    if (phase === "denied") {
        const roleClass = userRole || UserRole.VIEWER;

        return chrome(
            <div className={styles.centered}>
                <h2>Admins only</h2>
                <p className={styles.centeredBody}>
                    Adding places is restricted to admins.
                </p>
                <span className={`${styles.rolePill} ${roleClass}`}>
                    {userRole}
                </span>
                <button
                    type="button"
                    className={styles.secondaryBtn}
                    onClick={() => router.push("/")}
                >
                    Back to the map
                </button>
            </div>,
            false
        );
    }

    if (phase === "noLink") {
        return chrome(
            <div className={styles.centered}>
                <GoogleMapsMarker />
                <h2>Add a place</h2>
                <p className={styles.centeredBody}>
                    Paste a Google Maps link — or share a place to N Places
                    straight from the Maps app.
                </p>
                <div className={styles.pasteActions}>
                    <input
                        className={styles.input}
                        value={pasteValue}
                        onChange={(e) => {
                            setPasteValue(e.target.value);
                            setPasteError(null);
                        }}
                        placeholder="https://maps.app.goo.gl/…"
                        inputMode="url"
                        autoCapitalize="off"
                        autoCorrect="off"
                        spellCheck={false}
                    />
                    {pasteError && (
                        <span className={styles.errorText}>{pasteError}</span>
                    )}
                    <button
                        type="button"
                        className={styles.saveBtn}
                        disabled={pasteValue.trim().length === 0}
                        onClick={handlePasteLookup}
                    >
                        Look it up
                    </button>
                    {canReadClipboard && (
                        <button
                            type="button"
                            className={styles.secondaryBtn}
                            onClick={handlePasteFromClipboard}
                        >
                            Paste from clipboard
                        </button>
                    )}
                    <button
                        type="button"
                        className={styles.linkBtn}
                        onClick={() => setPhase("review")}
                    >
                        Fill it in manually →
                    </button>
                </div>
            </div>,
            false
        );
    }

    if (phase === "saved" && saved !== null) {
        return chrome(
            <div className={styles.centered}>
                <div className={styles.successMark}>✓</div>
                <h2>Added {saved.name}</h2>
                <p className={styles.centeredBody}>Taking you to the map…</p>
                <button
                    type="button"
                    className={styles.secondaryBtn}
                    onClick={resetForAnother}
                >
                    Add another
                </button>
            </div>,
            false
        );
    }

    const resolving = phase === "resolving";
    const suggestions = locationSuggestions(scrapedAddress);
    const hasCoordinates = latitude !== "" && longitude !== "";

    return chrome(
        <>
            {warning && (
                <div className={`${styles.banner} ${styles.bannerWarn}`}>
                    <span>{warning}</span>
                    <button
                        type="button"
                        className={styles.bannerDismiss}
                        aria-label="Dismiss"
                        onClick={() => setWarning(null)}
                    >
                        ✕
                    </button>
                </div>
            )}

            {duplicate && (
                <div className={`${styles.banner} ${styles.bannerWarn}`}>
                    <div>
                        <div>You already saved {duplicate.name}.</div>
                        <div className={styles.bannerActions}>
                            <button
                                type="button"
                                className={styles.linkBtn}
                                onClick={() =>
                                    router.push("/?placeId=" + duplicate.id)
                                }
                            >
                                Open it
                            </button>
                            <button
                                type="button"
                                className={styles.linkBtn}
                                onClick={() => save(true)}
                            >
                                Add anyway
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {saveError && (
                <div className={`${styles.banner} ${styles.bannerError}`}>
                    <span>{saveError}</span>
                </div>
            )}

            <div className={styles.hero}>
                {resolving ? (
                    <>
                        <div
                            className={`${styles.skeleton} ${styles.skeletonTitle}`}
                        />
                        <div
                            className={`${styles.skeleton} ${styles.skeletonLine}`}
                        />
                    </>
                ) : (
                    <>
                        <span className={styles.heroName}>
                            {name || "New place"}
                        </span>
                        {scrapedAddress && (
                            <span className={styles.heroAddress}>
                                {scrapedAddress}
                            </span>
                        )}
                    </>
                )}
                {mapsUrl && (
                    <span className={styles.heroSource}>
                        <GoogleMapsMarker />
                        from Google Maps
                    </span>
                )}
            </div>

            {resolving && (
                <>
                    <span className={styles.statusLine}>{statusLine}</span>
                    <button
                        type="button"
                        className={styles.linkBtn}
                        onClick={() => setPhase("review")}
                    >
                        Skip and fill it in →
                    </button>
                </>
            )}

            <div className={styles.field}>
                <div className={styles.captionRow}>
                    <span className={styles.caption}>Name</span>
                    {badge("name")}
                </div>
                {resolving ? (
                    <div
                        className={`${styles.skeleton} ${styles.skeletonInput}`}
                    />
                ) : (
                    <input
                        className={`${styles.input} ${
                            isMissing("name") ? styles.inputMissing : ""
                        }`}
                        value={name}
                        autoFocus={isMissing("name")}
                        onChange={(e) => {
                            setName(e.target.value);
                            markEdited("name");
                        }}
                        placeholder="What's it called?"
                        autoCapitalize="words"
                    />
                )}
            </div>

            <div className={styles.field}>
                <div className={styles.captionRow}>
                    <span className={styles.caption}>Location</span>
                    {badge("location")}
                </div>
                {resolving ? (
                    <div
                        className={`${styles.skeleton} ${styles.skeletonInput}`}
                    />
                ) : (
                    <>
                        <input
                            className={`${styles.input} ${
                                isMissing("location") ? styles.inputMissing : ""
                            }`}
                            value={location}
                            onChange={(e) => {
                                setLocation(e.target.value);
                                markEdited("location");
                            }}
                            placeholder="Neighbourhood, city"
                        />
                        {suggestions.length > 0 && (
                            <div className={styles.suggestionRow}>
                                {suggestions.map((suggestion) => (
                                    <button
                                        key={suggestion}
                                        type="button"
                                        className={styles.suggestion}
                                        onClick={() => {
                                            setLocation(suggestion);
                                            markEdited("location");
                                        }}
                                    >
                                        {suggestion}
                                    </button>
                                ))}
                            </div>
                        )}
                    </>
                )}
            </div>

            {typeOptions.length > 0 && (
                <div className={styles.field}>
                    <span className={styles.caption}>Type</span>
                    <TypeSelect
                        options={typeOptions}
                        selected={tags}
                        onChange={setTags}
                    />
                </div>
            )}

            {ratingOptions.length > 0 && (
                <div className={styles.field}>
                    <span className={styles.caption}>Rating</span>
                    <OptionChips
                        label="Rating"
                        options={ratingOptions}
                        selected={rating}
                        onSelect={setRating}
                        colorFor={(option) => lookupColor(RatingMap, option)}
                    />
                </div>
            )}

            {priceOptions.length > 0 && (
                <div className={styles.field}>
                    <span className={styles.caption}>Dish price</span>
                    <OptionChips
                        label="Dish price"
                        options={priceOptions}
                        selected={dishPrice}
                        onSelect={(option) =>
                            setDishPrice(dishPrice === option ? "" : option)
                        }
                        colorFor={(option) => lookupColor(PriceMap, option)}
                    />
                </div>
            )}

            {ambienceOptions.length > 0 && (
                <div className={styles.field}>
                    <span className={styles.caption}>Ambience</span>
                    <OptionChips
                        label="Ambience"
                        options={ambienceOptions}
                        selected={ambience}
                        onSelect={(option) =>
                            toggle(option, ambience, setAmbience)
                        }
                        variant="ambience"
                        wrap
                    />
                </div>
            )}

            <div className={styles.field}>
                <span className={styles.caption}>Recommender</span>
                <RecommenderInput
                    options={recommenderOptions}
                    value={recommender}
                    onChange={setRecommender}
                    className={styles.input}
                />
            </div>

            <div className={styles.field}>
                <span className={styles.caption}>Notes</span>
                <textarea
                    className={styles.textarea}
                    value={description}
                    rows={3}
                    onChange={(e) => setDescription(e.target.value)}
                    onInput={(e) => {
                        const el = e.currentTarget;
                        el.style.height = "auto";
                        el.style.height = el.scrollHeight + "px";
                    }}
                    placeholder="Anything worth remembering?"
                />
            </div>

            <details className={styles.advanced} open={!hasCoordinates}>
                <summary>
                    <span>Link &amp; coordinates</span>
                    {hasCoordinates ? (
                        <span className={styles.summaryValue}>
                            {parseFloat(latitude).toFixed(5)},{" "}
                            {parseFloat(longitude).toFixed(5)}
                        </span>
                    ) : (
                        <span className={styles.missingBadge}>add this</span>
                    )}
                </summary>
                <div className={styles.advancedBody}>
                    <div className={styles.field}>
                        <span className={styles.caption}>Google Maps link</span>
                        <input
                            className={styles.input}
                            value={mapsUrl}
                            onChange={(e) => setMapsUrl(e.target.value)}
                            placeholder="https://maps.app.goo.gl/…"
                            inputMode="url"
                            autoCapitalize="off"
                            autoCorrect="off"
                            spellCheck={false}
                        />
                    </div>
                    <div className={styles.coordRow}>
                        <div className={styles.field}>
                            <span className={styles.caption}>Latitude</span>
                            <input
                                className={`${styles.input} ${
                                    hasCoordinates ? "" : styles.inputMissing
                                }`}
                                value={latitude}
                                onChange={(e) => setLatitude(e.target.value)}
                                inputMode="decimal"
                                placeholder="38.76720"
                            />
                        </div>
                        <div className={styles.field}>
                            <span className={styles.caption}>Longitude</span>
                            <input
                                className={`${styles.input} ${
                                    hasCoordinates ? "" : styles.inputMissing
                                }`}
                                value={longitude}
                                onChange={(e) => setLongitude(e.target.value)}
                                inputMode="decimal"
                                placeholder="-9.09913"
                            />
                        </div>
                    </div>
                    {!hasCoordinates && (resolvedUrl || mapsUrl) && (
                        <div className={styles.recovery}>
                            <span className={styles.hint}>
                                Links shared from the Maps app don&apos;t carry
                                coordinates, and Google only works them out once
                                its own page is running. Open the link in a
                                browser — the address bar rewrites itself to one
                                that has them — then copy it back here.
                            </span>
                            <a
                                className={styles.secondaryBtn}
                                href={buildBrowserUrl(
                                    resolvedUrl || mapsUrl,
                                    userAgent
                                )}
                                target="_blank"
                                rel="noreferrer"
                            >
                                Open the link in a browser
                            </a>
                            <textarea
                                className={styles.input}
                                value={coordPaste}
                                onChange={(e) => setCoordPaste(e.target.value)}
                                onBlur={(e) =>
                                    e.target.value.trim() &&
                                    applyPastedCoordinates(e.target.value)
                                }
                                rows={2}
                                placeholder="Paste the rewritten link here"
                                spellCheck={false}
                            />
                            <div className={styles.recoveryActions}>
                                <button
                                    type="button"
                                    className={styles.secondaryBtn}
                                    onClick={() =>
                                        applyPastedCoordinates(coordPaste)
                                    }
                                >
                                    Read coordinates
                                </button>
                                {canReadClipboard && (
                                    <button
                                        type="button"
                                        className={styles.secondaryBtn}
                                        onClick={handleCoordPasteFromClipboard}
                                    >
                                        Paste from clipboard
                                    </button>
                                )}
                            </div>
                            {coordPasteError && (
                                <span className={styles.errorText}>
                                    {coordPasteError}
                                </span>
                            )}
                        </div>
                    )}
                    <button
                        type="button"
                        className={styles.secondaryBtn}
                        onClick={useCurrentLocation}
                    >
                        Use my current location
                    </button>
                    <span className={styles.hint}>
                        Without coordinates the place still saves — it just
                        won&apos;t appear on the map.
                    </span>
                </div>
            </details>
        </>,
        true
    );
}
