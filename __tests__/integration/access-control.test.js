// R-S2 – Admin-Only Access (Decision Table)

const request = require("supertest");
const app = require("../../app");
const db = require("../helpers/db");
const { makeUser, makeOrder } = require("../helpers/fixtures");

let admin;        
let user;         
let otherUser;   
let otherOrder;   

beforeAll(async () => {
  await db.connect();
});

afterAll(async () => {
  await db.close();
});

// clean everything for each test
beforeEach(async () => {
  await db.clear();
  admin = await makeUser({ role: "Admin" });
  user = await makeUser({ role: "User" });
  otherUser = await makeUser({ role: "User" });
  otherOrder = await makeOrder(otherUser.user);
});

describe("R-S2 admin-only access", () => {

  // P1

  test("user trying to list users", async () => {
    const res = await request(app).get("/users").set(user.auth);
    expect(res.status).toBe(403);
  });

  test("user looking up other users", async () => {
    const res = await request(app).get(`/user/${otherUser.user.id}`).set(user.auth);
    expect(res.status).toBe(403);
  });

  test("user listing another user's orders", async () => {
    const res = await request(app).get(`/orders/user/${otherUser.user.id}`).set(user.auth);
    expect(res.status).toBe(403);
  });

  test("user reading another user's orders", async () => {
    const res = await request(app).get(`/order/${otherOrder.id}`).set(user.auth);
    expect(res.status).toBe(403);
  });

  test("user deleting another user's order", async () => {
    const res = await request(app).delete(`/order/${otherOrder.id}`).set(user.auth);
    expect(res.status).toBe(403);
  });

  test("user deleting another user", async () => {
    const res = await request(app).delete(`/user/${otherUser.user.id}`).set(user.auth);
    expect(res.status).toBe(403);
  });

  // P2

  test("admin listing users", async () => {
    const res = await request(app).get("/users").set(admin.auth);
    expect(res.status).toBe(200);
  });

  test("admin listing a user's orders", async () => {
    const res = await request(app).get(`/orders/user/${otherUser.user.id}`).set(admin.auth);
    expect(res.status).toBe(200);
  });

  test("admin reading a user's orders", async () => {
    const res = await request(app).get(`/order/${otherOrder.id}`).set(admin.auth);
    expect(res.status).toBe(200);
  });

  test("admin deleting a user's order", async () => {
    const res = await request(app).delete(`/order/${otherOrder.id}`).set(admin.auth);
    expect(res.status).toBe(200);
  });

  test("admin deleting a non-admin user", async () => {
    const res = await request(app).delete(`/user/${otherUser.user.id}`).set(admin.auth);
    expect(res.status).toBe(200);
  });

  // P3

  test("admin looking up user", async () => {
    const res = await request(app).get(`/user/${otherUser.user.id}`).set(admin.auth);

    expect(res.status).toBe(200);
    expect(res.body.email).toBe(otherUser.user.email);
  });

  test("admin looking up user who doesn't exist", async () => {
    const res = await request(app).get("/user/000000000000000000000000").set(admin.auth);

    expect(res.status).toBe(404); 
  });
});
