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

const userModel = mongoose.model('user', userSchema);

exports.readAll = async function () {
  return await userModel.find().select('username');
};

module.exports = mongoose.model('User', userSchema);
