const userModel = require('../model/UserDao');

exports.readAll = async function () {
  return await userModel.find().select('username');
};
