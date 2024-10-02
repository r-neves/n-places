"use client";

import styles from "./map.module.css";
import { useEffect, useRef, useState } from "react";
import {
    Map as MapGL,
    GeolocateControl,
    MapMouseEvent,
    MapGeoJSONFeature,
    Popup,
    SourceSpecification,
} from "maplibre-gl";
import { Restaurant } from "@/lib/places/domain/restaurant";
import {
    IMAGE_SIZE,
    RestaurantItems,
    splitRestaurantsByTag,
} from "./restaurant-items";
import { SearchBar, SearchItem } from "./SearchBar";
import Loading from "@/components/Loading";
import { capitalize } from "@/lib/util/format";
import { normalize } from "path";

const HOME_COORDINATES_LATITUDE = 38.773776659219195;
const HOME_COORDINATES_LONGITUDE = -9.105364651707808;

export default function MapComponent({
    version,
}: {
    version: string | undefined;
}) {
    let [mapLoaded, setMapLoaded] = useState(false);
    let [searchItems, setSearchItems] = useState<SearchItem[]>([]);
    const map = useRef<MapGL>();

    async function loadImages() {
        Object.values(RestaurantItems).forEach((item) => {
            // The source image will be double the size of the target icon to improve quality
            const size = IMAGE_SIZE * 2;
            const iconImage = new Image(size, size);
            iconImage.onload = () => map.current?.addImage(item.id, iconImage);
            iconImage.src = item.image.src;
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
                            name: entry.name,
                            visited: entry.visited,
                            rating: entry.rating,
                            mapsUrl: entry.mapsUrl,
                            dishPrice: entry.dishPrice,
                            ambience: entry.ambience
                                .map((a) => a.tag)
                                .join(", "),
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
        for (const tag in RestaurantItems) {
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
            });

            map.current?.addLayer({
                id: `${tag}-name`,
                type: "symbol",
                source: tag,
                layout: {
                    "text-field": [
                        "format",
                        ["get", "name"],
                        {},
                        "\n",
                        ["get", "rating"],
                    ],
                    "text-size": 14,
                    "text-offset": [1.3, 0.0],
                    "text-anchor": "left",
                    "text-font": ["Inter"],
                    "text-justify": "left",
                    visibility: "none", // Initially hidden
                },
                paint: {
                    "text-color": RestaurantItems[tag].textColor,
                },
            });
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
        for (const tag in RestaurantItems) {
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

            map.current?.flyTo({
                center: coordinates,
                speed: 0.8,
                zoom: 15,
            });

            const properties = place.properties;
            new Popup()
                .setLngLat(coordinates)
                .setHTML(
                    `
					<h3>${properties.name}</h3>
					<p>${properties.rating === "" ? "New!" : "Rating: " + properties.rating}</p>
					${properties.tags ? `<p>Tags: ${properties.tags}</p>` : ""}
					${properties.dishPrice ? `<p>Dish Price: ${properties.dishPrice}</p>` : ""}
					${properties.ambience ? `<p>Ambience: ${properties.ambience}</p>` : ""}
					<a style="text-decoration: underline; color: blue" href="${
                        properties.mapsUrl
                    }">Google Maps Link</a>
					`
                )
                .addTo(map.current);
        };

        for (const tag in RestaurantItems) {
            map.current?.on("click", tag, onPlaceClickHandler);
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

            new Popup()
                .setLngLat([
                    HOME_COORDINATES_LONGITUDE,
                    HOME_COORDINATES_LATITUDE,
                ])
                .setHTML(
                    `
                    <h3>Version</h3>
                    <p>${version}</p>
                    `
                )
                .addTo(map.current);
        };

        map.current?.on("click", "home", onHomeClickHandler);
    }

    function addZoomEventListener() {
        map.current?.on("zoomend", () => {
            const zoom = map.current?.getZoom();
            for (const tag in RestaurantItems) {
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
                for (const tag in RestaurantItems) {
                    map.current?.setFilter(tag, ["==", "visited", true]);
                    map.current?.setFilter(`${tag}-name`, [
                        "==",
                        "visited",
                        true,
                    ]);
                }
            },
        });

        items.push({
            label: "Not Visited",
            type: "state",
            clickHandler: () => {
                for (const tag in RestaurantItems) {
                    map.current?.setFilter(tag, ["==", "visited", false]);
                    map.current?.setFilter(`${tag}-name`, [
                        "==",
                        "visited",
                        false,
                    ]);
                }
            },
        });

        for (const tag in RestaurantItems) {
            const label = capitalize(RestaurantItems[tag].id);
            items.push({
                label: label,
                type: "tag",
                clickHandler: () => {
                    for (const t in RestaurantItems) {
                        map.current?.setFilter(t, [
                            "in",
                            tag,
                            ["downcase", ["get", "tags"]],
                        ]);
                        map.current?.setFilter(`${t}-name`, [
                            "in",
                            tag,
                            ["downcase", ["get", "tags"]],
                        ]);
                    }
                },
            });
        }

        const places = new Set<string>();
        const locations = new Set<string>();

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

                    map.current?.flyTo({
                        center: coordinates,
                        speed: 0.8,
                        zoom: 15,
                    });
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
        }

        setSearchItems(items);
    }

    function resetFilters() {
        for (const tag in RestaurantItems) {
            map.current?.setFilter(tag, null);
            map.current?.setFilter(`${tag}-name`, null);
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
        addEventListeners();
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

            const restaurants = await fetch(
                `/api/restaurants?lastModifiedDate=${lastModifiedDate}`,
                { cache: "force-cache" }
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

    return (
        <div>
            <Loading isMapLoaded={mapLoaded} />
            <SearchBar
                isMapLoaded={mapLoaded}
                searchItems={searchItems}
                resetFiltersHandler={resetFilters}
            ></SearchBar>
            <div id="mapElem" className={styles.mapCanvas}></div>
        </div>
    );
}
