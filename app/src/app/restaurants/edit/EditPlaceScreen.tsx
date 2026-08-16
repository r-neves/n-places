"use client";

import { useEffect, useMemo, useState } from "react";
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
import { PriceMap, RatingMap } from "@/components/restaurant-items";
import { parseCoordinatesFromUrl } from "@/lib/util/maps-coordinates";
import { buildBrowserUrl } from "@/lib/util/open-in-browser";
import { DatabaseSchema, Restaurant } from "@/lib/places/domain/restaurant";

type Phase =
    | "authChecking"
    | "denied"
    | "loading"
    | "notFound"
    | "review"
    | "saving"
    | "saved";

const SAVED_REDIRECT_MS = 900;

export default function EditPlaceScreen() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { data: session, status: sessionStatus } = useSession();

    const placeId = searchParams.get("placeId");

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

    const [saveError, setSaveError] = useState<string | null>(null);
    const [coordPaste, setCoordPaste] = useState("");
    const [coordPasteError, setCoordPasteError] = useState<string | null>(null);
    // Resolved in an effect rather than inline: `navigator` does not exist during the server
    // render, so branching on it directly would produce a hydration mismatch.
    const [canReadClipboard, setCanReadClipboard] = useState(false);
    const [userAgent, setUserAgent] = useState("");

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
            .then((role: string) => setUserRole(role === "" ? UserRole.VIEWER : role))
            .catch((error) => {
                console.error("Error fetching role:", error);
                setUserRole(UserRole.VIEWER);
            });
    }, [sessionStatus, session]);

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

        fetch("/api/restaurants/recommenders")
            .then((response) => (response.ok ? response.json() : []))
            .then((names: string[]) =>
                setRecommenderOptions(Array.isArray(names) ? names : [])
            )
            .catch((error) =>
                console.warn("Error fetching recommenders:", error)
            );
    }, [userRole]);

    // Loads the place into the form. Note the rating is not defaulted the way the add screen
    // defaults it to "Not visited": whatever the place already has is the truth, and a blank one
    // is resolved server-side rather than being silently rewritten here.
    useEffect(() => {
        if (userRole === null) {
            return;
        }

        if (userRole !== UserRole.ADMIN) {
            setPhase("denied");
            return;
        }

        if (!placeId) {
            setPhase("notFound");
            return;
        }

        setPhase("loading");

        fetch(`/api/restaurants/${placeId}`, { cache: "no-store" })
            .then((response) => {
                if (!response.ok) {
                    throw new Error("load failed: " + response.status);
                }

                return response.json();
            })
            .then((place: Restaurant | null) => {
                if (!place || !place.id) {
                    setPhase("notFound");
                    return;
                }

                setName(place.name || "");
                setLocation(place.location || "");
                setMapsUrl(place.mapsUrl || "");
                setDishPrice(place.dishPrice || "");
                setRecommender(place.recommender || "");
                setDescription(place.description || "");
                setTags((place.tags || []).map((t) => t.tag));
                setAmbience((place.ambience || []).map((t) => t.tag));

                // The read path lowercases the status label ("8/10"), but the chips are keyed by
                // the schema's own casing, so the stored value has to be matched back to it or
                // nothing appears selected.
                setRating(place.rating || "");

                const coordinates = place.metadata && place.metadata.coordinates;
                if (coordinates) {
                    setLatitude(
                        coordinates.latitude ? String(coordinates.latitude) : ""
                    );
                    setLongitude(
                        coordinates.longitude
                            ? String(coordinates.longitude)
                            : ""
                    );
                }

                setPhase("review");
            })
            .catch((error) => {
                console.error("Error loading place:", error);
                setPhase("notFound");
            });
    }, [userRole, placeId]);

    // Runs once the schema lands, since the stored value and the schema option can differ in
    // case. Without this an existing "8/10" would leave every chip unselected and a save would
    // fall back to the first option — silently downgrading the rating.
    useEffect(() => {
        if (rating === "" || ratingOptions.length === 0) {
            return;
        }

        const normalized = rating.toLocaleLowerCase();
        for (let i = 0; i < ratingOptions.length; i++) {
            if (ratingOptions[i].toLocaleLowerCase() === normalized) {
                if (ratingOptions[i] !== rating) {
                    setRating(ratingOptions[i]);
                }
                return;
            }
        }
    }, [ratingOptions, rating]);

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
            },
            (error) => console.warn("Geolocation failed:", error)
        );
    };

    const save = async () => {
        setPhase("saving");
        setSaveError(null);

        const parsedLatitude = parseFloat(latitude);
        const parsedLongitude = parseFloat(longitude);
        const hasCoordinates =
            Number.isFinite(parsedLatitude) && Number.isFinite(parsedLongitude);

        try {
            const response = await fetch(`/api/restaurants/${placeId}`, {
                method: "PATCH",
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
            });

            if (!response.ok) {
                const body = await response.json().catch(() => ({}));
                setSaveError(
                    body.message || "Could not save the changes. Try again."
                );
                setPhase("review");
                return;
            }

            setPhase("saved");
        } catch (e) {
            console.error("Failed to update place:", e);
            setSaveError("Could not save the changes. Try again.");
            setPhase("review");
        }
    };

    // Lands back on the map focused on the place that was just edited, which doubles as
    // confirmation the changes took.
    useEffect(() => {
        if (phase !== "saved") {
            return;
        }

        const timer = setTimeout(
            () => router.push("/?placeId=" + placeId),
            SAVED_REDIRECT_MS
        );

        return () => clearTimeout(timer);
    }, [phase, placeId, router]);

    const close = () => router.push(placeId ? "/?placeId=" + placeId : "/");

    const chrome = (children: React.ReactNode, showSave: boolean) => (
        <div className={styles.page}>
            <div className={styles.topBar}>
                <button
                    type="button"
                    className={styles.closeBtn}
                    aria-label="Close"
                    onClick={close}
                >
                    ✕
                </button>
                <span className={styles.topBarTitle}>Edit place</span>
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
                        onClick={save}
                    >
                        {phase === "saving" ? (
                            <>
                                <span className={styles.spinner} />
                                Saving…
                            </>
                        ) : (
                            "Save changes"
                        )}
                    </button>
                </div>
            )}
        </div>
    );

    if (phase === "authChecking" || phase === "loading" || userRole === null) {
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
                <div className={styles.field}>
                    <span className={styles.caption}>Location</span>
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
                    Editing places is restricted to admins.
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

    if (phase === "notFound") {
        return chrome(
            <div className={styles.centered}>
                <h2>Place not found</h2>
                <p className={styles.centeredBody}>
                    That place could not be loaded. It may have been removed
                    from the database.
                </p>
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

    if (phase === "saved") {
        return chrome(
            <div className={styles.centered}>
                <div className={styles.successMark}>✓</div>
                <h2>Saved {name}</h2>
                <p className={styles.centeredBody}>Taking you to the map…</p>
            </div>,
            false
        );
    }

    const hasCoordinates = latitude !== "" && longitude !== "";

    return chrome(
        <>
            {saveError && (
                <div className={`${styles.banner} ${styles.bannerError}`}>
                    <span>{saveError}</span>
                </div>
            )}

            <div className={styles.hero}>
                <span className={styles.heroName}>{name || "This place"}</span>
                {location && (
                    <span className={styles.heroAddress}>{location}</span>
                )}
                {mapsUrl && (
                    <span className={styles.heroSource}>
                        <GoogleMapsMarker />
                        from Google Maps
                    </span>
                )}
            </div>

            <div className={styles.field}>
                <span className={styles.caption}>Name</span>
                <input
                    className={styles.input}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="What's it called?"
                    autoCapitalize="words"
                />
            </div>

            <div className={styles.field}>
                <span className={styles.caption}>Location</span>
                <input
                    className={styles.input}
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="Neighbourhood, city"
                />
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
                    {!hasCoordinates && mapsUrl && (
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
                                href={buildBrowserUrl(mapsUrl, userAgent)}
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
                        Clearing the coordinates leaves the saved ones alone —
                        the place keeps its pin. Type new ones to move it.
                    </span>
                </div>
            </details>
        </>,
        true
    );
}
