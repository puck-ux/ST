

const request = require("supertest");
const app = require("../../app");
const db = require("../helpers/db");
const { makeUser } = require("../helpers/fixtures");
const { Order } = require("../../models/order");

let owner;    // user who owns order
let orderId;  

beforeAll(async () => {
  await db.connect();
  owner = await makeUser({ role: "User" });
});

afterAll(async () => {
  await db.close();
});

describe("R-I2 order lifecycle", () => {

  // P1

  test("creating an order", async () => {
    const res = await request(app)
      .post("/order")
      .set(owner.auth)
      .send({ type: "Box1", description: "lifecycle test" });

    expect(res.status).toBe(201);

    orderId = res.body._id;
    const saved = await Order.findById(orderId);
    expect(saved).not.toBeNull();
    expect(saved.type).toBe("Box1");
    expect(saved.user.toString()).toBe(owner.user.id);
  });

  test("reading the order", async () => {
    const res = await request(app).get(`/order/${orderId}`).set(owner.auth);

    expect(res.status).toBe(200);
    expect(res.body._id).toBe(orderId);
    expect(res.body.type).toBe("Box1");
  });

  test("updating the order", async () => {
    const res = await request(app)
      .put("/order")
      .set(owner.auth)
      .send({ _id: orderId, type: "Box2" });

    const saved = await Order.findById(orderId);
    expect(saved.type).toBe("Box2");
    expect(res.status).toBe(200); 
  });

  test("deleting the order", async () => {
    const res = await request(app).delete(`/order/${orderId}`).set(owner.auth);

    expect(res.status).toBe(200);
    expect(await Order.findById(orderId)).toBeNull();
  });

  // P2

  test("reading a deleted order", async () => {
    const res = await request(app).get(`/order/${orderId}`).set(owner.auth);

    expect(res.status).toBe(404);
  });

  test("updating a deleted order", async () => {
    const res = await request(app)
      .put("/order")
      .set(owner.auth)
      .send({ _id: orderId, type: "Box1" });

    expect(res.status).toBe(404); 
  });

  test("deleting an order twice", async () => {
    const res = await request(app).delete(`/order/${orderId}`).set(owner.auth);

    expect(res.status).toBe(404); 
  });
});
