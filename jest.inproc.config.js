// In-process unit + integration tests (supertest + in-memory MongoDB).
// These are the tests that produce code coverage.
module.exports = {
  testTimeout: 30000,
  testEnvironment: "node",
  testMatch: ["<rootDir>/__tests__/unit/**/*.test.js", "<rootDir>/__tests__/integration/**/*.test.js"],
  setupFiles: ["<rootDir>/__tests__/helpers/env.js"],
  collectCoverageFrom: ["app.js", "endpoints/**/*.js", "models/**/*.js"],
  coverageReporters: ["text", "text-summary", "html", "cobertura"],
  coverageDirectory: "coverage",
  reporters: ["default", ["jest-junit", { outputDirectory: "reports", outputName: "junit-inproc.xml" }]],
};
