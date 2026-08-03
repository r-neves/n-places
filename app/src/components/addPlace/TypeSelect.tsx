"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./type-select.module.css";
import { RestaurantTypeMap } from "../restaurant-items";

interface TypeSelectProps {
    // Option names exactly as the Notion schema spells them.
    options: string[];
    selected: string[];
    onChange: (next: string[]) => void;
}

// Multi-select for cuisine types.
//
// Selection ORDER is significant, not just membership: splitRestaurantsByTag treats tags[0] as
// the main tag, which decides the map layer a place lands in and therefore the icon its marker
// gets. So the first pick is surfaced explicitly as the map pin, and can be changed without
// clearing the whole selection.
//
// A dropdown rather than a chip row because the database has 16 types — laid out horizontally
// that is a very long scroll to reach the later ones.
export default function TypeSelect({
    options,
    selected,
    onChange,
}: TypeSelectProps) {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!isOpen) {
            return;
        }

        function handlePointerDown(event: MouseEvent | TouchEvent) {
            if (
                containerRef.current &&
                !containerRef.current.contains(event.target as Node)
            ) {
                setIsOpen(false);
            }
        }

        function handleKeyDown(event: KeyboardEvent) {
            if (event.key === "Escape") {
                setIsOpen(false);
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
    }, [isOpen]);

    const toggle = (option: string) => {
        if (selected.indexOf(option) === -1) {
            // Appended, never prepended: the existing main tag must not change just because
            // another type was added.
            onChange(selected.concat([option]));
        } else {
            onChange(selected.filter((item) => item !== option));
        }
    };

    const promote = (option: string) => {
        onChange(
            [option].concat(selected.filter((item) => item !== option))
        );
    };

    const mainType = selected.length > 0 ? selected[0] : null;

    return (
        <div className={styles.container} ref={containerRef}>
            {/* The panel is anchored to this wrapper rather than to the container, so that the
                selected chips appearing below cannot push the open list down mid-selection —
                otherwise every pick shifts the next row out from under your finger. */}
            <div className={styles.triggerWrap}>
                <button
                    type="button"
                    className={styles.trigger}
                    aria-haspopup="listbox"
                    aria-expanded={isOpen}
                    onClick={() => setIsOpen(!isOpen)}
                >
                    <span
                        className={
                            selected.length > 0
                                ? styles.triggerLabel
                                : styles.triggerPlaceholder
                        }
                    >
                        {selected.length === 0
                            ? "Choose types"
                            : selected.length + " selected"}
                    </span>
                    <span
                        className={`${styles.chevron} ${
                            isOpen ? styles.chevronOpen : ""
                        }`}
                        aria-hidden="true"
                    >
                        ⌄
                    </span>
                </button>

                {isOpen && (
                    <div className={styles.panel} role="listbox" aria-multiselectable="true">
                        {options.map((option) => {
                            const item =
                                RestaurantTypeMap[option.toLocaleLowerCase()];
                            const isSelected = selected.indexOf(option) !== -1;

                            return (
                                <button
                                    key={option}
                                    type="button"
                                    role="option"
                                    aria-selected={isSelected}
                                    className={`${styles.row} ${
                                        isSelected ? styles.rowSelected : ""
                                    }`}
                                    onClick={() => toggle(option)}
                                >
                                    {item && (
                                        /* eslint-disable-next-line @next/next/no-img-element */
                                        <img
                                            className={styles.rowIcon}
                                            src={
                                                isSelected
                                                    ? item.selectedImage.src
                                                    : item.image.src
                                            }
                                            alt=""
                                        />
                                    )}
                                    <span className={styles.rowLabel}>
                                        {option}
                                    </span>
                                    {option === mainType && (
                                        <span className={styles.mainTag}>
                                            map pin
                                        </span>
                                    )}
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
                )}
            </div>

            {selected.length > 0 && (
                <>
                    <div className={styles.selectedRow}>
                        {selected.map((option, index) => {
                            const item =
                                RestaurantTypeMap[option.toLocaleLowerCase()];

                            return (
                                <span
                                    key={option}
                                    className={styles.chip}
                                    style={
                                        item
                                            ? { backgroundColor: item.color }
                                            : undefined
                                    }
                                >
                                    {index === 0 && (
                                        <span
                                            className={styles.pin}
                                            aria-label="Shown on the map"
                                        >
                                            📍
                                        </span>
                                    )}
                                    {index === 0 ? (
                                        <span className={styles.chipLabel}>
                                            {option}
                                        </span>
                                    ) : (
                                        <button
                                            type="button"
                                            className={styles.promoteBtn}
                                            title={
                                                "Use " +
                                                option +
                                                " for the map pin"
                                            }
                                            onClick={() => promote(option)}
                                        >
                                            {option}
                                        </button>
                                    )}
                                    <button
                                        type="button"
                                        className={styles.removeBtn}
                                        aria-label={"Remove " + option}
                                        onClick={() => toggle(option)}
                                    >
                                        ✕
                                    </button>
                                </span>
                            );
                        })}
                    </div>
                    {selected.length > 1 && (
                        <span className={styles.hint}>
                            📍 marks the type used for the map pin — tap another
                            to move it.
                        </span>
                    )}
                </>
            )}
        </div>
    );
}
