// Starts a throwaway MongoDB per test file so tests never share state.
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");

mongoose.set("strictQuery", true);
let mongod;

async function connect() {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
}

async function clear() {
  for (const c of Object.values(mongoose.connection.collections)) {
    await c.deleteMany({});
  }
}

async function close() {
  await mongoose.disconnect();
  if (mongod) await mongod.stop();
}

module.exports = { connect, clear, close };
