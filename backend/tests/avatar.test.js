
const express = require('express');
const request = require('supertest');

// Mock database operations so these API tests do not need MongoDB.
jest.mock('../model/UserDao', () => ({
  findById: jest.fn(),
  updateAvatar: jest.fn(),
}));

const UserDao = require('../model/UserDao');
const UserController = require('../controller/UserController');

// Create a small Express app exposing only the profile routes under test.
const app = express();
app.use(express.json({ limit: '3mb' }));

// getProfile is a helper function, not an Express route handler.
app.get('/api/users/:userId', async (req, res) => {
  try {
    const profile = await UserController.getProfile(req.params.userId);

    if (!profile) {
      return res.status(404).json({
        message: 'User not found.',
      });
    }

    return res.status(200).json(profile);
  } catch (error) {
    return res.status(500).json({
      message: 'Failed to retrieve profile.',
    });
  }
});

app.put('/api/users/:userId/avatar', UserController.updateAvatar);

// Reusable user ID and small PNG data URL for request fixtures.
const userId = '507f1f77bcf86cd799439011';
const avatar = 'data:image/png;base64,aGVsbG8=';

describe('Profile avatar API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('profile response includes the saved avatar', async () => {
    // Simulate a user retrieved from MongoDB.
    const mockUser = {
      _id: userId,
      username: 'testuser',
      email: 'test@example.com',
      friends: [],
      avatar,
      userType: 'registered',
      chipBalance: 1000,
    };

    const selectMock = jest.fn().mockResolvedValue(mockUser);

    UserDao.findById.mockReturnValue({
      select: selectMock,
    });

    const response = await request(app).get(
      `/api/users/${userId}`
    );

    expect(UserDao.findById).toHaveBeenCalledWith(userId);

    expect(selectMock).toHaveBeenCalledWith(
      '_id username email friends avatar userType chipBalance'
    );

    expect(response.status).toBe(200);
    expect(response.body.avatar).toBe(avatar);
    expect(response.body.friendCount).toBe(0);
  });

  test('saves a valid avatar', async () => {
    // Simulate a successful database update.
    UserDao.updateAvatar.mockResolvedValue({
      _id: userId,
      avatar,
    });

    const response = await request(app)
      .put(`/api/users/${userId}/avatar`)
      .send({ avatar });

    expect(response.status).toBe(200);
    expect(UserDao.updateAvatar).toHaveBeenCalledWith(
      userId,
      avatar
    );
    expect(response.body.avatar).toBe(avatar);
  });

  test('removes an avatar when sent an empty value', async () => {
    // An empty string resets the avatar.
    UserDao.updateAvatar.mockResolvedValue({
      _id: userId,
      avatar: '',
    });

    const response = await request(app)
      .put(`/api/users/${userId}/avatar`)
      .send({ avatar: '' });

    expect(response.status).toBe(200);
    expect(UserDao.updateAvatar).toHaveBeenCalledWith(
      userId,
      ''
    );
    expect(response.body.avatar).toBe('');
  });

  test('rejects unsupported image types without saving', async () => {
    // SVG is not an allowed image format.
    const response = await request(app)
      .put(`/api/users/${userId}/avatar`)
      .send({
        avatar: 'data:image/svg+xml;base64,PHN2Zz4=',
      });

    expect(response.status).toBe(400);
    expect(UserDao.updateAvatar).not.toHaveBeenCalled();
  });

  test('rejects images that exceed the size limit', async () => {
    // Build an image data URL larger than the controller limit.
    const oversizedAvatar = `data:image/png;base64,${'A'.repeat(2_100_001)}`;

    const response = await request(app)
      .put(`/api/users/${userId}/avatar`)
      .send({ avatar: oversizedAvatar });

    expect(response.status).toBe(413);
    expect(UserDao.updateAvatar).not.toHaveBeenCalled();
  });

  test('returns not found when the user does not exist', async () => {
    UserDao.updateAvatar.mockResolvedValue(null);

    const response = await request(app)
      .put(`/api/users/${userId}/avatar`)
      .send({ avatar });

    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      message: 'User not found.',
    });
  });
});
