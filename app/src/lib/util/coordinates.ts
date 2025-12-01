import { parse } from "node-html-parser";

export async function getCoordinatesFromMapsUrl(
    index: number,
    mapsUrl: string
): Promise<{ index: number; latitude: number; longitude: number }> {
    return await fetch(mapsUrl)
        .then((response) => response.text())
        .then((text) => {
            const doc = parse(text).toString();
            const mapsLinkIndex = doc.search(
                "https://www.google.com/maps/place/"
            );
            const subString = doc.substring(mapsLinkIndex);
            const coordinatesBeginIndex = subString.indexOf("%40") + 3;
            const includedCoordinates = subString
                .substring(
                    coordinatesBeginIndex,
                    coordinatesBeginIndex + 30
                )
                .split(",");
            return {
                index: index,
                latitude: parseFloat(includedCoordinates[0]),
                longitude: parseFloat(includedCoordinates[1]),
            };
        });
}