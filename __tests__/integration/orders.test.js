// R-I2: order lifecycle, state-based testing.
// States: "No order" and "Exists". POST: No order -> Exists, PUT: Exists -> Exists,
// DELETE: Exists -> No order, GET observes. Tests run in order and share one order.
const request = require("supertest");
const app = require("../../app");
const db = require("../helpers/db");
const { makeUser } = require("../helpers/fixtures");
const { Order } = require("../../models/order");

let owner;
let orderId;

beforeAll(async () => {
  await db.connect();
  owner = await makeUser({ role: "User" });
});
afterAll(db.close);

describe("R-I2 P1 - valid lifecycle (S1)", () => {
  it("POST /order: No order -> Exists (201, stored in DB)", async () => {
    const res = await request(app).post("/order").set(owner.auth).send({ type: "Box1", description: "lifecycle" });
    expect(res.status).toBe(201);
    orderId = res.body._id;
    const stored = await Order.findById(orderId);
    expect(stored).not.toBeNull();
    expect(stored.type).toBe("Box1");
    expect(stored.user.toString()).toBe(owner.user.id);
  });

  it("GET /order/:id: Exists -> Exists (200, matches DB)", async () => {
    const res = await request(app).get(`/order/${orderId}`).set(owner.auth);
    expect(res.status).toBe(200);
    expect(res.body._id).toBe(orderId);
    expect(res.body.type).toBe("Box1");
  });

  it("PUT /order: Exists -> Exists (200, DB shows Box2)", async () => {
    const res = await request(app).put("/order").set(owner.auth).send({ _id: orderId, type: "Box2" });
    expect((await Order.findById(orderId)).type).toBe("Box2");
    expect(res.status).toBe(200); // RED: server returns 201 for an update (F12)
  });

  it("DELETE /order/:id: Exists -> No order (200, removed from DB)", async () => {
    const res = await request(app).delete(`/order/${orderId}`).set(owner.auth);
    expect(res.status).toBe(200);
    expect(await Order.findById(orderId)).toBeNull();
  });
});

describe("R-I2 P2 - actions after delete (S2, invalid transitions)", () => {
  it("GET a deleted order -> 404", async () => {
    const res = await request(app).get(`/order/${orderId}`).set(owner.auth);
    expect(res.status).toBe(404);
  });

  it("PUT a deleted order -> 404", async () => {
    const res = await request(app).put("/order").set(owner.auth).send({ _id: orderId, type: "Box1" });
    expect(res.status).toBe(404); // RED: null dereference gives 400 (F9)
  });

  it("DELETE a deleted order again -> 404", async () => {
    const res = await request(app).delete(`/order/${orderId}`).set(owner.auth);
    expect(res.status).toBe(404); // RED: null dereference gives 400 (F9)
  });
});
