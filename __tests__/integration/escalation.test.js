// R-S3 – No Privilege Escalation

const request = require("supertest");
const app = require("../../app");
const db = require("../helpers/db");
const { makeUser } = require("../helpers/fixtures");
const { User } = require("../../models/user");

beforeAll(async () => {
  await db.connect();
});

afterAll(async () => {
  await db.close();
});

beforeEach(async () => {
  await db.clear();
});

describe("R-S3 no privilege escalation", () => {

  // P1

  test("registering with admin role", async () => {
    const newAccount = {
      name: "New User",
      email: "user@example.com",
      password: "password123",
      address: "1 Test Street",
      role: "Admin",
    };

    const register = await request(app).post("/register").send(newAccount);
    expect(register.status).toBe(201);

    const login = await request(app)
      .post("/login")
      .send({ email: newAccount.email, password: newAccount.password });
    expect(login.status).toBe(200);

    const res = await request(app)
      .get("/users")
      .set("Authorization", `Bearer ${login.body.accessToken}`);

    expect(res.status).toBe(403);
  });

  // P2

  test("setting role to admin", async () => {
    const { user, auth } = await makeUser({ role: "User" });

    const res = await request(app).put("/me").set(auth).send({ role: "Admin" });

    expect(res.status).toBe(403);
    const saved = await User.findById(user.id);
    expect(saved.role).toBe("User");
  });

  // P3

  test("using $set to change role to admin", async () => {
    const { user, auth } = await makeUser({ role: "User" });

    await request(app).put("/me").set(auth).send({ $set: { role: "Admin" } });

    const saved = await User.findById(user.id);
    const res = await request(app).get("/users").set(auth);

    expect(saved.role).toBe("User");
    expect(res.status).toBe(403);
  });
});
