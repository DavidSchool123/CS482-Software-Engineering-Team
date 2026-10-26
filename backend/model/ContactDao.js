const mongoose = require('mongoose');

const ContactSchema = new mongoose.Schema(
  {
    Name: {
      type: String,
      required: true,
      trim: true,
    },
    Email: {
      type: String,
      required: true,
      trim: true,
    },
    Subject: {
      type: String,
      required: true,
      trim: true,
    },
    Message: {
      type: String,
      required: true,
      trim: true,
    },
    Status: {
      type: String,
      enum: ['Unread', 'Read'],
      default: 'Unread',
    },
  },
  {
    timestamps: true,
  }
);

const ContactModel = mongoose.model('Contact', ContactSchema);

exports.createContact = async function (contactData) {
  return await ContactModel.create(contactData);
};