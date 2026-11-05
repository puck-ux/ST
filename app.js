const express = require("express");

const app = express();
app.use(express.json());

require("./endpoints/users")(app);
require("./endpoints/orders")(app);

app.get("/", async (req, res) => {
  try {
    return res.status(200).json({ message: "OK" });
  } catch (err) {
    console.log(err);
    return res.status(400).json({ message: "Bad Request." });
  }
});

module.exports = app;
