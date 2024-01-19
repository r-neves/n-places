"use client";

import styles from "./map.module.css";
import { useEffect, useRef } from "react";
import { Map as MapGL, AttributionControl } from "maplibre-gl";
import { pulsingDot } from "./pulsing-dot";

export function MapComponent() {
	const map = useRef<MapGL>();

	async function loadImages() {
		// biome-ignore lint/style/noNonNullAssertion:
		map.current?.addImage("pulsing-dot", pulsingDot(map.current!));
	}

	function addEventListeners() {
		// TODO on click and stuff
	}

	async function handleMapLoad(loadImgsPromise: Promise<void>) {
		await loadImgsPromise;
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
	}, []);

	return <div id="mapElem" className={styles.mapElem} />;
}
