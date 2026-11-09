// R-S3: a non-admin must not be able to become Admin by any route.
// Negative testing: try every route that writes a user, then check the effect
// (can the user now reach an admin-only route?), not just the response code.
const request = require("supertest");
const app = require("../../app");
const db = require("../helpers/db");
const { makeUser } = require("../helpers/fixtures");
const { User } = require("../../models/user");

beforeAll(db.connect);
afterAll(db.close);
beforeEach(db.clear);

describe("R-S3 P1 - role set at registration (X1)", () => {
  it("register with role Admin, log in, GET /users -> 403", async () => {
    const body = { name: "Mallory", email: "mallory@example.com", password: "Passw0rd!", address: "1 Street", role: "Admin" };
    const reg = await request(app).post("/register").send(body);
    expect(reg.status).toBe(201);

    const login = await request(app).post("/login").send({ email: body.email, password: body.password });
    expect(login.status).toBe(200);

    const res = await request(app).get("/users").set("Authorization", `Bearer ${login.body.accessToken}`);
    expect(res.status).toBe(403); // RED: /register copies role from the body (F4)
  });
});

describe("R-S3 P2 - direct role change (X2)", () => {
  it('PUT /me with {"role":"Admin"} -> 403, role still User', async () => {
    const { user, auth } = await makeUser({ role: "User" });
    const res = await request(app).put("/me").set(auth).send({ role: "Admin" });
    expect(res.status).toBe(403);
    expect((await User.findById(user.id)).role).toBe("User");
  });
});

describe("R-S3 P3 - operator bypass (X3)", () => {
  it('PUT /me with {"$set":{"role":"Admin"}} -> role still User, GET /users -> 403', async () => {
    const { user, auth } = await makeUser({ role: "User" });
    await request(app).put("/me").set(auth).send({ $set: { role: "Admin" } });

    const roleAfter = (await User.findById(user.id)).role;
    const res = await request(app).get("/users").set(auth);

    expect(roleAfter).toBe("User"); // RED: the $set operator gets past the role check (F2)
    expect(res.status).toBe(403);
  });
});
