import { describe, expect, test } from "@jest/globals";
import { RepoDatabaseSchema, RepoNewRestaurant } from "../../places/repository/interface";
import {
    buildCreatePagePayload,
    buildUpdatePagePayload,
} from "./page-payload";
import {
    matchSchemaOption,
    matchSchemaOptions,
    resolvePropertyNames,
    schemaOptionNames,
} from "./property-map";

const DATA_SOURCE_ID = "ds-123";

// Mirrors the shape Notion returns from /v1/data_sources/{id}, with the display casing
// deliberately different from the lowercase labels the read path matches on.
const SCHEMA: RepoDatabaseSchema = {
    properties: {
        Name: { id: "title", type: "title", name: "Name" },
        Map: { id: "p1", type: "url", name: "Map" },
        Rating: {
            id: "p2",
            type: "status",
            name: "Rating",
            status: {
                options: [
                    { id: "o1", color: "gray", name: "Not visited" },
                    { id: "o2", color: "red", name: "3/10" },
                    { id: "o3", color: "green", name: "8/10" },
                ],
            },
        },
        Type: {
            id: "p3",
            type: "multi_select",
            name: "Type",
            multi_select: {
                options: [
                    { id: "t1", color: "blue", name: "Asian" },
                    { id: "t2", color: "pink", name: "Sushi" },
                    { id: "t3", color: "brown", name: "Terrace" },
                ],
            },
        },
        "Dish Price": {
            id: "p4",
            type: "select",
            name: "Dish Price",
            select: {
                options: [
                    { id: "d1", color: "green", name: "5-12 €" },
                    { id: "d2", color: "yellow", name: "13-20 €" },
                ],
            },
        },
        Ambience: {
            id: "p5",
            type: "multi_select",
            name: "Ambience",
            multi_select: {
                options: [{ id: "a1", color: "orange", name: "Cozy" }],
            },
        },
        Metadata: { id: "p6", type: "rich_text", name: "Metadata" },
        Location: { id: "p7", type: "rich_text", name: "Location" },
        Recommender: { id: "p8", type: "rich_text", name: "Recommender" },
        Description: { id: "p9", type: "rich_text", name: "Description" },
        Review: { id: "p10", type: "rich_text", name: "Review" },
    },
};

const NAMES = resolvePropertyNames(SCHEMA);

function newPlace(overrides?: Partial<RepoNewRestaurant>): RepoNewRestaurant {
    return Object.assign(
        {
            name: "Xiaolongkan Hot Pot",
            mapsUrl: "https://maps.app.goo.gl/abc",
            location: "Parque das Nações, Lisboa",
            rating: "Not visited",
            dishPrice: "13-20 €",
            tags: ["Asian"],
            ambience: ["Cozy"],
            recommender: "Sofia",
            description: "Great hotpot",
            metadata: {
                coordinates: { latitude: 38.767198, longitude: -9.0991259 },
            },
        },
        overrides || {}
    );
}

describe("resolvePropertyNames", () => {
    // The whole point: "dish price" (read label) must resolve to "Dish Price" (write name).
    test("maps our field names onto the schema's display casing", () => {
        expect(NAMES.name).toBe("Name");
        expect(NAMES.dishPrice).toBe("Dish Price");
        expect(NAMES.map).toBe("Map");
        expect(NAMES.rating).toBe("Rating");
        expect(NAMES.type).toBe("Type");
        expect(NAMES.metadata).toBe("Metadata");
    });

    test("tolerates any casing the database happens to use", () => {
        const resolved = resolvePropertyNames({
            properties: {
                "DISH PRICE": { id: "x", type: "select", name: "DISH PRICE" },
                nAmE: { id: "y", type: "title", name: "nAmE" },
            },
        });

        expect(resolved.dishPrice).toBe("DISH PRICE");
        expect(resolved.name).toBe("nAmE");
    });

    test("omits fields the database does not have", () => {
        const resolved = resolvePropertyNames({
            properties: { Name: { id: "x", type: "title", name: "Name" } },
        });

        expect(resolved.name).toBe("Name");
        expect(resolved.dishPrice).toBeUndefined();
    });

    test("survives an empty or malformed schema", () => {
        expect(resolvePropertyNames({ properties: {} })).toEqual({});
        expect(resolvePropertyNames({} as RepoDatabaseSchema)).toEqual({});
    });
});

