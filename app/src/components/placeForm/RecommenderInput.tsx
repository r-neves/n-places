"use client";

import { useEffect, useId, useRef, useState } from "react";
import styles from "./recommender-input.module.css";
import { normalizeString } from "@/lib/util/format";

interface RecommenderInputProps {
    // Names already used in the database, for the suggestion list.
    options: string[];
    value: string;
    onChange: (next: string) => void;
    className?: string;
}

// Free-text name field with autocomplete over the recommenders already in the database.
//
// Free text rather than a picker because Recommender is a rich_text property in Notion — there
// is no option list to choose from, and a first-time recommender has to be typeable. The
// suggestions only exist to keep the spelling of a repeat recommender consistent, which is what
// makes the map's recommender filter group them into one entry rather than three.
//
// Matches the search bar: suggestions appear as you type, filtered on a normalized substring so
// "andre" finds "André".
export default function RecommenderInput({
    options,
    value,
    onChange,
    className,
}: RecommenderInputProps) {
    const [suggestions, setSuggestions] = useState<string[]>([]);
    const containerRef = useRef<HTMLDivElement>(null);
    // Ties the input to its listbox for screen readers. Generated rather than hardcoded so the
    // id stays unique if this ever appears twice on a page.
    const listboxId = useId();

    useEffect(() => {
        if (suggestions.length === 0) {
            return;
        }

        function handlePointerDown(event: MouseEvent | TouchEvent) {
            if (
                containerRef.current &&
                !containerRef.current.contains(event.target as Node)
            ) {
                setSuggestions([]);
            }
        }

        function handleKeyDown(event: KeyboardEvent) {
            if (event.key === "Escape") {
                setSuggestions([]);
            }
        }

        document.addEventListener("mousedown", handlePointerDown);
        document.addEventListener("touchstart", handlePointerDown);
        document.addEventListener("keydown", handleKeyDown);

        return () => {
            document.removeEventListener("mousedown", handlePointerDown);
            document.removeEventListener("touchstart", handlePointerDown);
            document.removeEventListener("keydown", handleKeyDown);
        };
    }, [suggestions]);

    const handleChange = (next: string) => {
        onChange(next);

        const query = normalizeString(next);
        if (query === "") {
            setSuggestions([]);
            return;
        }

        const matches = options.filter(
            (option) =>
                normalizeString(option).indexOf(query) !== -1 &&
                // An exact match is not worth offering — it is already typed.
                normalizeString(option) !== query
        );

        setSuggestions(matches);
    };

    return (
        <div className={styles.container} ref={containerRef}>
            <input
                className={className}
                value={value}
                onChange={(e) => handleChange(e.target.value)}
                placeholder="Who suggested it?"
                autoCapitalize="words"
                autoComplete="off"
                spellCheck={false}
                role="combobox"
                aria-expanded={suggestions.length > 0}
                aria-controls={listboxId}
                aria-autocomplete="list"
            />
            {suggestions.length > 0 && (
                <ul
                    id={listboxId}
                    className={styles.suggestions}
                    role="listbox"
                >
                    {suggestions.map((option) => (
                        <li key={option}>
                            <button
                                type="button"
                                role="option"
                                aria-selected="false"
                                className={styles.suggestion}
                                onClick={() => {
                                    onChange(option);
                                    setSuggestions([]);
                                }}
                            >
                                {option}
                            </button>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
