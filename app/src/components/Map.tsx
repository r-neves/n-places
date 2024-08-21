"use client";

import styles from "./map.module.css";
import { useEffect, useRef } from "react";
import { Map as MapGL, GeolocateControl, MapMouseEvent, MapGeoJSONFeature, Popup } from "maplibre-gl";
import { Restaurant } from "@/lib/places/domain/restaurant";
import { IMAGE_SIZE, RestaurantItems, splitRestaurantsByTag } from "./restaurant-items";

interface MapComponentProps {
	dataPoints: Restaurant[];
}

export default function MapComponent({ dataPoints }: MapComponentProps) {
	const map = useRef<MapGL>();

	async function loadImages() {
		Object.values(RestaurantItems).forEach((item) => {
			// The source image will be double the size of the target icon to improve quality
			const size = IMAGE_SIZE * 2;
			const iconImage = new Image(size, size);
			iconImage.onload = () => map.current?.addImage(item.id, iconImage)
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
			"bottom-right",
		);
	}

	function setSourceData(restaurants: Restaurant[]) {
		const restaurantsByTag = splitRestaurantsByTag(restaurants);

		for (const tag in restaurantsByTag) {
			map.current?.addSource(tag, {
				type: "geojson",
				data: {
					type: "FeatureCollection",
					features: restaurantsByTag[tag].map((entry) => ({
						type: "Feature",
						geometry: {
							type: "Point",
							coordinates: [
								Number(entry.metadata.coordinates.longitude), 
								Number(entry.metadata.coordinates.latitude)
							],
						},
						properties: {
							name: entry.name,
							rating: entry.rating,
							mapsUrl: entry.mapsUrl,
						}
					})),
				},
			});
		}
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
		}

		for (const tag in RestaurantItems) {
			map.current?.addLayer({
				id: `${tag}-name`,
				type: "symbol",
				source: tag,
				layout: {
					"text-field": ["format", ["get", "name"], {}, "\n", ["get", "rating"]],
					"text-size": 14,
					"text-offset": [1.3, 0.0],
					"text-anchor": "left",
					"text-font": ["Inter"],
					"text-justify": "left",
					"visibility": "none", // Initially hidden
				},
				paint: {
					"text-color": RestaurantItems[tag].textColor,
				},
			});
		}
	}

	function addEventListeners() {
		const onClickHandler = (e: MapMouseEvent & {
			features?: MapGeoJSONFeature[];
		} & Object) => {
			if (!map.current) {
				console.error("Map not loaded on point click");
				return;
			}

			if (!e.features) {
				console.error("No features on map point click");
				return;
			}

			const geometry = e.features[0].geometry;
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

			const properties = e.features[0].properties;
			new Popup()
				.setLngLat(coordinates)
				.setHTML(`<a style="text-decoration: underline; color: blue" href="${properties.mapsUrl}">Google Maps Link</a>`)
				.addTo(map.current);
		}

		for (const tag in RestaurantItems) {
			map.current?.on('click', tag, onClickHandler);
		}
	}

	function addZoomEventListener() {
		map.current?.on('zoom', () => {
			const zoom = map.current?.getZoom();
			if (zoom && zoom >= 10) {
				for (const tag in RestaurantItems) {
					map.current?.setLayoutProperty(`${tag}-name`, 'visibility', 'visible');
				}
			} else {
				for (const tag in RestaurantItems) {
					map.current?.setLayoutProperty(`${tag}-name`, 'visibility', 'none');
				}
			}
		});
	}

	async function handleMapLoad(loadImgsPromise: Promise<void>, restaurants: Restaurant[]) {
		await loadImgsPromise;
		addGeolocationControl();
		setSourceData(restaurants);
		addLayers();
		addEventListeners();
		addZoomEventListener();
		console.debug("Map loaded");
	}

	useEffect(() => {
		const fetchDataAndLoadMap = async () => {
			const lastModifiedDate = await fetch("/api/restaurants/lastUpdated", {cache: "no-store"})
			.then((response) => response.json());

			const restaurants = await fetch(`/api/restaurants?lastModifiedDate=${lastModifiedDate}`, {cache: "force-cache"})
			.then((response) => response.json());

			console.info("Received restaurants from Notion: %d", restaurants.length);

			map.current = new MapGL({
				container: "mapElem",
				style: "./map-style.json",
				center: [-9.10595458097556, 38.77395075041862],
				zoom: 10,
			});
			const loadPromise = loadImages();
			map.current.on("load", () => {
				handleMapLoad(loadPromise, restaurants);
			});
		}

		fetchDataAndLoadMap();
	}, []);

	return <div id="mapElem" className={styles.mapElem} />;
}
