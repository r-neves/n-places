"use client";

import styles from "./map.module.css";
import { useEffect, useRef } from "react";
import { Map as MapGL, GeolocateControl, Popup } from "maplibre-gl";
import { regularDot } from "./regular-dot";
import { Restaurant } from "@/lib/places/domain/restaurant";
import { IMAGE_SIZE, SvgIcons } from "./SvgIcons";

interface MapComponentProps {
	dataPoints: Restaurant[];
}

export function MapComponent({ dataPoints }: MapComponentProps) {
	const map = useRef<MapGL>();

	async function loadImages() {
		SvgIcons.forEach((svgIcon) => {
			// The source image will be double the size of the target icon to improve quality
			const size = IMAGE_SIZE * 2;
			const iconImage = new Image(size, size);
			iconImage.onload = () => map.current?.addImage(svgIcon.id, iconImage)
			iconImage.src = svgIcon.image.src;
		});

		map.current?.addImage("regular-dot", regularDot(map.current!));
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
		map.current?.addSource("points", {
			type: "geojson",
			data: {
				type: "FeatureCollection",
				features: restaurants.map((entry) => ({
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
					}
				})),
			},
		});
	}

	function addLayers() {
		map.current?.addLayer({
			id: "points",
			type: "symbol",
			source: "points",
			layout: {
				"icon-image": "restaurant",
				"icon-allow-overlap": true,
				"icon-size": 0.5,
				"icon-overlap": "always",
			},
		});

		map.current?.addLayer({
			id: "points-name",
			type: "symbol",
			source: "points",
			layout: {
				"text-field": ["format", ["get", "name"], {}, "\n", ["get", "rating"]],
				"text-size": 12,
				"text-offset": [1.3, 0.0],
				"text-anchor": "left",
				"text-font": ["Inter"],
				"text-justify": "left",
				"visibility": "none", // Initially hidden
			},
			paint: {
				"text-color": "#C94079",
			},
		});
	}

	function addEventListeners() {
		map.current?.on('click', 'points', (e) => {
			if (!map.current) {
				console.log("Map not loaded on point click");
				return;
			}

			if (!e.features) {
				console.log("No features on map point click");
				return;
			}

			const geometry = e.features[0].geometry;
			if (!geometry.type || geometry.type !== "Point") {
				console.log("No geometry on point click");
				return;
			}

			const coordinates = geometry.coordinates as [number, number];

            map.current?.flyTo({
                center: coordinates,
				speed: 0.8,
				zoom: 15,
            });
			// new Popup()
            //     .setLngLat(coordinates)
            //     .setHTML(`<p style="color: black">${e.features[0].properties.name}</p><p style="color: black">${e.features[0].properties.rating}</p>`)
            //     .addTo(map.current);
        });

		// TODO on click and stuff
	}

	function addZoomEventListener() {
		map.current?.on('zoom', () => {
			const zoom = map.current?.getZoom();
			if (zoom && zoom >= 10) {
				map.current?.setLayoutProperty('points-name', 'visibility', 'visible');
			} else {
				map.current?.setLayoutProperty('points-name', 'visibility', 'none');
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
		console.log("Map loaded");
	}

	useEffect(() => {
		const fetchDataAndLoadMap = async () => {
			const lastModifiedDate = await fetch("/api/restaurants/lastUpdated", {cache: "no-store"})
			.then((response) => response.json());

			const restaurants = await fetch(`/api/restaurants?lastModifiedDate=${lastModifiedDate}`,
				{cache: "force-cache"}
			)
			.then((response) => response.json());

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
