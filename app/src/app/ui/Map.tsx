"use client";

import styles from "./map.module.css";
import { useEffect, useRef } from "react";
import { Map as MapGL, GeolocateControl, Popup } from "maplibre-gl";
import { pulsingDot } from "./pulsing-dot";
import { regularDot } from "./regular-dot";
import { PlaceItem } from "../lib/services/places-storage/notion-integration";

interface MapComponentProps {
	dataPoints: PlaceItem[];
}

export function MapComponent({ dataPoints }: MapComponentProps) {
	const map = useRef<MapGL>();

	async function loadImages() {
		// biome-ignore lint/style/noNonNullAssertion:
		map.current?.addImage("regular-dot", regularDot(map.current!));
	}

	function addGeolocationControl() {
		// navigator.geolocation.getCurrentPosition((position) => {
		// 	console.log("Geolocation", position);
		// });

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

	function setSourceData() {
		map.current?.addSource("points", {
			type: "geojson",
			data: {
				type: "FeatureCollection",
				features: dataPoints.map((entry) => ({
					type: "Feature",
					geometry: {
						type: "Point",
						coordinates: [Number(entry.longitude), Number(entry.latitude)],
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
				"icon-image": "regular-dot",
				"icon-allow-overlap": true,
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
				speed: 0.5,
            });
			new Popup()
                .setLngLat(coordinates)
                .setHTML(`<p style="color: black">${e.features[0].properties.name}</p><p style="color: black">${e.features[0].properties.rating}</p>`)
                .addTo(map.current);
        });

		// TODO on click and stuff
	}

	async function handleMapLoad(loadImgsPromise: Promise<void>) {
		await loadImgsPromise;
		addGeolocationControl();
		setSourceData();
		addLayers();
		addEventListeners();
		console.log("Map loaded");
	}

	useEffect(() => {
		map.current = new MapGL({
			container: "mapElem",
			style: "./map-style.json",
			center: [-9.10595458097556, 38.77395075041862],
			zoom: 10,
		});
		const loadPromise = loadImages();
		map.current.on("load", () => {
			handleMapLoad(loadPromise);
		});
	}, [dataPoints]);

	return <div id="mapElem" className={styles.mapElem} />;
}
