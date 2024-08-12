import styles from "./page.module.css";
import {lazy } from "react";
import Loading from "./loading";

const MapComponent = lazy(() => import("../components/Map"));

export default async function Home() {

	return (
		<main className={styles.main}>
			<Loading />
            <MapComponent dataPoints={[]} />
		</main>
	);
}
