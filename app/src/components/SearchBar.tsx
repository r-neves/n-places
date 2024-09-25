"use client";

import { useState } from "react";
import styles from "./search-bar.module.css";
import { normalizeString } from "@/lib/util/format";

export interface SearchItem {
    label: string;
    type: "place" | "tag" | "location" | "state";
    clickHandler: () => void;
}

export function SearchBar({
    isMapLoaded,
    searchItems,
    resetFiltersHandler,
}: {
    isMapLoaded: boolean;
    searchItems: SearchItem[];
    resetFiltersHandler: () => void;
}) {
    const [filteredItems, setFilteredItems] = useState<SearchItem[]>([]);
    const [inputValue, setInputValue] = useState("");

    if (!isMapLoaded) {
        return null;
    }

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setInputValue(e.target.value);

        const searchQuery = normalizeString(e.target.value);
        if (searchQuery === "") {
            resetSearchHandler();
            return;
        }

        setInputValue(e.target.value);

        const filteredItems = searchItems.filter((item) =>
            normalizeString(item.label).includes(searchQuery)
        );

        setFilteredItems(filteredItems);
    };

    const handleSelect = (item: SearchItem) => {
        resetSearchHandler();
        setInputValue(item.label);
        item.clickHandler();
    };

    const resetSearchHandler = () => {
        setInputValue("");
        setFilteredItems([]);
        resetFiltersHandler();
    }

    const itemType = (item: SearchItem) => {
        switch (item.type) {
            case "place":
                return "Restaurant";
            case "tag":
                return "Tag";
            case "location":
                return "Location";
            case "state":
                return "State";
        }
    }

    return (
        <div className={styles.searchWrapper}>
            <div className={styles.searchDiv}>
                <div className={styles.searchBar}>
                    <input
                        type="text"
                        placeholder="Names, Tags, Locations..."
                        className={styles.searchInput}
                        value={inputValue}
                        onChange={handleChange}
                    />
                    {inputValue === "" ? (
                        <svg
                            className={styles.searchIcon}
                            xmlns="http://www.w3.org/2000/svg"
                            width="24"
                            height="24"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        >
                            <path stroke="none" d="M0 0h24v24H0z" fill="none" />
                            <path d="M10 10m-7 0a7 7 0 1 0 14 0a7 7 0 1 0 -14 0" />
                            <path d="M21 21l-6 -6" />
                        </svg>
                    ) : (
                        <svg
                            className={styles.resetIcon}
                            onClick={resetSearchHandler}
                            xmlns="http://www.w3.org/2000/svg"
                            width="24"
                            height="24"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        >
                            <path stroke="none" d="M0 0h24v24H0z" fill="none" />
                            <path d="M18 6l-12 12" />
                            <path d="M6 6l12 12" />
                        </svg>
                    )}
                </div>
                <ul className={styles.searchSuggestions}>
                    {filteredItems.map((item) => (
                        <li
                            className={styles.searchSuggestion}
                            key={item.label}
                            onClick={() => handleSelect(item)}
                        >
                            <span>{item.label}</span> <span className={styles.itemType}>({itemType(item)})</span> 
                        </li>
                    ))}
                </ul>
            </div>
        </div>
    );
}
