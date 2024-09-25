"use client";

import styles from "./loading.module.css";
import { useEffect, useState } from "react";
import appLogo from "../../public/512px_map_logo_1.jpeg";

const loadingPhrases = [
    "Seasoning your map...",
    "Grabbing the best tables...",
    "Cooking up some delicious directions...",
    "Just a dash more patience!",
    "Plating your spots...",
    "Finding tasty places...",
];

export default function Loading({ isMapLoaded }: { isMapLoaded: boolean }) {
    const [currentPhrase, setCurrentPhrase] = useState("");

    useEffect(() => {
        // Set a random initial phrase after the component mounts
        const randomIndex = Math.floor(Math.random() * loadingPhrases.length);
        setCurrentPhrase(loadingPhrases[randomIndex]);

        const interval = setInterval(() => {
            setCurrentPhrase((prevPhrase) => {
                const currentIndex = loadingPhrases.indexOf(prevPhrase);
                const nextIndex = (currentIndex + 1) % loadingPhrases.length;
                return loadingPhrases[nextIndex];
            });
        }, 3000);

        return () => clearInterval(interval); // Cleanup interval on component unmount
    }, [loadingPhrases]);

    return (
        <main
            className={`${styles.loading} ${isMapLoaded ? styles.hidden : ""}`}
        >
            <img
                src={appLogo.src}
                alt={"App logo"}
                width={"90%"}
                height={"auto"}
            />
            <h2>{currentPhrase}</h2>
        </main>
    );
}
