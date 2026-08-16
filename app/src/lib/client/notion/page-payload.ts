// Builds the body for Notion's "create a page" call.
//
// Kept pure and separate from the HTTP call so the property shapes — which are fiddly and
// easy to get subtly wrong — can be asserted in tests without a network or an API key.

import { RepoNewRestaurant } from "../../places/repository/interface";
import { isValidCoordinate } from "../../util/maps-scrape";
import { PlaceField, ResolvedPropertyNames } from "./property-map";

// Notion's limits. Exceeding either is a 400, so values are truncated rather than risking the
// whole create failing over a long description.
const MAX_TITLE_LENGTH = 200;
const MAX_RICH_TEXT_LENGTH = 2000;

function richText(content: string) {
    return {
        rich_text: [
            {
                type: "text",
                text: { content: content.substring(0, MAX_RICH_TEXT_LENGTH) },
            },
        ],
    };
}

function title(content: string) {
    return {
        title: [
            {
                type: "text",
                text: { content: content.substring(0, MAX_TITLE_LENGTH) },
            },
        ],
    };
}

function multiSelect(names: string[]) {
    return { multi_select: names.map((name) => ({ name: name })) };
}

export interface CreatePagePayload {
    parent: { type: "data_source_id"; data_source_id: string };
    properties: { [propertyName: string]: unknown };
}

export function buildCreatePagePayload(
    dataSourceID: string,
    place: RepoNewRestaurant,
    propertyNames: ResolvedPropertyNames
): CreatePagePayload {
    const properties: { [propertyName: string]: unknown } = {};

    // Skips fields whose column does not exist in this database rather than sending a key Notion
    // would reject.
    const set = (field: PlaceField, value: unknown) => {
        const propertyName = propertyNames[field];
        if (propertyName === undefined) {
            console.warn(
                "Notion property for field '%s' not found in schema, skipping",
                field
            );
            return;
        }

        properties[propertyName] = value;
    };

    // The only genuinely required field.
    set("name", title(place.name.trim()));

    if (place.mapsUrl) {
        set("map", { url: place.mapsUrl });
    }

    if (place.rating) {
        set("rating", { status: { name: place.rating } });
    }

    if (place.tags.length > 0) {
        set("type", multiSelect(place.tags));
    }

    if (place.dishPrice) {
        set("dishPrice", { select: { name: place.dishPrice } });
    }

    if (place.ambience.length > 0) {
        set("ambience", multiSelect(place.ambience));
    }

    if (place.location.trim()) {
        set("location", richText(place.location.trim()));
    }

    if (place.recommender.trim()) {
        set("recommender", richText(place.recommender.trim()));
    }

    if (place.description.trim()) {
        set("description", richText(place.description.trim()));
    }

    // Metadata is written only when the coordinates are actually usable. Leaving the property
    // absent is deliberate: tryParseMetadataField then throws on the next read, which sets
    // hasFaultyMetadata, which is exactly what makes the existing backfill retry the place.
    // Writing a placeholder like {"latitude":0,"longitude":0} would suppress that retry forever.
    if (
        place.metadata !== null &&
        isValidCoordinate(
            place.metadata.coordinates.latitude,
            place.metadata.coordinates.longitude
        )
    ) {
        set("metadata", richText(JSON.stringify(place.metadata)));
    }

    // "review" is intentionally never set on create — it is written later, by a human, once the
    // place has actually been visited.

    return {
        parent: { type: "data_source_id", data_source_id: dataSourceID },
        properties: properties,
    };
}
