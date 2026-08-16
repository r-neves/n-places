import { describe, expect, test } from "@jest/globals";
import { Restaurant } from "@/lib/places/domain/restaurant";
import {
    EMPTY_FILTERS,
    UNRATED_SCORE,
    activeFilterCount,
    buildFilterOptions,
    featureFilterProperties,
    filtersToExpression,
    priceTier,
    ratingLabel,
    ratingScore,
} from "./place-filters";

function place(overrides: Partial<Restaurant>): Restaurant {
    return {
        id: "id",
        name: "A place",
        mapsUrl: "https://maps.app.goo.gl/x",
        visited: false,
        rating: "",
        dishPrice: "",
        ambience: [],
        tags: [],
        location: "",
        recommender: "",
        description: "",
        review: "",
        metadata: { coordinates: { latitude: 0, longitude: 0 } },
        ...overrides,
    };
}

function tags(...names: string[]) {
    return names.map((name) => ({ tag: name, color: "default" }));
}

describe("ratingScore", () => {
    test("reads the leading number off the status label", () => {
        expect(ratingScore(place({ visited: true, rating: "8/10" }))).toBe(8);
        expect(ratingScore(place({ visited: true, rating: "10/10" }))).toBe(10);
    });

    test("scores an unvisited place below every threshold", () => {
        expect(ratingScore(place({ visited: false }))).toBe(UNRATED_SCORE);
    });

    test("a visited place with an unparseable label is not treated as new", () => {
        const score = ratingScore(place({ visited: true, rating: "great" }));

        expect(score).toBe(0);
        expect(score).not.toBe(UNRATED_SCORE);
    });
});

describe("priceTier", () => {
    test("ranks the bands cheapest first", () => {
        expect(priceTier("5-12 €")).toBe(1);
        expect(priceTier("13-20 €")).toBe(2);
        expect(priceTier("21-35 €")).toBe(3);
        expect(priceTier("+35 €")).toBe(4);
    });

    test("matches case-insensitively, and reports an unset band as 0", () => {
        expect(priceTier("+35 €".toLocaleUpperCase())).toBe(4);
        expect(priceTier("")).toBe(0);
        expect(priceTier("free")).toBe(0);
    });
});

describe("featureFilterProperties", () => {
    test("delimits the multi-valued fields so a lookup cannot match a substring", () => {
        const properties = featureFilterProperties(
            place({ tags: tags("Sushi"), ambience: tags("Bar", "Terrace") })
        );

        expect(properties.typesKey).toBe("|sushi|");
        expect(properties.ambienceKey).toBe("|bar|terrace|");

        // The delimiters are what stop "|bar|" from matching a "Sushi Bar" ambience.
        expect(
            featureFilterProperties(
                place({ ambience: tags("Sushi Bar") })
            ).ambienceKey
        ).not.toContain("|bar|");
    });

    test("an empty list produces an empty string, not a lone delimiter", () => {
        expect(featureFilterProperties(place({})).typesKey).toBe("");
    });
});

describe("buildFilterOptions", () => {
    const places = [
        place({
            tags: tags("Sushi"),
            ambience: tags("Casual"),
            recommender: "Ana",
            visited: true,
            rating: "8/10",
            dishPrice: "13-20 €",
        }),
        place({
            tags: tags("Asian", "Sushi"),
            ambience: tags("Casual", "Terrace"),
            recommender: "Ana",
            visited: true,
            rating: "10/10",
            dishPrice: "5-12 €",
        }),
        place({ tags: tags("Asian"), recommender: "Bruno" }),
    ];

    test("de-duplicates and sorts the multi-select options", () => {
        const options = buildFilterOptions(places, true);

        expect(options.types).toEqual(["Asian", "Sushi"]);
        expect(options.ambience).toEqual(["Casual", "Terrace"]);
        expect(options.recommenders).toEqual(["Ana", "Bruno"]);
    });

    test("offers ratings best-first and prices cheapest-first", () => {
        const options = buildFilterOptions(places, true);

        expect(options.ratings).toEqual([10, 8]);
        expect(options.prices).toEqual([
            { name: "5-12 €", tier: 1 },
            { name: "13-20 €", tier: 2 },
        ]);
    });

    test("offers only the values the loaded places actually use", () => {
        const options = buildFilterOptions(
            [place({ tags: tags("Sushi") })],
            true
        );

        // Nothing is rated or priced, so those pills have nothing to offer and disappear.
        expect(options.ratings).toEqual([]);
        expect(options.prices).toEqual([]);
        expect(options.types).toEqual(["Sushi"]);
    });

    test("withholds recommenders from non-admins", () => {
        expect(buildFilterOptions(places, false).recommenders).toEqual([]);
    });
});

describe("filtersToExpression", () => {
    test("is null when nothing is selected, so the caller can skip the update", () => {
        expect(filtersToExpression(EMPTY_FILTERS)).toBeNull();
    });

    test("emits a single clause bare and several under `all`", () => {
        expect(
            filtersToExpression({ ...EMPTY_FILTERS, types: ["Sushi"] })
        ).toEqual(["in", "|sushi|", ["get", "typesKey"]]);

        expect(
            filtersToExpression({
                ...EMPTY_FILTERS,
                types: ["Sushi"],
                rating: { kind: "min", value: 8 },
            })
        ).toEqual([
            "all",
            ["in", "|sushi|", ["get", "typesKey"]],
            [">=", ["get", "ratingScore"], 8],
        ]);
    });

    test("several values within one filter are an OR", () => {
        expect(
            filtersToExpression({
                ...EMPTY_FILTERS,
                recommenders: ["Ana", "Bruno"],
            })
        ).toEqual([
            "any",
            ["==", ["get", "recommender"], "Ana"],
            ["==", ["get", "recommender"], "Bruno"],
        ]);
    });

    test("the New rating matches only places with no rating yet", () => {
        expect(
            filtersToExpression({ ...EMPTY_FILTERS, rating: { kind: "new" } })
        ).toEqual(["==", ["get", "ratingScore"], UNRATED_SCORE]);
    });

    test("a price ceiling drops places with no band set", () => {
        expect(
            filtersToExpression({ ...EMPTY_FILTERS, maxPriceTier: 2 })
        ).toEqual([
            "all",
            [">", ["get", "priceTier"], 0],
            ["<=", ["get", "priceTier"], 2],
        ]);
    });
});

describe("activeFilterCount", () => {
    test("counts each filter once, however many values it holds", () => {
        expect(activeFilterCount(EMPTY_FILTERS)).toBe(0);
        expect(
            activeFilterCount({
                types: ["Sushi", "Asian"],
                ambience: [],
                recommenders: [],
                rating: { kind: "new" },
                maxPriceTier: null,
            })
        ).toBe(2);
    });
});

describe("ratingLabel", () => {
    test("drops the '+' at the top of the scale, where nothing is above it", () => {
        expect(ratingLabel({ kind: "min", value: 10 }, 10)).toBe("10/10");
        expect(ratingLabel({ kind: "min", value: 8 }, 10)).toBe("8/10+");
        expect(ratingLabel({ kind: "new" }, 10)).toBe("New");
    });
});
