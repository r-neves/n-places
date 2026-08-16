const { createDefaultPreset } = require("ts-jest");

const tsJestTransformCfg = createDefaultPreset().transform;

/** @type {import("jest").Config} **/
module.exports = {
  testEnvironment: "node",
  transform: {
    ...tsJestTransformCfg,
  },
  moduleNameMapper: {
    // Anything importing restaurant-items.ts drags in the marker PNGs, which jest cannot
    // parse. They stand in as a plain object shaped like next/image's import result.
    "\\.(png|jpe?g|gif|svg|webp)$": "<rootDir>/src/test/image-stub.js",
    // Mirrors the "@/*" -> "./src/*" alias from tsconfig.json.
    "^@/(.*)$": "<rootDir>/src/$1",
  },
  // *.integration.test.ts hits the live network. Excluded from `npm test` so the default suite
  // stays deterministic and offline; run those with `npm run test:integration`.
  testPathIgnorePatterns: ["/node_modules/", "\\.integration\\.test\\.ts$"],
};