describe("schema option matching", () => {
    test("reads option names for status, multi_select and select alike", () => {
        expect(schemaOptionNames(SCHEMA, "rating", NAMES)).toEqual([
            "Not visited",
            "3/10",
            "8/10",
        ]);
        expect(schemaOptionNames(SCHEMA, "type", NAMES)).toEqual([
            "Asian",
            "Sushi",
            "Terrace",
        ]);
        expect(schemaOptionNames(SCHEMA, "dishPrice", NAMES)).toEqual([
            "5-12 €",
            "13-20 €",
        ]);
        expect(schemaOptionNames(SCHEMA, "location", NAMES)).toEqual([]);
    });

    // Matching is case-insensitive but the *schema's* casing is what gets sent, so Notion never
    // auto-creates a near-duplicate option.
    test("returns the schema casing for a case-insensitive match", () => {
        const allowed = schemaOptionNames(SCHEMA, "rating", NAMES);

        expect(matchSchemaOption("not visited", allowed)).toBe("Not visited");
        expect(matchSchemaOption("  NOT VISITED  ", allowed)).toBe("Not visited");
        expect(matchSchemaOption("nope", allowed)).toBeNull();
        expect(matchSchemaOption("", allowed)).toBeNull();
    });

    test("drops unknown values and de-duplicates", () => {
        const allowed = schemaOptionNames(SCHEMA, "type", NAMES);

        expect(matchSchemaOptions(["asian", "SUSHI", "asian", "nonsense"], allowed)).toEqual(
            ["Asian", "Sushi"]
        );
        expect(matchSchemaOptions([], allowed)).toEqual([]);
    });
});

describe("buildCreatePagePayload", () => {
    test("targets the data source and shapes every property correctly", () => {
        const payload = buildCreatePagePayload(DATA_SOURCE_ID, newPlace(), NAMES);

        expect(payload.parent).toEqual({
            type: "data_source_id",
            data_source_id: DATA_SOURCE_ID,
        });
        expect(payload.properties["Name"]).toEqual({
            title: [{ type: "text", text: { content: "Xiaolongkan Hot Pot" } }],
        });
        expect(payload.properties["Map"]).toEqual({
            url: "https://maps.app.goo.gl/abc",
        });
        expect(payload.properties["Rating"]).toEqual({
            status: { name: "Not visited" },
        });
        expect(payload.properties["Type"]).toEqual({
            multi_select: [{ name: "Asian" }],
        });
        expect(payload.properties["Dish Price"]).toEqual({
            select: { name: "13-20 €" },
        });
        expect(payload.properties["Ambience"]).toEqual({
            multi_select: [{ name: "Cozy" }],
        });
        expect(payload.properties["Location"]).toEqual({
            rich_text: [
                {
                    type: "text",
                    text: { content: "Parque das Nações, Lisboa" },
                },
            ],
        });
    });

    test("serialises metadata the same way the read path expects", () => {
        const payload = buildCreatePagePayload(DATA_SOURCE_ID, newPlace(), NAMES);
        const metadata = payload.properties["Metadata"] as {
            rich_text: { text: { content: string } }[];
        };

        expect(JSON.parse(metadata.rich_text[0].text.content)).toEqual({
            coordinates: { latitude: 38.767198, longitude: -9.0991259 },
        });
    });

    test("never writes a review on create", () => {
        const payload = buildCreatePagePayload(DATA_SOURCE_ID, newPlace(), NAMES);

        expect(payload.properties["Review"]).toBeUndefined();
    });

    test("omits empty fields rather than sending nulls", () => {
        const payload = buildCreatePagePayload(
            DATA_SOURCE_ID,
            newPlace({
                mapsUrl: "",
                location: "   ",
                rating: "",
                dishPrice: "",
                tags: [],
                ambience: [],
                recommender: "",
                description: "",
            }),
            NAMES
        );

        expect(Object.keys(payload.properties)).toEqual(["Name", "Metadata"]);
    });

    // Leaving Metadata absent is what keeps hasFaultyMetadata set, so the backfill retries the
    // place instead of trusting a bogus coordinate forever.
    test("omits metadata when the coordinates are unusable", () => {
        const nullIsland = buildCreatePagePayload(
            DATA_SOURCE_ID,
            newPlace({
                metadata: { coordinates: { latitude: 0, longitude: 0 } },
            }),
            NAMES
        );
        const notANumber = buildCreatePagePayload(
            DATA_SOURCE_ID,
            newPlace({
                metadata: { coordinates: { latitude: NaN, longitude: NaN } },
            }),
            NAMES
        );
        const absent = buildCreatePagePayload(
            DATA_SOURCE_ID,
            newPlace({ metadata: null }),
            NAMES
        );

        expect(nullIsland.properties["Metadata"]).toBeUndefined();
        expect(notANumber.properties["Metadata"]).toBeUndefined();
        expect(absent.properties["Metadata"]).toBeUndefined();
    });

    test("skips fields the database has no column for", () => {
        const sparse = resolvePropertyNames({
            properties: { Name: { id: "x", type: "title", name: "Name" } },
        });
        const payload = buildCreatePagePayload(DATA_SOURCE_ID, newPlace(), sparse);

        expect(Object.keys(payload.properties)).toEqual(["Name"]);
    });

    test("truncates to Notion's length limits", () => {
        const payload = buildCreatePagePayload(
            DATA_SOURCE_ID,
            newPlace({
                name: "n".repeat(500),
                description: "d".repeat(5000),
            }),
            NAMES
        );
        const name = payload.properties["Name"] as {
            title: { text: { content: string } }[];
        };
        const description = payload.properties["Description"] as {
            rich_text: { text: { content: string } }[];
        };

        expect(name.title[0].text.content.length).toBe(200);
        expect(description.rich_text[0].text.content.length).toBe(2000);
    });
});

