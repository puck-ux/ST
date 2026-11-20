// R-I3 – Malformed or Unkown ID and Missing Field Robustness

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

afterAll(async () => {
  await db.close();
});

// unkown id with correct format
const UNKNOWN_ID = "000000000000000000000000";

describe("R-I3 robustness", () => {

  // P1

  test("ID that is one character too short", async () => {
    const res = await request(app).get("/order/00000000000000000000000").set(user.auth);

    expect(res.status).toBe(400);
  });

  test("ID that is one character too long", async () => {
    const res = await request(app).get("/order/0000000000000000000000000").set(user.auth);

    expect(res.status).toBe(400);
  });

  test("ID with non-hex character", async () => {
    const res = await request(app).get("/order/00000000000000000000000g").set(user.auth);

    expect(res.status).toBe(400);
  });

  // P2

  test("reading order that doesn't exist", async () => {
    const res = await request(app).get(`/order/${UNKNOWN_ID}`).set(user.auth);

    expect(res.status).toBe(404);
  });

  test("admin deleting a user that doesn't exist", async () => {
    const res = await request(app).delete(`/user/${UNKNOWN_ID}`).set(admin.auth);

    expect(res.status).toBe(404);
  });

  // P3

  test("registering with an empty body", async () => {
    const res = await request(app).post("/register").send({});

    expect(res.status).toBe(400);
  });

  test("logging in without a password", async () => {
    let status;
    try {
      const res = await request(app)
        .post("/login")
        .send({ email: user.user.email })
        .timeout(3000);
      status = res.status;
    } catch (err) {
      status = "no response";
    }

    expect(status).toBe(400);

    const stillAlive = await request(app).get("/");
    expect(stillAlive.status).toBe(200);
  });

  // P4

  test("200 random request bodies to POST /order", async () => {
    await fc.assert(
      fc.asyncProperty(fc.object(), async (randomBody) => {
        const res = await request(app).post("/order").set(user.auth).send(randomBody);
        expect(res.status).toBeLessThan(500);
      }),
      { numRuns: 200 }
    );

    const stillAlive = await request(app).get("/");
    expect(stillAlive.status).toBe(200);
  }, 120000);
});
