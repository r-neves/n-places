// MapLibre 6 runs its tile work in a module worker that imports a sibling maplibre-gl-shared.mjs.
// Turbopack emits the worker as a hashed asset without that sibling, so the worker dies on its
// first import and the map never loads a tile. Serving both files from public/ keeps the relative
// import intact; Map.tsx points setWorkerUrl at the copy.
//
// Runs before every dev/build so the copy always matches the installed maplibre-gl version.
// See https://maplibre.org/maplibre-gl-js/docs/#installation (Turbopack tab).
import { copyFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

const dist = path.join(
    path.dirname(createRequire(import.meta.url).resolve("maplibre-gl/package.json")),
    "dist"
);
const dest = path.join(process.cwd(), "public", "maplibre");

mkdirSync(dest, { recursive: true });
for (const file of ["maplibre-gl-worker.mjs", "maplibre-gl-shared.mjs"]) {
    copyFileSync(path.join(dist, file), path.join(dest, file));
}
