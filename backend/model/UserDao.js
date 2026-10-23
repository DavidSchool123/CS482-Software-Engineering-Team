const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true,
  },
  password: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
  },
  friends: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  ],
});

const userModel = mongoose.model('user', userSchema);

exports.create = async function (userData) {
  const user = new userModel(userData);
  return await user.save();
};

exports.findByEmail = async function (email) {
  return await userModel.findOne({ email: email.toLowerCase().trim() });
};

exports.findByUsername = async function (username) {
  return await userModel.findOne({ username: username.trim() });
};

exports.readAll = async function () {
  return await userModel.find().select('username');
};
