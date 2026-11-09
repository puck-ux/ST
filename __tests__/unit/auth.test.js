// R-U2: authenticateToken middleware, tested in isolation with test doubles.
// req/res/next are fakes; User.findOne is stubbed so no database is needed.
const jwt = require("jsonwebtoken");
const { authenticateToken } = require("../../endpoints/auth");
const { User } = require("../../models/user");

const SECRET = process.env.API_SECRET; // set in __tests__/helpers/env.js
const USER_ID = "64b000000000000000000001";

// A fake Express response: every method records its call and returns res.
function mockRes() {
  const res = {};
  res.status = jest.fn(() => res);
  res.send = jest.fn(() => res);
  res.sendStatus = jest.fn(() => res);
  return res;
}

// auth.js calls next() inside a .then(), so wait for pending callbacks.
const flush = () => new Promise((resolve) => setImmediate(resolve));

async function runMiddleware(headers) {
  const req = { headers };
  const res = mockRes();
  const next = jest.fn();
  authenticateToken(req, res, next);
  await flush();
  return { req, res, next };
}

beforeEach(() => {
  jest.spyOn(console, "log").mockImplementation(() => {}); // auth.js logs JWT errors
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe("R-U2 P1 - no token (A1)", () => {
  it("no Authorization header -> 401, next not called", async () => {
    const { res, next } = await runMiddleware({});
    expect(res.sendStatus).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('"Bearer" with nothing after it -> 401, next not called', async () => {
    const { res, next } = await runMiddleware({ authorization: "Bearer" });
    expect(res.sendStatus).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });
});

describe("R-U2 P2 - invalid token (A2)", () => {
  it("token signed with the wrong secret -> 403, next not called", async () => {
    const token = jwt.sign({ id: USER_ID }, "some-other-secret");
    const { res, next } = await runMiddleware({ authorization: `Bearer ${token}` });
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it("expired token -> 403, next not called", async () => {
    const token = jwt.sign({ id: USER_ID }, SECRET, { expiresIn: -10 });
    const { res, next } = await runMiddleware({ authorization: `Bearer ${token}` });
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });
});

describe("R-U2 P3 - valid token, user deleted (A3)", () => {
  it("findOne returns null -> 403, next not called", async () => {
    const findOne = jest.spyOn(User, "findOne").mockResolvedValue(null);
    const token = jwt.sign({ id: USER_ID }, SECRET);
    const { res, next } = await runMiddleware({ authorization: `Bearer ${token}` });
    expect(findOne).toHaveBeenCalledWith({ _id: USER_ID });
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });
});

describe("R-U2 P4 - valid token, user exists (A4)", () => {
  it("sets req.user with id and current role, calls next once", async () => {
    jest.spyOn(User, "findOne").mockResolvedValue({ role: "Admin" });
    const token = jwt.sign({ id: USER_ID }, SECRET);
    const { req, res, next } = await runMiddleware({ authorization: `Bearer ${token}` });
    expect(next).toHaveBeenCalledTimes(1);
    expect(req.user.id).toBe(USER_ID);
    expect(req.user.role).toBe("Admin"); // role comes from the DB, not the token
    expect(res.status).not.toHaveBeenCalled();
    expect(res.sendStatus).not.toHaveBeenCalled();
  });
});
