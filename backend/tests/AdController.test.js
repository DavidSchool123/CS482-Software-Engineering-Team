const AdDao = require('../model/AdDao');
const AdController = require('../controller/AdController');

jest.mock('../model/AdDao');

describe('AdController operations', () => {
  let req;
  let res;

  beforeEach(() => {
    req = {
      params: {},
      body: {},
    };

    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // Retrieve all advertisements
  test('getAllAdvertisements retrieves all advertisements', async () => {
    const advertisements = [
      { _id: '1', name: 'Homepage Ad' },
      { _id: '2', name: 'Lobby Ad' },
    ];

    AdDao.readAll.mockResolvedValue(advertisements);

    await AdController.getAllAdvertisements(req, res);

    expect(AdDao.readAll).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(advertisements);
  });

  test('getAllAdvertisements returns an error when retrieval fails', async () => {
    AdDao.readAll.mockRejectedValue(new Error('Database error'));

    await AdController.getAllAdvertisements(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      message: 'Error retrieving advertisements.',
    });
  });

  // Retrieve one advertisement
  test('getAdvertisement retrieves an advertisement by ID', async () => {
    const advertisement = {
      _id: 'ad123',
      name: 'Lobby Promotion',
    };

    req.params.id = 'ad123';
    AdDao.getAdvertisement.mockResolvedValue(advertisement);

    await AdController.getAdvertisement(req, res);

    expect(AdDao.getAdvertisement).toHaveBeenCalledWith('ad123');
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(advertisement);
  });

  test('getAdvertisement returns 404 when advertisement does not exist', async () => {
    req.params.id = 'missing';
    AdDao.getAdvertisement.mockResolvedValue(null);

    await AdController.getAdvertisement(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      message: 'Advertisement not found.',
    });
  });

  test('getAdvertisement returns an error when retrieval fails', async () => {
    AdDao.getAdvertisement.mockRejectedValue(new Error('Database error'));

    await AdController.getAdvertisement(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      message: 'Error retrieving advertisement.',
    });
  });

  // Create an advertisement
  test('createAdvertisement creates a new advertisement', async () => {
    const advertisementData = {
      name: 'Tournament Promotion',
      placement: 'Lobby Banner',
      imageUrl: 'https://example.com/ad.png',
      destinationUrl: 'https://example.com',
      status: 'active',
    };

    const advertisement = {
      _id: 'ad123',
      ...advertisementData,
    };

    req.body = advertisementData;
    AdDao.createAdvertisement.mockResolvedValue(advertisement);

    await AdController.createAdvertisement(req, res);

    expect(AdDao.createAdvertisement).toHaveBeenCalledWith(advertisementData);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(advertisement);
  });

  test('createAdvertisement returns 400 when required fields are missing', async () => {
    req.body = {
      name: 'Tournament Promotion',
      placement: 'Lobby Banner',
    };

    await AdController.createAdvertisement(req, res);

    expect(AdDao.createAdvertisement).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      message: 'Name, placement, and image URL are required.',
    });
  });

  test('createAdvertisement returns an error when creation fails', async () => {
    req.body = {
      name: 'Tournament Promotion',
      placement: 'Lobby Banner',
      imageUrl: 'https://example.com/ad.png',
    };

    AdDao.createAdvertisement.mockRejectedValue(new Error('Database error'));

    await AdController.createAdvertisement(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      message: 'Error creating advertisement.',
    });
  });

  // Update an advertisement
  test('updateAdvertisement updates an existing advertisement', async () => {
    const updatedAdvertisement = {
      _id: 'ad123',
      name: 'Updated Promotion',
      status: 'inactive',
    };

    req.params.id = 'ad123';
    req.body = {
      name: 'Updated Promotion',
      status: 'inactive',
    };

    AdDao.updateAdvertisement.mockResolvedValue(updatedAdvertisement);

    await AdController.updateAdvertisement(req, res);

    expect(AdDao.updateAdvertisement).toHaveBeenCalledWith('ad123', req.body);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(updatedAdvertisement);
  });

  test('updateAdvertisement returns 404 when advertisement does not exist', async () => {
    req.params.id = 'missing';
    req.body = { status: 'inactive' };

    AdDao.updateAdvertisement.mockResolvedValue(null);

    await AdController.updateAdvertisement(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      message: 'Advertisement not found.',
    });
  });

  test('updateAdvertisement returns an error when update fails', async () => {
    req.params.id = 'ad123';
    req.body = { status: 'inactive' };

    AdDao.updateAdvertisement.mockRejectedValue(new Error('Database error'));

    await AdController.updateAdvertisement(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      message: 'Error updating advertisement.',
    });
  });

  // Delete an advertisement
  test('deleteAdvertisement deletes an existing advertisement', async () => {
    req.params.id = 'ad123';

    AdDao.deleteAdvertisement.mockResolvedValue({
      _id: 'ad123',
      name: 'Old Promotion',
    });

    await AdController.deleteAdvertisement(req, res);

    expect(AdDao.deleteAdvertisement).toHaveBeenCalledWith('ad123');
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      message: 'Advertisement deleted successfully.',
    });
  });

  test('deleteAdvertisement returns 404 when advertisement does not exist', async () => {
    req.params.id = 'missing';
    AdDao.deleteAdvertisement.mockResolvedValue(null);

    await AdController.deleteAdvertisement(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      message: 'Advertisement not found.',
    });
  });

  test('deleteAdvertisement returns an error when deletion fails', async () => {
    req.params.id = 'ad123';
    AdDao.deleteAdvertisement.mockRejectedValue(new Error('Database error'));

    await AdController.deleteAdvertisement(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      message: 'Error deleting advertisement.',
    });
  });

  // Retrieve active advertisements by placement
  test('getActiveAdvertisements retrieves active advertisements for a placement', async () => {
    const advertisements = [
      {
        _id: 'ad123',
        name: 'Lobby Promotion',
        placement: 'Lobby Right Sidebar',
        status: 'active',
      },
    ];

    req.params.placement = 'Lobby Right Sidebar';
    AdDao.getActiveByPlacement.mockResolvedValue(advertisements);

    await AdController.getActiveAdvertisements(req, res);

    expect(AdDao.getActiveByPlacement).toHaveBeenCalledWith(
      'Lobby Right Sidebar',
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(advertisements);
  });

  test('getActiveAdvertisements returns an empty array when no active advertisements exist', async () => {
    req.params.placement = 'Lobby Bottom Banner';
    AdDao.getActiveByPlacement.mockResolvedValue([]);

    await AdController.getActiveAdvertisements(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith([]);
  });

  test('getActiveAdvertisements returns an error when retrieval fails', async () => {
    req.params.placement = 'Lobby Right Sidebar';
    AdDao.getActiveByPlacement.mockRejectedValue(new Error('Database error'));

    await AdController.getActiveAdvertisements(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      message: 'Error retrieving active advertisements.',
    });
  });
});
