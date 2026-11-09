// Unit tests for the Mongoose models: R-U1, R-U3, R-U4.
// No database needed: validateSync() runs the schema rules in memory.
// Technique: equivalence partitioning + boundary values (each row = one partition).
const { User } = require("../../models/user");
const { Order } = require("../../models/order");

// A user that satisfies every rule. Each test changes ONE field from this.
const validUser = () => ({
  name: "Test User",
  email: "test@example.com",
  password: "hashed-password",
  address: "1 Test Street",
  role: "User",
});

describe("R-U1 email validation", () => {
  // Valid partitions: should produce NO email error.
  it.each([
    ["simplest valid form", "a@b.c"],
    ["typical address", "jon.smith@ed.ac.uk"],
    ["uppercase (stored lowercased)", "JON@ED.AC.UK"],
    ["surrounding spaces (trimmed)", "  jon@ed.ac.uk  "],
  ])("accepts %s: %p", (_label, email) => {
    const err = new User({ ...validUser(), email }).validateSync();
    expect(err?.errors?.email).toBeUndefined();
  });

  // Invalid partitions: should produce an email error.
  it.each([
    ["no @", "jonexample.com"],
    ["no domain dot", "jon@example"],
    ["nothing before @", "@example.com"],
    ["space inside", "jon smith@example.com"],
    ["two @", "jon@@example.com"],
    ["empty string", ""],
    ["dot only before @", "john.com@example"],
  ])("rejects %s: %p", (_label, email) => {
    const err = new User({ ...validUser(), email }).validateSync();
    expect(err?.errors?.email).toBeDefined();
  });
});

describe("R-U3 user model required fields and role", () => {
  it("accepts a fully valid user", () => {
    expect(new User(validUser()).validateSync()).toBeUndefined();
  });

  it.each(["name", "email", "password", "address"])("rejects a user with no %s", (field) => {
    const data = validUser();
    delete data[field];
    const err = new User(data).validateSync();
    expect(err?.errors?.[field]).toBeDefined();
  });

  it.each(["User", "Admin"])("accepts role %p", (role) => {
    expect(new User({ ...validUser(), role }).validateSync()).toBeUndefined();
  });

  it.each(["admin", "SuperUser", ""])("rejects role %p", (role) => {
    const err = new User({ ...validUser(), role }).validateSync();
    expect(err?.errors?.role).toBeDefined();
  });

  it("defaults role to User when none is given", () => {
    const data = validUser();
    delete data.role;
    expect(new User(data).role).toBe("User");
  });
});

describe("R-U4 order model type", () => {
  it.each(["Box1", "Box2"])("accepts type %p", (type) => {
    expect(new Order({ type }).validateSync()).toBeUndefined();
  });

  it.each(["Box3", "box1", ""])("rejects type %p", (type) => {
    const err = new Order({ type }).validateSync();
    expect(err?.errors?.type).toBeDefined();
  });

  it("defaults type to Box1", () => {
    expect(new Order({}).type).toBe("Box1");
  });
});
