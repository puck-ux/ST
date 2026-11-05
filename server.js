require("dotenv").config({ path: process.env.DOTENV_CONFIG_PATH || ".env" });

const mongoose = require("mongoose");
const app = require("./app");

mongoose.set("strictQuery", true);

const start = async () => {
  try {
    await mongoose.connect(process.env.DB_ENDPOINT);
    app.listen(process.env.PORT, () =>
      console.log(`Server started on port ${process.env.PORT}.`)
    );
  } catch (error) {
    await mongoose.connection.close();
    console.error(error);
    process.exit(1);
  }
};

if (require.main === module) {
  start();
}

module.exports = { start };
