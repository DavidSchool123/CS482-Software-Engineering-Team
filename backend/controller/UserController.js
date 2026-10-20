const dao = require('../dao/UserDaoMongoose');

async function getUsers(req, res) {
  try {
    const users = await dao.readAll();
    res.status(200).json(users);
  } catch (error) {
    res.status(500).json({
      message: 'Failed to retrieve users',
    });
  }
}

module.exports = { getUsers };
