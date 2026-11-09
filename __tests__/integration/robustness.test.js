// R-I3: malformed or unknown IDs and missing fields must give 400/404, never 5xx or a crash.
// Techniques: boundary values on the 24-hex-character ObjectId, negative testing, property-based testing.
const request = require("supertest");
const fc = require("fast-check");
const app = require("../../app");
const db = require("../helpers/db");
const { makeUser } = require("../helpers/fixtures");

let user;
let admin;

beforeAll(async () => {
  await db.connect();
  user = await makeUser({ role: "User" });
  admin = await makeUser({ role: "Admin" });
});
afterAll(db.close);

describe("R-I3 P1 - wrong ID format (B1, boundaries)", () => {
  it.each([
    ["23 characters", "00000000000000000000000"],
    ["25 characters", "0000000000000000000000000"],
    ["24 characters with a non-hex character", "00000000000000000000000g"],
  ])("GET /order/:id with %s -> 400", async (_label, id) => {
    const res = await request(app).get(`/order/${id}`).set(user.auth);
    expect(res.status).toBe(400);
  });
});

describe("R-I3 P2 - unknown but well-formed ID (B2, boundary)", () => {
  const UNKNOWN = "000000000000000000000000"; // exactly 24 hex characters

  it("GET /order/:id -> 404", async () => {
    const res = await request(app).get(`/order/${UNKNOWN}`).set(user.auth);
    expect(res.status).toBe(404);
  });

  it("DELETE /user/:id as admin -> 404", async () => {
    const res = await request(app).delete(`/user/${UNKNOWN}`).set(admin.auth);
    expect(res.status).toBe(404); // RED: null dereference gives 400 (F10)
  });
});

describe("R-I3 P3 - missing fields (B3)", () => {
  it("POST /register with {} -> 400", async () => {
    const res = await request(app).post("/register").send({});
    expect(res.status).toBe(400);
  });

  it("POST /login with no password -> 400, and the server still answers", async () => {
    let status;
    try {
      const res = await request(app).post("/login").send({ email: user.user.email }).timeout(3000);
      status = res.status;
    } catch (err) {
      status = "no response"; // F7: bcrypt throws outside the try/catch, so no reply is sent
    }
    expect(status).toBe(400);
    const alive = await request(app).get("/");
    expect(alive.status).toBe(200);
  });
});

describe("R-I3 P4 - generated input (B4, property-based)", () => {
  it("200 random JSON bodies to POST /order never give a 5xx, server still answers", async () => {
    await fc.assert(
      fc.asyncProperty(fc.object(), async (body) => {
        const res = await request(app).post("/order").set(user.auth).send(body);
        expect(res.status).toBeLessThan(500);
      }),
      { numRuns: 200 }
    );
    const alive = await request(app).get("/");
    expect(alive.status).toBe(200);
  }, 120000);
});
