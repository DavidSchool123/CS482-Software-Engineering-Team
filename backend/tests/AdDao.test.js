const mongoose = require('mongoose');
const Advertisement = require('../model/AdDao');
const Ad = mongoose.model('Ad');

describe('AdvertisementDao operations', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('readAll retrieves all advertisements', async () => {
    const advertisements = [
      { _id: '1', name: 'Homepage Ad' },
      { _id: '2', name: 'Lobby Ad' },
    ];

    jest.spyOn(Ad, 'find').mockResolvedValue(advertisements);

    const result = await Advertisement.readAll();

    expect(Ad.find).toHaveBeenCalledWith();
    expect(result).toEqual(advertisements);
  });

  test('getAdvertisement retrieves an advertisement by ID', async () => {
    const advertisement = { _id: 'ad123', name: 'Lobby Promotion' };

    jest.spyOn(Ad, 'findById').mockResolvedValue(advertisement);

    const result = await Advertisement.getAdvertisement('ad123');

    expect(Ad.findById).toHaveBeenCalledWith('ad123');
    expect(result).toEqual(advertisement);
  });

  test('getAdvertisement returns null when advertisement does not exist', async () => {
    jest.spyOn(Ad, 'findById').mockResolvedValue(null);

    const result = await Advertisement.getAdvertisement('missing');

    expect(result).toBeNull();
  });

  test('getActiveByPlacement retrieves active advertisements for a placement', async () => {
    const advertisements = [
      {
        _id: 'ad123',
        name: 'Lobby Promotion',
        placement: 'Lobby Right Sidebar',
        status: 'active',
      },
    ];

    jest.spyOn(Ad, 'find').mockResolvedValue(advertisements);

    const result = await Advertisement.getActiveByPlacement(
      'Lobby Right Sidebar',
    );

    expect(Ad.find).toHaveBeenCalledWith({
      placement: 'Lobby Right Sidebar',
      status: 'active',
    });
    expect(result).toEqual(advertisements);
  });

  test('getActiveByPlacement returns an empty array when no active ads exist', async () => {
    jest.spyOn(Ad, 'find').mockResolvedValue([]);

    const result = await Advertisement.getActiveByPlacement(
      'Lobby Bottom Banner',
    );

    expect(Ad.find).toHaveBeenCalledWith({
      placement: 'Lobby Bottom Banner',
      status: 'active',
    });
    expect(result).toEqual([]);
  });

  test('createAdvertisement creates and saves a new advertisement', async () => {
    const advertisementData = {
      name: 'Tournament Promotion',
      placement: 'Lobby Banner',
      imageUrl: 'https://example.com/ad.png',
      destinationUrl: 'https://example.com',
      status: 'active',
    };

    const savedAdvertisement = { _id: 'ad123', ...advertisementData };

    jest.spyOn(Ad.prototype, 'save').mockResolvedValue(savedAdvertisement);

    const result = await Advertisement.createAdvertisement(advertisementData);

    expect(Ad.prototype.save).toHaveBeenCalled();
    expect(result).toEqual(savedAdvertisement);
  });

  test('updateAdvertisement updates an existing advertisement', async () => {
    const updatedData = { name: 'Updated Promotion', status: 'inactive' };
    const updatedAdvertisement = { _id: 'ad123', ...updatedData };

    jest.spyOn(Ad, 'findByIdAndUpdate').mockResolvedValue(updatedAdvertisement);

    const result = await Advertisement.updateAdvertisement(
      'ad123',
      updatedData,
    );

    expect(Ad.findByIdAndUpdate).toHaveBeenCalledWith('ad123', updatedData, {
      returnDocument: 'after',
      runValidators: true,
    });
    expect(result).toEqual(updatedAdvertisement);
  });

  test('updateAdvertisement returns null when advertisement does not exist', async () => {
    jest.spyOn(Ad, 'findByIdAndUpdate').mockResolvedValue(null);

    const result = await Advertisement.updateAdvertisement('missing', {
      status: 'inactive',
    });

    expect(result).toBeNull();
  });

  test('deleteAdvertisement removes an existing advertisement', async () => {
    const deletedAdvertisement = { _id: 'ad123', name: 'Old Promotion' };

    jest.spyOn(Ad, 'findByIdAndDelete').mockResolvedValue(deletedAdvertisement);

    const result = await Advertisement.deleteAdvertisement('ad123');

    expect(Ad.findByIdAndDelete).toHaveBeenCalledWith('ad123');
    expect(result).toEqual(deletedAdvertisement);
  });

  test('deleteAdvertisement returns null when advertisement does not exist', async () => {
    jest.spyOn(Ad, 'findByIdAndDelete').mockResolvedValue(null);

    const result = await Advertisement.deleteAdvertisement('missing');

    expect(result).toBeNull();
  });
});