describe("buildUpdatePagePayload", () => {
    test("carries no parent — the page already exists", () => {
        const payload = buildUpdatePagePayload(newPlace(), NAMES);

        expect(payload).not.toHaveProperty("parent");
        expect(payload.properties.Name).toEqual({
            title: [{ type: "text", text: { content: "Xiaolongkan Hot Pot" } }],
        });
    });

    // The whole reason update needs its own builder: create omits blank fields, which on an
    // update would silently leave the old value in place and make a field impossible to empty.
    test("sends the empty form of every cleared field rather than omitting it", () => {
        const payload = buildUpdatePagePayload(
            newPlace({
                location: "",
                recommender: "",
                description: "",
                dishPrice: "",
                tags: [],
                ambience: [],
                mapsUrl: "",
            }),
            NAMES
        );

        expect(payload.properties.Location).toEqual({ rich_text: [] });
        expect(payload.properties.Recommender).toEqual({ rich_text: [] });
        expect(payload.properties.Description).toEqual({ rich_text: [] });
        expect(payload.properties["Dish Price"]).toEqual({ select: null });
        expect(payload.properties.Type).toEqual({ multi_select: [] });
        expect(payload.properties.Ambience).toEqual({ multi_select: [] });
        expect(payload.properties.Map).toEqual({ url: null });
    });

    test("whitespace-only text counts as cleared", () => {
        const payload = buildUpdatePagePayload(
            newPlace({ recommender: "   " }),
            NAMES
        );

        expect(payload.properties.Recommender).toEqual({ rich_text: [] });
    });

    test("writes the values it is given", () => {
        const payload = buildUpdatePagePayload(
            newPlace({
                rating: "8/10",
                dishPrice: "5-12 €",
                tags: ["Asian", "Sushi"],
                ambience: ["Cozy"],
            }),
            NAMES
        );

        expect(payload.properties.Rating).toEqual({
            status: { name: "8/10" },
        });
        expect(payload.properties["Dish Price"]).toEqual({
            select: { name: "5-12 €" },
        });
        expect(payload.properties.Type).toEqual({
            multi_select: [{ name: "Asian" }, { name: "Sushi" }],
        });
        expect(payload.properties.Ambience).toEqual({
            multi_select: [{ name: "Cozy" }],
        });
    });

    // A status property has no empty state, so a blank rating must leave the column untouched
    // rather than send null, which Notion rejects.
    test("omits the rating rather than trying to null a status", () => {
        const payload = buildUpdatePagePayload(
            newPlace({ rating: "" }),
            NAMES
        );

        expect(payload.properties).not.toHaveProperty("Rating");
    });

    // Coordinates are write-only on update: blanking them in the form must not drop the pin.
    test("leaves existing coordinates alone when none are supplied", () => {
        expect(
            buildUpdatePagePayload(newPlace({ metadata: null }), NAMES)
                .properties
        ).not.toHaveProperty("Metadata");

        expect(
            buildUpdatePagePayload(
                newPlace({
                    metadata: { coordinates: { latitude: 0, longitude: 0 } },
                }),
                NAMES
            ).properties
        ).not.toHaveProperty("Metadata");
    });

    test("writes coordinates that are usable", () => {
        const payload = buildUpdatePagePayload(newPlace(), NAMES);

        expect(payload.properties.Metadata).toEqual({
            rich_text: [
                {
                    type: "text",
                    text: {
                        content: JSON.stringify({
                            coordinates: {
                                latitude: 38.767198,
                                longitude: -9.0991259,
                            },
                        }),
                    },
                },
            ],
        });
    });

    test("never writes the review, same as create", () => {
        expect(
            buildUpdatePagePayload(newPlace(), NAMES).properties
        ).not.toHaveProperty("Review");
    });

    test("skips columns the database does not have", () => {
        const payload = buildUpdatePagePayload(newPlace(), {
            name: "Name",
        });

        expect(Object.keys(payload.properties)).toEqual(["Name"]);
    });
});
