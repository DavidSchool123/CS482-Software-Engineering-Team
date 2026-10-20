const userModel = require('../model/UserModel');

exports.readAll = async function() {
  return await userModel.find().select('username');
}