// Smoke test: needs no database. Proves app.js can be tested in-process.
const request = require("supertest");
const app = require("../../app");

describe("app smoke", () => {
  it("GET / returns 200 OK", async () => {
    const res = await request(app).get("/");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ message: "OK" });
  });

  it.each(["/users", "/me", "/orders/all"])("GET %s without a token returns 401", async (path) => {
    const res = await request(app).get(path);
    expect(res.status).toBe(401);
  });

  it("GET /users with a forged token returns 403", async () => {
    const res = await request(app).get("/users").set("Authorization", "Bearer not.a.jwt");
    expect(res.status).toBe(403);
  });
});
