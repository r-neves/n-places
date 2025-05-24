import styles from "./page.module.css";
import MapComponent from "../components/Map";

export default async function Home() {
    return (
        <main className={styles.main}>
            <h1 className={styles.title}>Welcome to the Map App</h1>
            <MapComponent/>
        </main>
    );
}
