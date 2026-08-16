import { ExpressionSpecification } from "maplibre-gl";
import { Restaurant } from "@/lib/places/domain/restaurant";
import { PriceMap } from "./restaurant-items";

// The pill filters, and everything needed to turn them into a MapLibre layer filter.
//
// MapLibre can only test the flat properties baked onto a feature, so the multi-valued fields
// (types, ambience) are flattened into delimited strings by featureFilterProperties below and
// the rating/price are reduced to comparable numbers. Keeping that encoding next to the
// expressions that read it is the point of this file: the two have to agree exactly.

// null in any slot means "not filtering on this".
export interface PlaceFilters {
    types: string[];
    ambience: string[];
    recommenders: string[];
    rating: RatingFilter | null;
    // Inclusive ceiling on PriceMap's tier, i.e. "this band or cheaper".
    maxPriceTier: number | null;
}

// "new" is the places with no rating yet. It is a value in the same single-select list as the
// thresholds rather than a separate control: a threshold already implies the place was visited,
// so the two can never both apply.
export type RatingFilter = { kind: "new" } | { kind: "min"; value: number };

export interface PriceOption {
    name: string;
    tier: number;
}

// Only what the loaded places actually use — an option nobody has tagged would filter to an
// empty map.
export interface FilterOptions {
    types: string[];
    ambience: string[];
    recommenders: string[];
    // Descending, so the dropdown reads best-first.
    ratings: number[];
    // Ascending by tier, cheapest first.
    prices: PriceOption[];
}

export const EMPTY_FILTERS: PlaceFilters = {
    types: [],
    ambience: [],
    recommenders: [],
    rating: null,
    maxPriceTier: null,
};

// Score for a place with no rating yet. Below every real rating, so a "7/10 or higher"
// threshold excludes it without needing a second clause.
export const UNRATED_SCORE = -1;

// Multi-valued fields are flattened to "|sushi|asian|" rather than "sushi, asian": MapLibre's
// `in` does a plain substring test on a string haystack, and an undelimited join would let
// "bar" match "sushi bar". Wrapping every value makes each lookup a whole-value match.
const SEPARATOR = "|";

function joinValues(values: string[]): string {
    if (values.length === 0) {
        return "";
    }

    return (
        SEPARATOR +
        values.map((value) => value.toLocaleLowerCase()).join(SEPARATOR) +
        SEPARATOR
    );
}

function needle(value: string): string {
    return SEPARATOR + value.toLocaleLowerCase() + SEPARATOR;
}

// Notion stores the rating as a status label ("8/10"), already lowercased by the read path.
// A visited place whose label does not parse scores 0: still not "new", but below any threshold.
export function ratingScore(place: Restaurant): number {
    if (!place.visited) {
        return UNRATED_SCORE;
    }

    const score = parseInt(place.rating, 10);
    return Number.isFinite(score) ? score : 0;
}

// PlaceCard already has to look PriceMap up case-insensitively (see AddPlaceScreen's
// lookupColor for why), and so does this.
export function priceTier(dishPrice: string): number {
    if (!dishPrice) {
        return 0;
    }

    const direct = PriceMap[dishPrice];
    if (direct) {
        return direct.tier;
    }

    const normalized = dishPrice.toLocaleLowerCase();
    const keys = Object.keys(PriceMap);
    for (let i = 0; i < keys.length; i++) {
        if (keys[i].toLocaleLowerCase() === normalized) {
            return PriceMap[keys[i]].tier;
        }
    }

    return 0;
}

// The extra GeoJSON feature properties the filter expressions read. Merged into the properties
// Map.tsx already sets on each feature.
export function featureFilterProperties(place: Restaurant) {
    return {
        typesKey: joinValues(place.tags.map((t) => t.tag)),
        ambienceKey: joinValues(place.ambience.map((t) => t.tag)),
        ratingScore: ratingScore(place),
        priceTier: priceTier(place.dishPrice),
    };
}

function sortedUnique(values: string[]): string[] {
    const seen: string[] = [];

    for (let i = 0; i < values.length; i++) {
        const value = values[i].trim();
        if (value.length > 0 && seen.indexOf(value) === -1) {
            seen.push(value);
        }
    }

    return seen.sort((a, b) => a.localeCompare(b));
}

