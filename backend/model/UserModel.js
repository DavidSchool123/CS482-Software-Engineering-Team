const userModel = require('./UserModel');

exports.readAll = async function() {
  return await userModel.find().select('username');
}

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
    unique: true,
    minLength: 6,
    maxLength: 30,
  },
  email: {
    type: String,
    required: true,
    unique: true,
  },
  friends: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  ],
});

module.exports = mongoose.model('User', userSchema);
