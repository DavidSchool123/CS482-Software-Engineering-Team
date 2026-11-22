const mongoose = require('mongoose');

const adSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  placement: {
    type: String,
    required: true,
  },
  imageUrl: {
    type: String,
    required: true,
  },
  destinationUrl: {
    type: String,
    default: '',
  },
  status: {
    type: String,
    enum: ['active', 'inactive'],
    default: 'active',
  },
});

// Create a model for the user schema
const Ad = mongoose.model('Ad', adSchema);

// Retrieve all advertisements
async function readAll() {
  return await Ad.find();
}

// Retrieve an advertisement by its ID
async function getAdvertisement(advertisementId) {
  return await Ad.findById(advertisementId);
}

// Retrieve all active advertisements for a specific placement
async function getActiveByPlacement(placement) {
  return await Ad.find({
    placement,
    status: 'active',
  });
}

// Create a new advertisement
async function createAdvertisement(advertisementData) {
  const advertisement = new Ad(advertisementData);
  return await advertisement.save();
}

// Update an existing advertisement
async function updateAdvertisement(advertisementId, updatedAdvertisement) {
  const advertisement = await Ad.findByIdAndUpdate(
    advertisementId,
    updatedAdvertisement,
    {
      returnDocument: 'after',
      runValidators: true,
    },
  );

  return advertisement;
}

// Delete an advertisement
async function deleteAdvertisement(advertisementId) {
  const advertisement = await Ad.findByIdAndDelete(advertisementId);
  return advertisement;
}

module.exports = {
  readAll,
  getAdvertisement,
  getActiveByPlacement,
  createAdvertisement,
  updateAdvertisement,
  deleteAdvertisement,
};
