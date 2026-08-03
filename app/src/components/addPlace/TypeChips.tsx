"use client";

import styles from "./add-place-chips.module.css";
import { RestaurantTypeMap } from "../restaurant-items";

interface TypeChipsProps {
    // Option names exactly as the Notion schema spells them.
    options: string[];
    selected: string[];
    onToggle: (option: string) => void;
}

// Cuisine picker, using the same icons the map markers use.
//
// `options` is expected to already be narrowed to types RestaurantTypeMap knows about — see
// intersectWithKnownTypes in the add screen. PlaceCard reads RestaurantTypeMap[tag].color
// without a guard, so a tag that is not in the map crashes the card once the place is on the
// map. Constraining the picker is what stops that from ever being created.
export default function TypeChips({
    options,
    selected,
    onToggle,
}: TypeChipsProps) {
    return (
        <div className={styles.chipRow} role="group" aria-label="Type">
            {options.map((option) => {
                const item = RestaurantTypeMap[option.toLocaleLowerCase()];
                const isSelected = selected.indexOf(option) !== -1;

                return (
                    <button
                        key={option}
                        type="button"
                        aria-pressed={isSelected}
                        onClick={() => onToggle(option)}
                        className={`${styles.chip} ${styles.iconChip} ${
                            isSelected ? styles.chipSelected : ""
                        }`}
                        style={
                            isSelected && item
                                ? { backgroundColor: item.color }
                                : undefined
                        }
                    >
                        {item && (
                            /* eslint-disable-next-line @next/next/no-img-element */
                            <img
                                className={styles.chipIcon}
                                src={
                                    isSelected
                                        ? item.selectedImage.src
                                        : item.image.src
                                }
                                alt=""
                            />
                        )}
                        <span className={styles.chipLabel}>{option}</span>
                    </button>
                );
            })}
        </div>
    );
}
