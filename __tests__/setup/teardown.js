const mongoose = require("mongoose");
mongoose.set('strictQuery', true);

const { User } = require("../../models/user");
const { Order } = require("../../models/order");

require('dotenv').config({ path: '.env' });

module.exports = async () => {

  await mongoose.connect(
    process.env.DB_ENDPOINT
  );

  await User.deleteMany({email: /^test/}).catch(e => {
    console.log(e)
  });
  await Order.deleteMany({description: /\{Test\sOrder/});

  await mongoose.connection.close();
}

