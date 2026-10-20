
const User = require("../model/User");

async function getUsers(req, res) {
  try {
    const users = await User.find().select("username");

    res.status(200).json(users);
  } catch (error) {
    res.status(500).json({
      message: "Failed to retrieve users"
    });
  }
}

module.exports = { getUsers };
