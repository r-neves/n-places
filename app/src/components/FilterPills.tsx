"use client";

import { JSX, useEffect, useRef, useState } from "react";
import styles from "./filter-pills.module.css";
import { ChevronDown } from "@/lib/constants/svg";
import { PriceMap, RatingMap, RestaurantTypeMap } from "./restaurant-items";
import {
    EMPTY_FILTERS,
    FilterOptions,
    PlaceFilters,
    RatingFilter,
    activeFilterCount,
    ratingLabel,
} from "./place-filters";

interface FilterPillsProps {
    options: FilterOptions;
    filters: PlaceFilters;
    onChange: (next: PlaceFilters) => void;
}

interface Pill {
    id: string;
    // What the pill reads when nothing is picked.
    label: string;
    // What it reads once something is — null keeps the plain label.
    value: string | null;
    onClear: () => void;
    panel: JSX.Element;
}

// The filter row under the search bar.
//
// The pills scroll horizontally, but the open dropdown does NOT live inside that scroller: an
// `overflow-x` container clips vertically too, which would cut the panel off at the row's own
// height. Only one filter is ever open, so a single panel is rendered as a sibling of the
// scroller and spans the full width beneath it.
export default function FilterPills({
    options,
    filters,
    onChange,
}: FilterPillsProps) {
    const [openId, setOpenId] = useState<string | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (openId === null) {
            return;
        }

        function handlePointerDown(event: MouseEvent | TouchEvent) {
            if (
                containerRef.current &&
                !containerRef.current.contains(event.target as Node)
            ) {
                setOpenId(null);
            }
        }

        function handleKeyDown(event: KeyboardEvent) {
            if (event.key === "Escape") {
                setOpenId(null);
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
    }, [openId]);

    const toggleValue = (
        key: "types" | "ambience" | "recommenders",
        value: string
    ) => {
        const current = filters[key];
        onChange({
            ...filters,
            [key]:
                current.indexOf(value) === -1
                    ? current.concat([value])
                    : current.filter((item) => item !== value),
        });
    };

    // Label for a multi-select pill. One pick reads as itself and needs no qualifier; several
    // fall back to a count kept next to the filter's name, because a bare "3" on a row of three
    // multi-selects says nothing about which one is narrowed. A comma list is not an option —
    // it would blow the row's width open on a phone.
    const multiValue = (label: string, selected: string[]): string | null => {
        if (selected.length === 0) {
            return null;
        }

        return selected.length === 1
            ? selected[0]
            : label + " · " + selected.length;
    };

    const multiPanel = (
        key: "types" | "ambience" | "recommenders",
        available: string[],
        withIcons: boolean
    ) => (
        <div role="group">
            {available.map((option) => {
                const isSelected = filters[key].indexOf(option) !== -1;
                const item = withIcons
                    ? RestaurantTypeMap[option.toLocaleLowerCase()]
                    : undefined;

                return (
                    <button
                        key={option}
                        type="button"
                        aria-pressed={isSelected}
                        className={`${styles.option} ${
                            isSelected ? styles.optionSelected : ""
                        }`}
                        onClick={() => toggleValue(key, option)}
                    >
                        {item && (
                            /* eslint-disable-next-line @next/next/no-img-element */
                            <img
                                className={styles.optionIcon}
                                src={
                                    isSelected
                                        ? item.selectedImage.src
                                        : item.image.src
                                }
                                alt=""
                            />
                        )}
                        <span className={styles.optionLabel}>{option}</span>
                        <span
                            className={styles.check}
                            style={
                                isSelected && item
                                    ? { color: item.color }
                                    : undefined
                            }
                            aria-hidden="true"
                        >
                            {isSelected ? "✓" : ""}
                        </span>
                    </button>
                );
            })}
        </div>
    );

    // Single-select list with an "Any" row at the top, which is also how a filter gets cleared
    // from inside its own panel.
    const singlePanel = (
        entries: { key: string; label: string; color?: string }[],
        selectedKey: string | null,
        onSelect: (key: string | null) => void
    ) => (
        <div role="radiogroup">
            <button
                type="button"
                role="radio"
                aria-checked={selectedKey === null}
                className={`${styles.option} ${
                    selectedKey === null ? styles.optionSelected : ""
                }`}
                onClick={() => onSelect(null)}
            >
                <span className={styles.optionLabel}>Any</span>
                <span className={styles.check} aria-hidden="true">
                    {selectedKey === null ? "✓" : ""}
                </span>
            </button>
            {entries.map((entry) => {
                const isSelected = selectedKey === entry.key;

                return (
                    <button
                        key={entry.key}
                        type="button"
                        role="radio"
                        aria-checked={isSelected}
                        className={`${styles.option} ${
                            isSelected ? styles.optionSelected : ""
                        }`}
                        onClick={() => onSelect(entry.key)}
                    >
                        {entry.color && (
                            <span
                                className={styles.swatch}
                                style={{ backgroundColor: entry.color }}
                                aria-hidden="true"
                            />
                        )}
                        <span className={styles.optionLabel}>
                            {entry.label}
                        </span>
                        <span className={styles.check} aria-hidden="true">
                            {isSelected ? "✓" : ""}
                        </span>
                    </button>
                );
            })}
        </div>
    );

    const pills: Pill[] = [];

    if (options.types.length > 0) {
        pills.push({
            id: "types",
            label: "Type",
            value: multiValue("Type", filters.types),
            onClear: () => onChange({ ...filters, types: [] }),
            panel: multiPanel("types", options.types, true),
        });
    }

    if (options.ratings.length > 0) {
        const best = options.ratings[0];
        // "New" sits in the same list as the thresholds: a threshold already implies the place
        // was visited, so picking both could never mean anything.
        const entries = [
            { key: "new", label: "New (not visited)", color: RatingMap["Not Visited"].color },
        ].concat(
            options.ratings.map((score) => ({
                key: String(score),
                label:
                    score >= best
                        ? score + "/10"
                        : score + "/10 or higher",
                color: RatingMap[score + "/10"]
                    ? RatingMap[score + "/10"].color
                    : undefined,
            })) as { key: string; label: string; color: string }[]
        );

        const selectedKey =
            filters.rating === null
                ? null
                : filters.rating.kind === "new"
                ? "new"
                : String(filters.rating.value);

        pills.push({
            id: "rating",
            label: "Rating",
            value:
                filters.rating === null
                    ? null
                    : ratingLabel(filters.rating, best),
            onClear: () => onChange({ ...filters, rating: null }),
            panel: singlePanel(entries, selectedKey, (key) => {
                let rating: RatingFilter | null = null;
                if (key === "new") {
                    rating = { kind: "new" };
                } else if (key !== null) {
                    rating = { kind: "min", value: Number(key) };
                }

                onChange({ ...filters, rating: rating });
            }),
        });
    }

    if (options.prices.length > 0) {
        const cheapest = options.prices[0].tier;
        const entries = options.prices.map((price) => ({
            key: String(price.tier),
            // The cheapest band has nothing below it, so "or lower" would be misleading.
            label:
                price.tier <= cheapest
                    ? price.name
                    : price.name + " or lower",
            color: PriceMap[price.name]
                ? PriceMap[price.name].color
                : undefined,
        }));

        const selectedPrice = options.prices.filter(
            (price) => price.tier === filters.maxPriceTier
        );

        pills.push({
            id: "price",
            label: "Price",
            value:
                selectedPrice.length > 0
                    ? (selectedPrice[0].tier <= cheapest ? "" : "≤ ") +
                      selectedPrice[0].name
                    : null,
            onClear: () => onChange({ ...filters, maxPriceTier: null }),
            panel: singlePanel(
                entries,
                filters.maxPriceTier === null
                    ? null
                    : String(filters.maxPriceTier),
                (key) =>
                    onChange({
                        ...filters,
                        maxPriceTier: key === null ? null : Number(key),
                    })
            ),
        });
    }

    if (options.ambience.length > 0) {
        pills.push({
            id: "ambience",
            label: "Ambience",
            value: multiValue("Ambience", filters.ambience),
            onClear: () => onChange({ ...filters, ambience: [] }),
            panel: multiPanel("ambience", options.ambience, false),
        });
    }

    if (options.recommenders.length > 0) {
        pills.push({
            id: "recommenders",
            label: "Recommender",
            value: multiValue("Recommender", filters.recommenders),
            onClear: () => onChange({ ...filters, recommenders: [] }),
            panel: multiPanel("recommenders", options.recommenders, false),
        });
    }

    if (pills.length === 0) {
        return null;
    }

    const openPill = pills.filter((pill) => pill.id === openId);
    const activeCount = activeFilterCount(filters);

    return (
        <div className={styles.container} ref={containerRef}>
            <div className={styles.row}>
                {pills.map((pill) => {
                    const isActive = pill.value !== null;

                    return (
                        <button
                            key={pill.id}
                            type="button"
                            className={`${styles.pill} ${
                                isActive ? styles.pillActive : ""
                            }`}
                            aria-haspopup="listbox"
                            aria-expanded={openId === pill.id}
                            onClick={() =>
                                setOpenId(openId === pill.id ? null : pill.id)
                            }
                        >
                            <span className={styles.pillLabel}>
                                {isActive ? pill.value : pill.label}
                            </span>
                            <span
                                className={`${styles.chevron} ${
                                    openId === pill.id ? styles.chevronOpen : ""
                                }`}
                                aria-hidden="true"
                            >
                                <ChevronDown />
                            </span>
                        </button>
                    );
                })}
                {activeCount > 0 && (
                    <button
                        type="button"
                        className={styles.clearAll}
                        onClick={() => {
                            onChange(EMPTY_FILTERS);
                            setOpenId(null);
                        }}
                    >
                        Clear ✕
                    </button>
                )}
            </div>

            {openPill.length > 0 && (
                <div className={styles.panel}>
                    <div className={styles.panelHeader}>
                        <span>{openPill[0].label}</span>
                        {openPill[0].value !== null && (
                            <button
                                type="button"
                                className={styles.panelClear}
                                onClick={() => openPill[0].onClear()}
                            >
                                Clear
                            </button>
                        )}
                    </div>
                    <div className={styles.panelBody}>{openPill[0].panel}</div>
                </div>
            )}
        </div>
    );
}
