// R-S1, R-S2: access-control matrix. Each row is one (endpoint, role) pair.
const request = require("supertest");
const app = require("../../app");
const db = require("../helpers/db");
const { makeUser, makeOrder } = require("../helpers/fixtures");

let actors = {};
let target;      // another ordinary user
let targetOrder; // an order owned by target

beforeAll(db.connect);
afterAll(db.close);

beforeEach(async () => {
  await db.clear();
  actors.admin = await makeUser({ role: "Admin" });
  actors.user = await makeUser({ role: "User" });
  target = await makeUser({ role: "User" });
  targetOrder = await makeOrder(target.user);
});

const matrix = [
  { label: "GET /users as user -> 403", method: "get", path: () => "/users", as: "user", status: 403 },
  { label: "GET /users as admin -> 200", method: "get", path: () => "/users", as: "admin", status: 200 },
  { label: "GET /user/:id as user -> 403", method: "get", path: () => `/user/${target.user.id}`, as: "user", status: 403 },
  { label: "GET /orders/user/:id as user -> 403", method: "get", path: () => `/orders/user/${target.user.id}`, as: "user", status: 403 },
  { label: "GET /orders/user/:id as admin -> 200", method: "get", path: () => `/orders/user/${target.user.id}`, as: "admin", status: 200 },
  { label: "GET /order/:id (not mine) as user -> 403", method: "get", path: () => `/order/${targetOrder.id}`, as: "user", status: 403 },
  { label: "GET /order/:id (not mine) as admin -> 200", method: "get", path: () => `/order/${targetOrder.id}`, as: "admin", status: 200 },
  { label: "DELETE /order/:id (not mine) as user -> 403", method: "delete", path: () => `/order/${targetOrder.id}`, as: "user", status: 403 },
  { label: "DELETE /user/:id as user -> 403", method: "delete", path: () => `/user/${target.user.id}`, as: "user", status: 403 },
  { label: "DELETE /user/:id as admin -> 200", method: "delete", path: () => `/user/${target.user.id}`, as: "admin", status: 200 },
];

describe("R-S2 role x endpoint matrix", () => {
  it.each(matrix)("$label", async ({ method, path, as, status }) => {
    const res = await request(app)[method](path()).set(actors[as].auth);
    expect(res.status).toBe(status);
  });
});

describe("R-S2 / F1: admin reads the user they asked for", () => {
  it("GET /user/:id returns that user, not the first user in the DB", async () => {
    const res = await request(app).get(`/user/${target.user.id}`).set(actors.admin.auth);
    expect(res.status).toBe(200);
    expect(res.body.email).toBe(target.user.email); // RED until F1 is fixed
  });

  it("GET /user/:id for an unknown id returns 404", async () => {
    const res = await request(app).get("/user/000000000000000000000000").set(actors.admin.auth);
    expect(res.status).toBe(404); // RED until F1 is fixed
  });
});
