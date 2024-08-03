import Image from "next/image";
import styles from "./page.module.css";
import { MapComponent } from "../components/Map";
import { RestaurantsService, RestaurantsImpl } from "@/lib/places/service";
import { NotionAPIRestaurantsRepository } from "@/lib/places/repository/notion-api";
import { use, useEffect } from "react";

const restaurantDatabaseID = "ae713d53768640058a236c4bd1691198";

export default async function Home() {
	const date = new Date();

	return (
		<main className={styles.main}>
			<h1>Loading...</h1>
			<MapComponent dataPoints={[]} />
		</main>
	);
}
