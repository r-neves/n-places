"use client";

import styles from "./map.module.css";
import { useEffect, useRef } from "react";
import { Map as MapGL, GeolocateControl } from "maplibre-gl";
import { pulsingDot } from "./pulsing-dot";
import { PlaceItem } from "../lib/services/places-storage/notion-integration";

interface MapComponentProps {
	dataPoints: PlaceItem[];
}

export function MapComponent({ dataPoints }: MapComponentProps) {
	const map = useRef<MapGL>();

	async function loadImages() {
		// biome-ignore lint/style/noNonNullAssertion:
		map.current?.addImage("pulsing-dot", pulsingDot(map.current!));
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
				"icon-image": "pulsing-dot",
				"icon-allow-overlap": true,
			},
		});
	}

	function addEventListeners() {
		// TODO on click and stuff
	}

	async function handleMapLoad(loadImgsPromise: Promise<void>) {
		await loadImgsPromise;
		//addGeolocationControl();
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
