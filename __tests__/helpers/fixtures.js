// Creates users straight in the DB (bypassing /register, which has fault F4)
// and returns a ready-made Authorization header for each.
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { User } = require("../../models/user");
const { Order } = require("../../models/order");

async function makeUser({ role = "User", email, name = "Test", password = "Passw0rd!" } = {}) {
  const user = await new User({
    name,
    email: email || `${role.toLowerCase()}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@test.com`,
    password: bcrypt.hashSync(password, 8),
    address: "1 Test Street",
    role,
  }).save();
  const token = jwt.sign({ id: user.id }, process.env.API_SECRET, { expiresIn: 3600 });
  return { user, password, auth: { Authorization: `Bearer ${token}` } };
}

async function makeOrder(owner, fields = {}) {
  return new Order({ type: "Box1", description: "fixture", user: owner._id, ...fields }).save();
}

module.exports = { makeUser, makeOrder };
