import { describe, expect, test } from "@jest/globals";
import { buildCreatePagePayload } from "./page-payload";
import {
    matchSchemaOption,
    matchSchemaOptions,
    resolvePropertyNames,
    schemaOptionNames,
} from "./property-map";
import { RepoDatabaseSchema } from "../../places/repository/interface";

// Builds the create payload against the *live* Notion schema and asserts it matches the shapes
// that a manual POST /v1/pages was verified to accept. Read-only: nothing is written.
describe("create payload against the live schema", () => {
    test("resolves real property names and produces an accepted payload", async () => {
        const dataSourceID = process.env.RESTAURANTS_DATA_SOURCE_ID!;
        expect(dataSourceID).toBeTruthy();

        const response = await fetch(
            `https://api.notion.com/v1/data_sources/${dataSourceID}`,
            {
                headers: {
                    Authorization: `Bearer ${process.env.NOTION_API_KEY}`,
                    "Notion-Version": `${process.env.NOTION_API_VERSION}`,
                },
            }
        );
        expect(response.ok).toBe(true);

        const schema: RepoDatabaseSchema = await response.json();
        const names = resolvePropertyNames(schema);

        // Every field the create path writes must resolve to a real column.
        expect(names.name).toBe("Name");
        expect(names.map).toBe("Map");
        expect(names.rating).toBe("Rating");
        expect(names.type).toBe("Type");
        expect(names.dishPrice).toBe("Dish Price");
        expect(names.ambience).toBe("Ambience");
        expect(names.metadata).toBe("Metadata");
        expect(names.location).toBe("Location");
        expect(names.recommender).toBe("Recommender");
        expect(names.description).toBe("Description");

        const ratingOptions = schemaOptionNames(schema, "rating", names);
        const typeOptions = schemaOptionNames(schema, "type", names);

        // Case-insensitive in, schema casing out.
        expect(matchSchemaOption("not visited", ratingOptions)).toBe(
            "Not Visited"
        );
        expect(matchSchemaOptions(["asian", "nonsense"], typeOptions)).toEqual([
            "Asian",
        ]);

        const payload = buildCreatePagePayload(
            dataSourceID,
            {
                name: "ZZ payload probe",
                mapsUrl: "https://maps.app.goo.gl/GcMfNb5CeNQ4nRsu8",
                location: "Vila Franca de Xira",
                rating: matchSchemaOption("not visited", ratingOptions)!,
                dishPrice: "13-20 €",
                tags: ["Asian"],
                ambience: ["Modern"],
                recommender: "Rodrigo",
                description: "probe",
                metadata: {
                    coordinates: { latitude: 38.9549507, longitude: -8.9910923 },
                },
            },
            names
        );

        console.info(
            "Payload that would be POSTed:\n%s",
            JSON.stringify(payload, null, 2)
        );

        // Identical in shape to the manual POST that Notion accepted.
        expect(payload.parent).toEqual({
            type: "data_source_id",
            data_source_id: dataSourceID,
        });
        expect(payload.properties["Rating"]).toEqual({
            status: { name: "Not Visited" },
        });
        expect(payload.properties["Dish Price"]).toEqual({
            select: { name: "13-20 €" },
        });
        expect(payload.properties["Type"]).toEqual({
            multi_select: [{ name: "Asian" }],
        });
    }, 30000);
});
