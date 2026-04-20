"use client";

import styles from "./map.module.css";
import { useEffect, useRef, useState } from "react";
import {
    Map as MapGL,
    GeolocateControl,
    MapMouseEvent,
    MapGeoJSONFeature,
    SourceSpecification,
    FilterSpecification,
    ExpressionSpecification,
} from "maplibre-gl";
import { Restaurant } from "@/lib/places/domain/restaurant";
import {
    IMAGE_SIZE,
    RestaurantTypeMap,
    splitRestaurantsByTag,
} from "./restaurant-items";
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
    let [selectedPlace, setSelectedPlace] = useState<Restaurant | null>(null);
    let currentFilter = useRef<ExpressionSpecification>(ALL_FILTER);
    const map = useRef<MapGL>(undefined);
    const { data: session, status } = useSession();

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
            const placeId = place.properties.id;

            // Update the selected place
            for (const layer of queryLayers) {
                const notSelectedFilter: FilterSpecification = [
                    "all", 
                    ["!=", ["get", "id"], placeId], 
                    currentFilter.current
                ];

                map.current?.setFilter(`${layer}`, notSelectedFilter);
                map.current?.setFilter(`${layer}-selected`, [
                    "==",
                    ["get", "id"],
                    placeId,
                ]);
                // TODO figure out why this doesn't work
                map.current?.moveLayer(`${layer}-selected`, `${layer}`);
            }

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

            const parsedPlace = JSON.parse(place.properties.place);
            setSelectedPlace(parsedPlace);
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
                for (const tag in RestaurantTypeMap) {
                    map.current?.setFilter(`${tag}`, currentFilter.current);
                    map.current?.setFilter(`${tag}-name`, currentFilter.current);
                    map.current?.setFilter(`${tag}-selected`, NONE_FILTER);
                    map.current?.setFilter(`${tag}-name-selected`, NONE_FILTER);
                }

                setSelectedPlace(null);
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

        items.push({
            label: "Visited",
            type: "state",
            clickHandler: () => {
                const visitedFilter: FilterSpecification = ["==", ["get", "visited"], true];
                currentFilter.current = visitedFilter;

                for (const tag in RestaurantTypeMap) {
                    map.current?.setFilter(tag, visitedFilter);
                    map.current?.setFilter(`${tag}-name`, visitedFilter);
                }
            },
        });

        items.push({
            label: "Not Visited",
            type: "state",
            clickHandler: () => {
                const notVisitedFilter: FilterSpecification = ["==", ["get", "visited"], false];
                currentFilter.current = notVisitedFilter;

                for (const tag in RestaurantTypeMap) {
                    map.current?.setFilter(tag, notVisitedFilter);
                    map.current?.setFilter(`${tag}-name`, notVisitedFilter);
                }
            },
        });

        for (const tag in RestaurantTypeMap) {
            const label = capitalize(RestaurantTypeMap[tag].id);
            items.push({
                label: label,
                type: "tag",
                clickHandler: () => {
                    const tagFilter: FilterSpecification = [
                        "in",
                        tag,
                        ["downcase", ["get", "tags"]],
                    ];
                    currentFilter.current = tagFilter;

                    for (const t in RestaurantTypeMap) {
                        map.current?.setFilter(t, tagFilter);
                        map.current?.setFilter(`${t}-name`, tagFilter);
                    }
                },
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
                    // Update the selected place
                    const notSelectedFilter: FilterSpecification = [
                        "!=",
                        ["get", "id"],
                        restaurant.id,
                    ];
                    currentFilter.current = notSelectedFilter;

                    for (const t in RestaurantTypeMap) {
                        map.current?.setFilter(`${t}`, notSelectedFilter);
                        map.current?.setFilter(`${t}-name`, notSelectedFilter);
                        map.current?.setFilter(`${t}-selected`, [
                            "==",
                            ["get", "id"],
                            restaurant.id,
                        ]);
                        map.current?.setFilter(`${t}-name-selected`, [
                            "==",
                            ["get", "id"],
                            restaurant.id,
                        ]);
                        // TODO figure out why this doesn't work
                        map.current?.moveLayer(`${t}-selected`, `${t}`);
                    }

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

                    setSelectedPlace(restaurant);
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
                    clickHandler: () => {
                        const recommenderFilter: FilterSpecification = ["==", ["get", "recommender"], restaurant.recommender];
                        currentFilter.current = recommenderFilter;

                        for (const t in RestaurantTypeMap) {
                            map.current?.setFilter(t, recommenderFilter);
                            map.current?.setFilter(`${t}-name`, recommenderFilter);
                        }
                    },
                });
            }
        }

        setSearchItems(items);
    }

    function resetFilters() {
        for (const tag in RestaurantTypeMap) {
            currentFilter.current = ALL_FILTER;
            map.current?.setFilter(tag, null);
            map.current?.setFilter(`${tag}-name`, null);
            map.current?.setFilter(`${tag}-selected`, NONE_FILTER);
            map.current?.setFilter(`${tag}-name-selected`, NONE_FILTER);

            setSelectedPlace(null);
        }
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

            map.current = new MapGL({
                attributionControl: false,
                container: "mapElem",
                style: "./map-style.json",
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
        };

        updateUserRole();
    }, [status]);

    useEffect(() => {
        addEventListeners();
    }, [userRole, mapLoaded]);

    return (
        <div className={styles.mapContainer}>
            <Loading isMapLoaded={mapLoaded} />
            <SearchBar
                isMapLoaded={mapLoaded}
                searchItems={searchItems}
                resetFiltersHandler={resetFilters}
            ></SearchBar>
            <div id="mapElem" className={styles.mapCanvas}></div>
            <PlaceCard place={selectedPlace} userRole={userRole} />
            <HiddenAdminPopup
                isVisible={isHiddenPopupVisible}
                setIsVisible={setIsHiddenPopupVisible}
                userRole={userRole}
            />
        </div>
    );
}
