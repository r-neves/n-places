"use client";

import styles from "./option-chips.module.css";

interface OptionChipsProps {
    options: string[];
    // Single-select passes a string, multi-select an array.
    selected: string | string[];
    onSelect: (option: string) => void;
    // Colour for the selected state, per option. Undefined falls back to the plain dark chip.
    colorFor?: (option: string) => string | undefined;
    // Ambience has no colour map, so it reuses PlaceCard's ambience pill palette instead.
    variant?: "default" | "ambience";
    wrap?: boolean;
    label: string;
}

// Pill picker for the schema-driven fields: rating, dish price and ambience.
export default function OptionChips({
    options,
    selected,
    onSelect,
    colorFor,
    variant = "default",
    wrap = false,
    label,
}: OptionChipsProps) {
    const isSelected = (option: string) =>
        Array.isArray(selected)
            ? selected.indexOf(option) !== -1
            : selected === option;

    return (
        <div
            className={`${styles.chipRow} ${wrap ? styles.wrapRow : ""}`}
            role="group"
            aria-label={label}
        >
            {options.map((option) => {
                const active = isSelected(option);
                const color = colorFor ? colorFor(option) : undefined;

                const classNames = [styles.chip];
                if (variant === "ambience") {
                    classNames.push(styles.ambienceChip);
                    if (active) {
                        classNames.push(styles.ambienceChipSelected);
                    }
                } else if (active) {
                    classNames.push(styles.chipSelected);
                }

                let style: React.CSSProperties | undefined;
                if (variant === "default" && color) {
                    // Unselected chips outline in their colour so the scale reads at a glance
                    // (grey -> red -> yellow -> green) before anything is picked.
                    style = active
                        ? { backgroundColor: color }
                        : { borderColor: color, color: "#616161" };
                }

                return (
                    <button
                        key={option}
                        type="button"
                        aria-pressed={active}
                        onClick={() => onSelect(option)}
                        className={classNames.join(" ")}
                        style={style}
                    >
                        {option}
                    </button>
                );
            })}
        </div>
    );
}
