"use client";

import styles from "./map.module.css";
import mapStyleJson from "../../public/map-style.json";
import maptilerLogo from "../../public/maptiler-logo.png";
import { useEffect, useMemo, useRef, useState } from "react";
import {
    Map as MapGL,
    GeolocateControl,
    MapMouseEvent,
    MapGeoJSONFeature,
    SourceSpecification,
    FilterSpecification,
    ExpressionSpecification,
    StyleSpecification,
} from "maplibre-gl";
import { Restaurant } from "@/lib/places/domain/restaurant";
import {
    IMAGE_SIZE,
    RestaurantTypeMap,
    splitRestaurantsByTag,
} from "./restaurant-items";
import {
    EMPTY_FILTERS,
    PlaceFilters,
    buildFilterOptions,
    featureFilterProperties,
    filtersToExpression,
} from "./place-filters";
import FilterPills from "./FilterPills";
import { SearchBar, SearchItem } from "./SearchBar";
import Loading from "@/components/Loading";
import { capitalize } from "@/lib/util/format";
import { UserRole } from "@/lib/constants/enums";
import { normalize } from "path";
import HiddenAdminPopup from "./HiddenAdminPopup";
import { useSession } from "next-auth/react";
import PlaceCard from "./PlaceCard";

const HOME_COORDINATES_LATITUDE = 38.773776659219195;
const HOME_COORDINATES_LONGITUDE = -9.105364651707808;
// The PlaceCard height occupies beyond the center of the screen, the flyTo latitude needs to be adjusted
// so that the map place is still visible when clicked or searched.
const LATITUDE_OFFSET = 0.0038;
const ALL_FILTER: ExpressionSpecification = ["!=", ["get", "id"], -1];
const NONE_FILTER: ExpressionSpecification = ["==", ["get", "id"], -1];

