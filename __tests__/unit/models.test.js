// R-U1 - Email Validation

const { User } = require("../../models/user");

// User where everything is constant but the email
function emailErrorFor(email) {
  const user = new User({
    name: "Test User",
    email: email,
    password: "password123",
    address: "1 Test Street",
  });
  const errors = user.validateSync();
  if (errors) {
    return errors.errors.email;   
  } else {
    return undefined;             
  }
}

describe("R-U1 email validation", () => {

  // P1

  test("accepts shortest valid address", () => {
    expect(emailErrorFor("a@b.c")).toBeUndefined();
  });

  // P2

  test("accepts normal address", () => {
    expect(emailErrorFor("first.last@example.com")).toBeUndefined();
  });

  test("accepts uppercase address", () => {
    expect(emailErrorFor("USER@EXAMPLE.COM")).toBeUndefined();
  });

  test("accepts address with spaces around it", () => {
    expect(emailErrorFor("  user@example.com  ")).toBeUndefined();
  });

  // P3

  test("rejects address with no @", () => {
    expect(emailErrorFor("userexample.com")).toBeDefined();
  });

  test("rejects address with no dot after the @", () => {
    expect(emailErrorFor("user@example")).toBeDefined();
  });

  test("rejects address with nothing before the @", () => {
    expect(emailErrorFor("@example.com")).toBeDefined();
  });

  test("rejects address with a space in the middle", () => {
    expect(emailErrorFor("first last@example.com")).toBeDefined();
  });

  test("rejects address with two @ signs", () => {
    expect(emailErrorFor("user@@example.com")).toBeDefined();
  });

  test("rejects empty address", () => {
    expect(emailErrorFor("")).toBeDefined();
  });

  test("rejects address where the only dot is before the @", () => {
    expect(emailErrorFor("user.com@example")).toBeDefined();
  });
});
