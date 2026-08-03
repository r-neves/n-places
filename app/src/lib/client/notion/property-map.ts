// Resolves the display names of the Notion properties we write to.
//
// Reads get case-insensitivity for free: jsonEntryToPlaceItem lowercases every key before
// switching on it, so a column called "Dish Price", "Dish price" or "dish price" all parse. A
// write has no such luxury — Notion matches the property name exactly, and an unrecognised name
// is silently ignored rather than rejected. Rather than hardcoding a guess at the casing, the
// live schema is consulted and mapped back to our field names.

import {
    RepoDatabaseSchema,
    RepoSchemaOption,
} from "../../places/repository/interface";

export type PlaceField =
    | "name"
    | "map"
    | "rating"
    | "type"
    | "dishPrice"
    | "ambience"
    | "metadata"
    | "location"
    | "recommender"
    | "description"
    | "review";

// Lowercased Notion labels. These MUST stay in lockstep with the *Label constants in
// jsonEntryToPlaceItem (client.ts) — that function is the read side of this same mapping.
export const NOTION_LABELS: Record<PlaceField, string> = {
    name: "name",
    map: "map",
    rating: "rating",
    type: "type",
    dishPrice: "dish price",
    ambience: "ambience",
    metadata: "metadata",
    location: "location",
    recommender: "recommender",
    description: "description",
    review: "review",
};

export type ResolvedPropertyNames = Partial<Record<PlaceField, string>>;

export function resolvePropertyNames(
    schema: RepoDatabaseSchema
): ResolvedPropertyNames {
    const resolved: ResolvedPropertyNames = {};

    if (!schema || !schema.properties) {
        return resolved;
    }

    // Invert NOTION_LABELS once so the schema walk is a single pass.
    const labelToField: { [label: string]: PlaceField } = {};
    const fields = Object.keys(NOTION_LABELS) as PlaceField[];
    for (let i = 0; i < fields.length; i++) {
        labelToField[NOTION_LABELS[fields[i]]] = fields[i];
    }

    const propertyNames = Object.keys(schema.properties);
    for (let i = 0; i < propertyNames.length; i++) {
        const propertyName = propertyNames[i];
        const field = labelToField[propertyName.toLocaleLowerCase()];
        if (field !== undefined) {
            resolved[field] = propertyName;
        }
    }

    return resolved;
}

function optionsFor(
    schema: RepoDatabaseSchema,
    propertyName: string | undefined
): RepoSchemaOption[] {
    if (!propertyName || !schema || !schema.properties) {
        return [];
    }

    const property = schema.properties[propertyName];
    if (!property) {
        return [];
    }

    const container = property.status || property.multi_select || property.select;
    if (!container || !container.options) {
        return [];
    }

    return container.options;
}

// The option names Notion will accept for a given field, in schema order.
export function schemaOptionNames(
    schema: RepoDatabaseSchema,
    field: PlaceField,
    propertyNames?: ResolvedPropertyNames
): string[] {
    const names = propertyNames || resolvePropertyNames(schema);

    return optionsFor(schema, names[field]).map((option) => option.name);
}

// Matches a user-supplied value against the live schema and returns it in *the schema's* casing,
// or null when there is no match.
//
// This is the guard that keeps junk out of Notion. A multi_select or select silently creates any
// option name it has not seen before, which is how a tag nobody defined ends up in the database
// and then crashes PlaceCard's RestaurantTypeMap lookup. A status property does the opposite and
// hard-fails on an unknown name. Both problems disappear if only live schema values are ever sent.
export function matchSchemaOption(
    candidate: string,
    allowed: string[]
): string | null {
    if (!candidate) {
        return null;
    }

    const normalized = candidate.trim().toLocaleLowerCase();
    if (normalized.length === 0) {
        return null;
    }

    for (let i = 0; i < allowed.length; i++) {
        if (allowed[i].toLocaleLowerCase() === normalized) {
            return allowed[i];
        }
    }

    return null;
}

// Filters a list of candidates down to the ones the schema accepts, de-duplicated and in the
// schema's casing.
export function matchSchemaOptions(
    candidates: string[],
    allowed: string[]
): string[] {
    const matched: string[] = [];

    for (let i = 0; i < candidates.length; i++) {
        const match = matchSchemaOption(candidates[i], allowed);
        if (match !== null && matched.indexOf(match) === -1) {
            matched.push(match);
        }
    }

    return matched;
}