export default function MapComponent() {
    let [mapLoaded, setMapLoaded] = useState(false);
    let [searchItems, setSearchItems] = useState<SearchItem[]>([]);
    let [isHiddenPopupVisible, setIsHiddenPopupVisible] = useState(false);
    let userRole = useRef("");
    // Mirrors userRole for rendering. The ref alone cannot drive the recommender pill's
    // visibility: the role arrives from an async call, and writing a ref does not re-render.
    let [isAdmin, setIsAdmin] = useState(false);
    let [places, setPlaces] = useState<Restaurant[]>([]);
    let [placeFilters, setPlaceFilters] = useState<PlaceFilters>(EMPTY_FILTERS);
    let [selectedPlace, setSelectedPlace] = useState<Restaurant | null>(null);
    // The three things that decide what a layer shows, kept apart so they can be combined
    // rather than overwrite each other — picking "Visited" in the search bar used to wipe out
    // whatever else was filtered. Refs rather than state because the map event handlers close
    // over them and must always read the current value.
    let searchFilter = useRef<ExpressionSpecification>(ALL_FILTER);
    let pillFilter = useRef<ExpressionSpecification | null>(null);
    let selectedPlaceId = useRef<string | null>(null);
    const map = useRef<MapGL>(undefined);
    const { data: session, status } = useSession();

    const filterOptions = useMemo(
        () => buildFilterOptions(places, isAdmin),
        [places, isAdmin]
    );

    // The single place that pushes filter state onto the layers. Every path that changes what
    // is visible — a pill, a search pick, a marker tap — ends here.
    function applyMapFilters() {
        const clauses: ExpressionSpecification[] = [searchFilter.current];

        if (pillFilter.current !== null) {
            clauses.push(pillFilter.current);
        }

        if (selectedPlaceId.current !== null) {
            // The selected pin is drawn by the "-selected" layers, so the base ones have to
            // skip it or the two icons stack on top of each other.
            clauses.push(["!=", ["get", "id"], selectedPlaceId.current]);
        }

        const base: FilterSpecification =
            clauses.length === 1 ? clauses[0] : ["all", ...clauses];
        const selected: FilterSpecification =
            selectedPlaceId.current === null
                ? NONE_FILTER
                : ["==", ["get", "id"], selectedPlaceId.current];

        for (const tag in RestaurantTypeMap) {
            map.current?.setFilter(tag, base);
            map.current?.setFilter(`${tag}-name`, base);
            map.current?.setFilter(`${tag}-selected`, selected);
            map.current?.setFilter(`${tag}-name-selected`, selected);

            if (selectedPlaceId.current !== null) {
                // TODO figure out why this doesn't work
                map.current?.moveLayer(`${tag}-selected`, `${tag}`);
            }
        }
    }

    function selectPlace(place: Restaurant | null) {
        selectedPlaceId.current = place === null ? null : place.id;
        setSelectedPlace(place);
        applyMapFilters();
    }

    async function loadImages() {
        Object.values(RestaurantTypeMap).forEach((item) => {
            const iconImage = new Image(IMAGE_SIZE, IMAGE_SIZE);
            iconImage.onload = () => map.current?.addImage(item.id, iconImage);
            iconImage.src = item.image.src;

            const selectedIconImage = new Image(IMAGE_SIZE, IMAGE_SIZE);
            selectedIconImage.onload = () =>
                map.current?.addImage(`${item.id}-selected`, selectedIconImage);
            selectedIconImage.src = item.selectedImage.src;
        });
    }

    function addGeolocationControl() {
        map.current?.addControl(
            new GeolocateControl({
                positionOptions: {
                    enableHighAccuracy: true,
                },
                trackUserLocation: true,
            }),
            "bottom-right"
        );
    }

    function setSourceData(restaurants: Restaurant[]) {
        const restaurantsByTag = splitRestaurantsByTag(restaurants);

        for (const tag in restaurantsByTag) {
            const sourceSpec: SourceSpecification = {
                type: "geojson",
                cluster: false, // TODO think on how to cluster in the future
                data: {
                    type: "FeatureCollection",
                    features: restaurantsByTag[tag].map((entry) => ({
                        type: "Feature",
                        geometry: {
                            type: "Point",
                            coordinates: [
                                Number(entry.metadata.coordinates.longitude),
                                Number(entry.metadata.coordinates.latitude),
                            ],
                        },
                        properties: {
                            place: entry,
                            id: entry.id,
                            name: entry.name,
                            visited: entry.visited,
                            rating: entry.rating,
                            recommender: entry.recommender,
                            tags: entry.tags
                                .map(
                                    (t: { tag: string; color: string }) => t.tag
                                )
                                .join(", "),
                            // typesKey / ambienceKey / ratingScore / priceTier — the flattened
                            // forms the pill filters compare against.
                            ...featureFilterProperties(entry),
                        },
                    })),
                },
            };

            map.current?.addSource(tag, sourceSpec);
        }

        map.current?.addSource("home", {
            type: "geojson",
            data: {
                type: "FeatureCollection",
                features: [
                    {
                        type: "Feature",
                        geometry: {
                            type: "Point",
                            coordinates: [
                                HOME_COORDINATES_LONGITUDE,
                                HOME_COORDINATES_LATITUDE,
                            ],
                        },
                        properties: {
                            name: "Home",
                        },
                    },
                ],
            },
        });
    }

    function addLayers() {
        for (const tag in RestaurantTypeMap) {
            map.current?.addLayer({
                id: tag,
                type: "symbol",
                source: tag,
                layout: {
                    "icon-image": tag,
                    "icon-allow-overlap": true,
                    "icon-size": 0.5,
                    "icon-overlap": "always",
                },
                filter: ["!=", ["get", "id"], ""],
            });

            map.current?.addLayer({
                id: `${tag}-name`,
                type: "symbol",
                source: tag,
                layout: {
                    "text-field": [
                        "format",
                        ["get", "name"],
                        { "text-font": ["literal", ["Inter Medium"]] },
                        "\n",
                        ["case", ["==", ["get", "rating"], ""], "New!", ""],
                        { "text-font": ["literal", ["Inter Italic"]] },
                        [
                            "case",
                            ["!=", ["get", "rating"], ""],
                            ["get", "rating"],
                            "",
                        ],
                    ],
                    "text-size": 14,
                    "text-offset": [1.3, 0.0],
                    "text-anchor": "left",
                    "text-font": ["Inter"],
                    "text-justify": "left",
                    visibility: "none", // Initially hidden
                },
                paint: {
                    "text-color": RestaurantTypeMap[tag].color,
                },
                filter: ["!=", ["get", "id"], ""],
            });

            map.current?.addLayer(
                {
                    id: `${tag}-selected`,
                    type: "symbol",
                    source: tag,
                    layout: {
                        "icon-image": `${tag}-selected`,
                        "icon-allow-overlap": true,
                        "icon-size": 0.5 * 1.3, // Scaled size
                        "icon-overlap": "always",
                    },
                    filter: ["==", ["get", "id"], ""],
                },
                `${tag}`
            );

            map.current?.addLayer(
                {
                    id: `${tag}-name-selected`,
                    type: "symbol",
                    source: tag,
                    layout: {
                        "text-field": [
                            "format",
                            ["get", "name"],
                            { "text-font": ["literal", ["Inter Semi Bold"]] },
                            "\n",
                            ["case", ["==", ["get", "rating"], ""], "New!", ""],
                            { "text-font": ["literal", ["Inter Italic"]] },
                            [
                                "case",
                                ["!=", ["get", "rating"], ""],
                                ["get", "rating"],
                                "",
                            ],
                        ],
                        "text-size": 14,
                        "text-offset": [1.3, 0],
                        "text-anchor": "left",
                        "text-font": ["Inter"],
                        "text-justify": "left",
                        "text-overlap": "always",
                        visibility: "visible",
                    },
                    paint: {
                        "text-color": RestaurantTypeMap[tag].selectedColor,
                    },
                    filter: ["==", ["get", "id"], ""],
                },
                `${tag}-name`
            );
        }

        map.current?.addLayer({
            id: "home",
            type: "circle",
            source: "home",
            layout: {
                visibility: "visible",
            },
            paint: {
                "circle-radius": 10,
                "circle-opacity": 0.0,
            },
        });
    }

    function addEventListeners() {
        const queryLayers: string[] = [];
        for (const tag in RestaurantTypeMap) {
            queryLayers.push(tag);
            queryLayers.push(`${tag}-name`);
        }

        const onPlaceClickHandler = (
            e: MapMouseEvent & {
                features?: MapGeoJSONFeature[];
            } & Object
        ) => {
            if (!map.current) {
                console.error("Map not loaded on point click");
                return;
            }

            const features = map.current?.queryRenderedFeatures(e.point, {
                layers: queryLayers, // Specify the layers to query
            });

            if (!features || features.length === 0) {
                console.error("No features on map point click");
                return;
            }

            const place = features[0];

            const geometry = place.geometry;
            if (!geometry.type || geometry.type !== "Point") {
                console.error("No geometry on point click");
                return;
            }

            const coordinates = geometry.coordinates as [number, number];
            if (coordinates[1] > 0) {
                coordinates[1] = coordinates[1] - LATITUDE_OFFSET;
            } else {
                coordinates[1] = coordinates[1] + LATITUDE_OFFSET;
            }

            map.current?.flyTo({
                center: coordinates,
                speed: 0.8,
                zoom: 15,
            });

            selectPlace(JSON.parse(place.properties.place));
        };

        const onEmptyClickHandler = (
            e: MapMouseEvent & {
                features?: MapGeoJSONFeature[];
            } & Object
        ) => {
            // Query for features at the click point
            const features = map.current?.queryRenderedFeatures(e.point, {
                layers: queryLayers,
            });

            if (!features || !features.length) {
                selectPlace(null);
            }
        };

        map.current?.off("click", onEmptyClickHandler);
        map.current?.on("click", onEmptyClickHandler);

        for (const tag in RestaurantTypeMap) {
            map.current?.off("click", tag, onPlaceClickHandler);
            map.current?.on("click", tag, onPlaceClickHandler);
            map.current?.off("click", `${tag}-name`, onPlaceClickHandler);
            map.current?.on("click", `${tag}-name`, onPlaceClickHandler);
        }

        const onHomeClickHandler = (
            e: MapMouseEvent & {
                features?: MapGeoJSONFeature[];
            } & Object
        ) => {
            if (!map.current) {
                console.error("Map not loaded on home click");
                return;
            }

            const features = map.current?.queryRenderedFeatures(e.point, {
                layers: ["home"],
            });

            if (!features || features.length === 0) {
                console.error("No features on map home click");
                return;
            }

            setIsHiddenPopupVisible(true);
        };

        map.current?.on("click", "home", onHomeClickHandler);
    }

    function addZoomEventListener() {
        map.current?.on("zoomend", () => {
            const zoom = map.current?.getZoom();
            for (const tag in RestaurantTypeMap) {
                map.current?.setLayoutProperty(
                    `${tag}-name`,
                    "visibility",
                    zoom && zoom >= 10 ? "visible" : "none"
                );
            }
        });
    }

    function buildSearchItems(restaurants: Restaurant[]) {
        const items: SearchItem[] = [];

        // Search picks now set searchFilter and re-apply, so they narrow whatever the pills
        // already selected instead of replacing it.
        const applySearchFilter = (filter: ExpressionSpecification) => {
            searchFilter.current = filter;
            applyMapFilters();
        };

        items.push({
            label: "Visited",
            type: "state",
            clickHandler: () =>
                applySearchFilter(["==", ["get", "visited"], true]),
        });

        items.push({
            label: "Not Visited",
            type: "state",
            clickHandler: () =>
                applySearchFilter(["==", ["get", "visited"], false]),
        });

        for (const tag in RestaurantTypeMap) {
            const label = capitalize(RestaurantTypeMap[tag].id);
            items.push({
                label: label,
                type: "tag",
                clickHandler: () =>
                    applySearchFilter([
                        "in",
                        tag,
                        ["downcase", ["get", "tags"]],
                    ]),
            });
        }

        const places = new Set<string>();
        const locations = new Set<string>();
        const recommenders = new Set<string>();

        for (const restaurant of restaurants) {
            if (places.has(restaurant.mapsUrl)) {
                console.warn(
                    `Duplicate restaurant name: ${restaurant.mapsUrl}`
                );
                continue;
            }

            places.add(restaurant.mapsUrl);

            items.push({
                label: restaurant.name,
                type: "place",
                clickHandler: () => {
                    const coordinates = [
                        restaurant.metadata.coordinates.longitude,
                        restaurant.metadata.coordinates.latitude,
                    ] as [number, number];

                    if (coordinates[1] > 0) {
                        coordinates[1] = coordinates[1] - LATITUDE_OFFSET;
                    } else {
                        coordinates[1] = coordinates[1] + LATITUDE_OFFSET;
                    }

                    map.current?.flyTo({
                        center: coordinates,
                        speed: 0.8,
                        zoom: 15,
                    });

                    selectPlace(restaurant);
                },
            });

            const normalizedLocation = normalize(restaurant.location);
            if (locations.has(normalizedLocation)) {
                continue;
            }

            locations.add(normalizedLocation);

            items.push({
                label: restaurant.location,
                type: "location",
                clickHandler: () => {
                    const coordinates = [
                        restaurant.metadata.coordinates.longitude,
                        restaurant.metadata.coordinates.latitude,
                    ] as [number, number];

                    map.current?.flyTo({
                        center: coordinates,
                        speed: 0.8,
                        zoom: 15,
                    });
                },
            });

            if (userRole.current === UserRole.ADMIN && restaurant.recommender !== "" && !recommenders.has(restaurant.recommender)) {
                recommenders.add(restaurant.recommender);

                items.push({
                    label: restaurant.recommender,
                    type: "recommender",
                    clickHandler: () =>
                        applySearchFilter([
                            "==",
                            ["get", "recommender"],
                            restaurant.recommender,
                        ]),
                });
            }
        }

        setSearchItems(items);
    }

    // Clearing the search box only undoes what the search box did. The pills keep their own
    // "Clear" control, so a stray tap on the ✕ cannot silently throw away a filter set up
    // somewhere else.
    function resetFilters() {
        searchFilter.current = ALL_FILTER;
        selectPlace(null);
    }

    // Opens the map on a specific place, used by "/?placeId=..." after a place is added so the
    // new pin is the first thing you see — which also confirms its coordinates are right.
    //
    // Reads the query string directly rather than via useSearchParams: that hook would force a
    // Suspense boundary around this component, and an effect only ever runs on the client
    // anyway.
    function focusPlaceFromUrl(restaurants: Restaurant[]) {
        const placeId = new URLSearchParams(window.location.search).get(
            "placeId"
        );
        if (!placeId) {
            return;
        }

        const place = restaurants.find(
            (restaurant) => restaurant.id === placeId
        );
        if (place === undefined) {
            console.warn("Place %s not found on the map", placeId);
            return;
        }

        const coordinates = [
            place.metadata.coordinates.longitude,
            place.metadata.coordinates.latitude,
        ] as [number, number];

        // The place card covers past the vertical centre, so the target is nudged the same way
        // a marker click does it.
        if (coordinates[1] > 0) {
            coordinates[1] = coordinates[1] - LATITUDE_OFFSET;
        } else {
            coordinates[1] = coordinates[1] + LATITUDE_OFFSET;
        }

        map.current?.flyTo({ center: coordinates, speed: 0.8, zoom: 15 });
        selectPlace(place);

        // Drops the parameter so a refresh or a back-navigation does not re-open the card.
        window.history.replaceState({}, "", window.location.pathname);
    }

    async function handleMapLoad(
        loadImgsPromise: Promise<void>,
        restaurants: Restaurant[]
    ) {
        await loadImgsPromise;
        addGeolocationControl();
        setSourceData(restaurants);
        addLayers();
        addZoomEventListener();
        buildSearchItems(restaurants);
        // The pills only offer values the loaded places actually use, so this has to be the
        // same list the map was built from.
        setPlaces(restaurants);
        focusPlaceFromUrl(restaurants);
        console.info("Map loaded");
        setMapLoaded(true);
    }

    useEffect(() => {
        if (mapLoaded) {
            return;
        }

        const fetchDataAndLoadMap = async () => {
            const lastModifiedDate = await fetch(
                "/api/restaurants/lastUpdated",
                { cache: "no-store" }
            ).then((response) => response.json());

            // This result was previously cached, but that resulted
            // in the KV cache being populated with stale data.
            // Therefore, we're not caching it anymore.
            //
            // Rodrigo Neves - 2025-02-13
            const restaurants = await fetch(
                `/api/restaurants?lastModifiedDate=${lastModifiedDate}`,
                { cache: "no-store" }
            ).then((response) => response.json());

            console.info(
                "Received restaurants from Notion: %d",
                restaurants.length
            );

            const mapStyle = {
                ...mapStyleJson,
                sources: {
                    ...mapStyleJson.sources,
                    openmaptiles: {
                        ...mapStyleJson.sources.openmaptiles,
                        url: process.env.NEXT_PUBLIC_MAPTILER_API_KEY
                            ? mapStyleJson.sources.openmaptiles.url.replace(
                                  "MAPTILER_API_KEY_PLACEHOLDER",
                                  process.env.NEXT_PUBLIC_MAPTILER_API_KEY
                              )
                            : "https://tiles2.intermodal.pt/data/v3.json",
                    },
                },
            };

            map.current = new MapGL({
                attributionControl: false,
                container: "mapElem",
                style: mapStyle as StyleSpecification,
                center: [-9.10595458097556, 38.77395075041862],
                zoom: 10,
            });

            const loadPromise = loadImages();
            map.current.on("load", () => {
                handleMapLoad(loadPromise, restaurants);
            });
        };

        fetchDataAndLoadMap();
    }, [mapLoaded]);

    useEffect(() => {
        const updateUserRole = async () => {
            if (!session || !session.user || !session.user.email) {
                return;
            }

            const response: string = await fetch("/api/auth/getRole", {
                method: "POST",
                body: JSON.stringify({ email: session.user.email }),
            }).then((response) => response.json());

            userRole.current = response === "" ? UserRole.VIEWER : response;
            setIsAdmin(userRole.current === UserRole.ADMIN);
        };

        updateUserRole();
    }, [status]);

    useEffect(() => {
        addEventListeners();
    }, [userRole, mapLoaded]);

    useEffect(() => {
        pillFilter.current = filtersToExpression(placeFilters);

        if (mapLoaded) {
            applyMapFilters();
        }
        // applyMapFilters is redefined every render and only reads refs, so it is deliberately
        // not a dependency — listing it would re-run this on every render instead.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [placeFilters, mapLoaded]);

    return (
        <div className={styles.mapContainer}>
            <Loading isMapLoaded={mapLoaded} />
            <SearchBar
                isMapLoaded={mapLoaded}
                searchItems={searchItems}
                resetFiltersHandler={resetFilters}
            >
                <FilterPills
                    options={filterOptions}
                    filters={placeFilters}
                    onChange={setPlaceFilters}
                />
            </SearchBar>
            <div id="mapElem" className={styles.mapCanvas}></div>
            {process.env.NEXT_PUBLIC_MAPTILER_API_KEY && (
                <div className={styles.maptilerAttribution}>
                    <a href="https://www.maptiler.com" target="_blank" rel="noopener noreferrer">
                        <img src={maptilerLogo.src} alt="MapTiler" />
                    </a>
                    <span>
                        <a href="https://www.maptiler.com/copyright" target="_blank" rel="noopener noreferrer">© MapTiler</a>
                        {" "}
                        <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">© OpenStreetMap contributors</a>
                    </span>
                </div>
            )}
            <PlaceCard place={selectedPlace} userRole={userRole} />
            <HiddenAdminPopup
                isVisible={isHiddenPopupVisible}
                setIsVisible={setIsHiddenPopupVisible}
                userRole={userRole}
            />
        </div>
    );
}