// Recommenders are admin-only everywhere else in the app (PlaceCard hides the field, the search
// bar omits the entries), so the pill has to disappear for everyone else rather than just being
// unusable.
export function buildFilterOptions(
    places: Restaurant[],
    includeRecommenders: boolean
): FilterOptions {
    const types: string[] = [];
    const ambience: string[] = [];
    const recommenders: string[] = [];
    const ratings: number[] = [];
    const priceTiers: number[] = [];

    for (const place of places) {
        place.tags.forEach((t) => types.push(t.tag));
        place.ambience.forEach((t) => ambience.push(t.tag));

        if (includeRecommenders) {
            recommenders.push(place.recommender);
        }

        const score = ratingScore(place);
        if (score > 0 && ratings.indexOf(score) === -1) {
            ratings.push(score);
        }

        const tier = priceTier(place.dishPrice);
        if (tier > 0 && priceTiers.indexOf(tier) === -1) {
            priceTiers.push(tier);
        }
    }

    const prices: PriceOption[] = Object.keys(PriceMap)
        .map((name) => ({ name: name, tier: PriceMap[name].tier }))
        .filter((price) => priceTiers.indexOf(price.tier) !== -1)
        .sort((a, b) => a.tier - b.tier);

    return {
        types: sortedUnique(types),
        ambience: sortedUnique(ambience),
        recommenders: sortedUnique(recommenders),
        ratings: ratings.sort((a, b) => b - a),
        prices: prices,
    };
}

export function activeFilterCount(filters: PlaceFilters): number {
    let count = 0;

    if (filters.types.length > 0) count++;
    if (filters.ambience.length > 0) count++;
    if (filters.recommenders.length > 0) count++;
    if (filters.rating !== null) count++;
    if (filters.maxPriceTier !== null) count++;

    return count;
}

function anyOf(clauses: ExpressionSpecification[]): ExpressionSpecification {
    // A single clause is emitted bare: `any` needs at least one argument, and wrapping one is
    // just noise in the style debugger.
    return clauses.length === 1 ? clauses[0] : ["any", ...clauses];
}

// null when nothing is selected, so callers can skip the layer update entirely.
export function filtersToExpression(
    filters: PlaceFilters
): ExpressionSpecification | null {
    const clauses: ExpressionSpecification[] = [];

    if (filters.types.length > 0) {
        clauses.push(
            anyOf(
                filters.types.map(
                    (type): ExpressionSpecification => [
                        "in",
                        needle(type),
                        ["get", "typesKey"],
                    ]
                )
            )
        );
    }

    if (filters.ambience.length > 0) {
        clauses.push(
            anyOf(
                filters.ambience.map(
                    (value): ExpressionSpecification => [
                        "in",
                        needle(value),
                        ["get", "ambienceKey"],
                    ]
                )
            )
        );
    }

    if (filters.recommenders.length > 0) {
        clauses.push(
            anyOf(
                filters.recommenders.map(
                    (recommender): ExpressionSpecification => [
                        "==",
                        ["get", "recommender"],
                        recommender,
                    ]
                )
            )
        );
    }

    if (filters.rating !== null) {
        clauses.push(
            filters.rating.kind === "new"
                ? ["==", ["get", "ratingScore"], UNRATED_SCORE]
                : [">=", ["get", "ratingScore"], filters.rating.value]
        );
    }

    if (filters.maxPriceTier !== null) {
        // Places with no band set are dropped rather than kept: "13-20 € or lower" is a claim
        // about the price, and an unpriced place cannot support it.
        clauses.push([
            "all",
            [">", ["get", "priceTier"], 0],
            ["<=", ["get", "priceTier"], filters.maxPriceTier],
        ]);
    }

    if (clauses.length === 0) {
        return null;
    }

    return clauses.length === 1 ? clauses[0] : ["all", ...clauses];
}

export function ratingLabel(rating: RatingFilter, best: number): string {
    if (rating.kind === "new") {
        return "New";
    }

    // The top of the scale has nothing above it, so "10/10 or higher" would read oddly.
    return rating.value >= best
        ? rating.value + "/10"
        : rating.value + "/10+";
}
