// R-U2 – Authentication Middleware

const jwt = require("jsonwebtoken");
const { authenticateToken } = require("../../endpoints/auth");
const { User } = require("../../models/user");
const SECRET = process.env.API_SECRET; // signs tokens found in in __tests__/helpers/env.js
const USER_ID = "64b000000000000000000001";

// records methods for responses
function fakeResponse() {
  const res = {};
  res.status = jest.fn(() => res);
  res.send = jest.fn(() => res);
  res.sendStatus = jest.fn(() => res);
  return res;
}

// runs middleware
async function runAuth(authorizationHeader) {
  const req = { headers: {} };
  if (authorizationHeader !== undefined) {
    req.headers.authorization = authorizationHeader;
  }
  const res = fakeResponse();
  const next = jest.fn();

  authenticateToken(req, res, next);
  await new Promise((resolve) => setImmediate(resolve));

  return { req, res, next };
}

// blocks console output to keep everything clean
beforeEach(() => {
  jest.spyOn(console, "log").mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe("R-U2 authentication middleware", () => {

  // P1

  test("no authorization header", async () => {
    const { res, next } = await runAuth(undefined);

    expect(res.sendStatus).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  test("bearer but nothing after it", async () => {
    const { res, next } = await runAuth("Bearer");

    expect(res.sendStatus).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  // P2

  test("token signed with wrong secret", async () => {
    const token = jwt.sign({ id: USER_ID }, "not-the-real-secret");

    const { res, next } = await runAuth(`Bearer ${token}`);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  test("expired token", async () => {
    const token = jwt.sign({ id: USER_ID }, SECRET, { expiresIn: -10 });

    const { res, next } = await runAuth(`Bearer ${token}`);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  // P3

  test("valid token but user no longer exists", async () => {
    jest.spyOn(User, "findOne").mockResolvedValue(null); e
    const token = jwt.sign({ id: USER_ID }, SECRET);

    const { res, next } = await runAuth(`Bearer ${token}`);

    expect(User.findOne).toHaveBeenCalledWith({ _id: USER_ID });
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  // P4

  test("valid user", async () => {
    jest.spyOn(User, "findOne").mockResolvedValue({ role: "Admin" });
    const token = jwt.sign({ id: USER_ID }, SECRET);

    const { req, res, next } = await runAuth(`Bearer ${token}`);

    expect(next).toHaveBeenCalledTimes(1);
    expect(req.user.id).toBe(USER_ID);
    expect(req.user.role).toBe("Admin"); 
    expect(res.status).not.toHaveBeenCalled();
    expect(res.sendStatus).not.toHaveBeenCalled();
  });
});
