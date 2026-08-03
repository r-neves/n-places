const { createDefaultPreset } = require("ts-jest");

const tsJestTransformCfg = createDefaultPreset().transform;

/** @type {import("jest").Config} **/
module.exports = {
  testEnvironment: "node",
  transform: {
    ...tsJestTransformCfg,
  },
  // Mirrors the "@/*" -> "./src/*" alias from tsconfig.json.
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
  },
  // *.integration.test.ts hits the live network. Excluded from `npm test` so the default suite
  // stays deterministic and offline; run those with `npm run test:integration`.
  testPathIgnorePatterns: ["/node_modules/", "\\.integration\\.test\\.ts$"],
};
