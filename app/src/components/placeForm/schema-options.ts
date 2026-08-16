// Reading pickable option lists out of the live Notion schema.
//
// Shared by the add and edit screens so both offer exactly the same choices — the alternative is
// two copies of the casing rules below, which is precisely the kind of thing that drifts.

import { DatabaseSchema } from "@/lib/places/domain/restaurant";
import { RestaurantTypeMap } from "../restaurant-items";

// Notion spells the "not visited" status with a lowercase v; RatingMap keys it with a capital
// one. Everything that crosses that boundary has to compare case-insensitively or it silently
// gets undefined (and PlaceCard.tsx carries the same defence).
export function lookupColor(
    map: { [key: string]: { color: string } },
    value: string
): string | undefined {
    if (!value) {
        return undefined;
    }

    const direct = map[value];
    if (direct) {
        return direct.color;
    }

    const normalized = value.toLocaleLowerCase();
    const keys = Object.keys(map);
    for (let i = 0; i < keys.length; i++) {
        if (keys[i].toLocaleLowerCase() === normalized) {
            return map[keys[i]].color;
        }
    }

    return undefined;
}

// `label` is the lowercased Notion column name, matching NOTION_LABELS in property-map.ts.
export function schemaOptions(
    schema: DatabaseSchema | null,
    label: string
): string[] {
    if (!schema || !schema.properties) {
        return [];
    }

    const propertyNames = Object.keys(schema.properties);
    for (let i = 0; i < propertyNames.length; i++) {
        if (propertyNames[i].toLocaleLowerCase() !== label) {
            continue;
        }

        const property = schema.properties[propertyNames[i]];
        const container =
            property.status || property.multi_select || property.select;

        if (container && container.options) {
            return container.options.map((option) => option.name);
        }
    }

    return [];
}

// Only cuisine types RestaurantTypeMap has an icon and colour for are offered. Notion will
// happily create a brand new multi-select option for anything sent to it, and PlaceCard does an
// unguarded RestaurantTypeMap[tag].color lookup — so an unrecognised type saved here would
// crash the card for that place later.
export function intersectWithKnownTypes(options: string[]): string[] {
    return options.filter(
        (option) => RestaurantTypeMap[option.toLocaleLowerCase()] !== undefined
    );
}
