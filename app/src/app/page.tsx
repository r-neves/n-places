import styles from "./page.module.css";
import MapComponent from "../components/Map";

export default async function Home() {
    return (
        <main className={styles.main}>
            <h3 className={styles.title}>Welcome to the Map App</h3>
        </main>
    );
}
