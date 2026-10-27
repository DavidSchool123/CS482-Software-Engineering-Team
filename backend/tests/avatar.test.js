const express = require('express');
const request = require('supertest');

// Mock database operations so these API tests do not need MongoDB.
jest.mock('../model/UserDao', () => ({
  getProfile: jest.fn(),
  updateAvatar: jest.fn(),
}));

const UserDao = require('../model/UserDao');
const UserController = require('../controller/UserController');

// Create a small Express app exposing only the profile routes under test.
const app = express();
app.use(express.json({ limit: '2.1mb' }));
app.get('/api/users/:userId', UserController.getProfile);
app.put('/api/users/:userId/avatar', UserController.updateAvatar);

// Reusable user ID and small PNG data URL for request fixtures.
const userId = '507f1f77bcf86cd799439011';
const avatar = 'data:image/png;base64,aGVsbG8=';

describe('Profile avatar API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('profile response includes the saved avatar', async () => {
    // Return a stored avatar from the profile lookup.
    UserDao.getProfile.mockResolvedValue({ _id: userId, avatar });

    const response = await request(app).get(`/api/users/${userId}`);

    // Confirm clients receive the saved image after loading the profile.
    expect(response.status).toBe(200);
    expect(response.body.avatar).toBe(avatar);
  });

  test('saves a valid avatar', async () => {
    // Simulate a successful database update for a valid PNG data URL.
    UserDao.updateAvatar.mockResolvedValue({ _id: userId, avatar });

    const response = await request(app)
      .put(`/api/users/${userId}/avatar`)
      .send({ avatar });

    // Confirm the endpoint accepts the image and updates this user's record.
    expect(response.status).toBe(200);
    expect(UserDao.updateAvatar).toHaveBeenCalledWith(userId, avatar);
  });

  test('removes an avatar when sent an empty value', async () => {
    // An empty string represents resetting the avatar to the default.
    UserDao.updateAvatar.mockResolvedValue({ _id: userId, avatar: '' });

    const response = await request(app)
      .put(`/api/users/${userId}/avatar`)
      .send({ avatar: '' });

    // Confirm the empty avatar is passed to storage.
    expect(response.status).toBe(200);
    expect(UserDao.updateAvatar).toHaveBeenCalledWith(userId, '');
  });

  test('rejects unsupported image types without saving', async () => {
    // SVG is not among the image formats allowed by the avatar endpoint.
    const response = await request(app)
      .put(`/api/users/${userId}/avatar`)
      .send({ avatar: 'data:image/svg+xml;base64,PHN2Zz4=' });

    // Invalid formats must be rejected before reaching the database.
    expect(response.status).toBe(400);
    expect(UserDao.updateAvatar).not.toHaveBeenCalled();
  });

  test('rejects images that exceed the size limit', async () => {
    // Build a data URL larger than the API's configured maximum.
    const oversizedAvatar = `data:image/png;base64,${'A'.repeat(2_100_001)}`;

    const response = await request(app)
      .put(`/api/users/${userId}/avatar`)
      .send({ avatar: oversizedAvatar });

    // Confirm oversized images are rejected without a database write.
    expect(response.status).toBe(413);
    expect(UserDao.updateAvatar).not.toHaveBeenCalled();
  });

  test('returns not found when the user does not exist', async () => {
    // No updated document means the requested user ID was not found.
    UserDao.updateAvatar.mockResolvedValue(null);

    const response = await request(app)
      .put(`/api/users/${userId}/avatar`)
      .send({ avatar });

    // The API should report a missing user instead of claiming success.
    expect(response.status).toBe(404);
  });
});
