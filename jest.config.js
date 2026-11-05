// Black-box system tests: run against a separately started server (node server.js).
module.exports = {
  testTimeout: 20000,
  testMatch: ["<rootDir>/__tests__/api/**/*.test.js", "<rootDir>/__tests__/db/**/*.test.js", "<rootDir>/__tests__/app/**/*.test.js"],
  globalSetup: "./__tests__/setup/setup.js",
  globalTeardown: "./__tests__/setup/teardown.js",
  modulePathIgnorePatterns: ["./__tests__/setup/*", "./__tests__/performance/*"],
  reporters: ["default", ["jest-junit", { outputDirectory: "reports", outputName: "junit-api.xml" }]],
};
