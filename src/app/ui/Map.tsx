"use client";

import styles from "./map.module.css";
import { useEffect, useRef } from "react";
import { Map as MapGL, AttributionControl } from "maplibre-gl";

export function MapComponent() {
	const map = useRef<MapGL>();

	useEffect(() => {
		map.current = new MapGL({
			container: "mapElem",
			style: "./map-style.json",
			center: [-9.10595458097556, 38.77395075041862],
			zoom: 10,
			// attributionControl: false,
		});
		// map.current.addControl(new AttributionControl(), "bottom-left");
	}, []);

	return <div id="mapElem" className={styles.mapElem} />;
}
