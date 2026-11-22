const AdDao = require('../model/AdDao');

// Retrieve all advertisements
async function getAllAdvertisements(req, res) {
  try {
    const advertisements = await AdDao.readAll();
    return res.status(200).json(advertisements);
  } catch (error) {
    return res.status(500).json({
      message: 'Error retrieving advertisements.',
    });
  }
}

// Retrieve one advertisement by ID
async function getAdvertisement(req, res) {
  try {
    const advertisement = await AdDao.getAdvertisement(req.params.id);

    if (!advertisement) {
      return res.status(404).json({
        message: 'Advertisement not found.',
      });
    }

    return res.status(200).json(advertisement);
  } catch (error) {
    return res.status(500).json({
      message: 'Error retrieving advertisement.',
    });
  }
}

// Create a new advertisement
async function createAdvertisement(req, res) {
  try {
    const { name, placement, imageUrl, destinationUrl, status } = req.body;

    if (!name || !placement || !imageUrl) {
      return res.status(400).json({
        message: 'Name, placement, and image URL are required.',
      });
    }

    const advertisement = await AdDao.createAdvertisement({
      name,
      placement,
      imageUrl,
      destinationUrl,
      status,
    });

    return res.status(201).json(advertisement);
  } catch (error) {
    return res.status(500).json({
      message: 'Error creating advertisement.',
    });
  }
}

// Update an existing advertisement
async function updateAdvertisement(req, res) {
  try {
    const advertisement = await AdDao.updateAdvertisement(
      req.params.id,
      req.body,
    );

    if (!advertisement) {
      return res.status(404).json({
        message: 'Advertisement not found.',
      });
    }

    return res.status(200).json(advertisement);
  } catch (error) {
    return res.status(500).json({
      message: 'Error updating advertisement.',
    });
  }
}

// Delete an advertisement
async function deleteAdvertisement(req, res) {
  try {
    const advertisement = await AdDao.deleteAdvertisement(req.params.id);

    if (!advertisement) {
      return res.status(404).json({
        message: 'Advertisement not found.',
      });
    }

    return res.status(200).json({
      message: 'Advertisement deleted successfully.',
    });
  } catch (error) {
    return res.status(500).json({
      message: 'Error deleting advertisement.',
    });
  }
}

// Retrieve active advertisements for a specific placement
async function getActiveAdvertisements(req, res) {
  try {
    const advertisements = await AdDao.getActiveByPlacement(
      req.params.placement,
    );

    return res.status(200).json(advertisements);
  } catch (error) {
    return res.status(500).json({
      message: 'Error retrieving active advertisements.',
    });
  }
}

module.exports = {
  getAllAdvertisements,
  getAdvertisement,
  createAdvertisement,
  updateAdvertisement,
  deleteAdvertisement,
  getActiveAdvertisements,
};
