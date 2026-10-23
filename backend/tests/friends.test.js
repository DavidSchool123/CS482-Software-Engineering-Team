
const request = require('supertest');
const mongoose = require('mongoose');
const path = require('path');

require('dotenv').config({
  path: path.join(__dirname, '../.env'),
});

const app = require('../app');
const User = require('../model/UserDao');

let david;
let daniah;
let philip;
let testUserIds = [];

// Connect ONLY to the Atlas test database.
beforeAll(async () => {
  const uri = process.env.MONGODB_TEST_URI;

  if (!uri) {
    throw new Error('MONGODB_TEST_URI is missing from .env');
  }

  let databaseName;

  try {
    databaseName = new URL(uri).pathname.slice(1);
  } catch {
    throw new Error('Invalid MONGODB_TEST_URI');
  }

  if (databaseName !== 'test') {
    throw new Error(
      'Tests must use the test database, not pokerface'
    );
  }

  await mongoose.connect(uri, { dbName: 'test' });

  if (mongoose.connection.name !== 'test') {
    await mongoose.disconnect();
    throw new Error('Connected to the wrong database');
  }
});

// Create fresh users before each test.

beforeEach(async () => {
  const unique = new mongoose.Types.ObjectId().toString();

  const users = await User.create([
    {
      username: `david123_${unique}`,
      email: `david_${unique}@example.com`,
      password: 'testpass123',
    },
    {
      username: `daniah456_${unique}`,
      email: `daniah_${unique}@example.com`,
      password: 'testpass456',
    },
    {
      username: `philip789_${unique}`,
      email: `philip_${unique}@example.com`,
      password: 'testpass789',
    },
  ]);

  [david, daniah, philip] = users;
  testUserIds = users.map((user) => user._id);
});

// Delete ONLY users created by the test.
afterEach(async () => {
  if (mongoose.connection.name !== 'test') {
    throw new Error('Unsafe cleanup prevented');
  }

  if (testUserIds.length > 0) {
    await User.deleteMany({
      _id: { $in: testUserIds },
    });
  }

  testUserIds = [];
});

// Close the database connection.
afterAll(async () => {
  await mongoose.disconnect();
});

// Helper function for sending requests.
async function sendRequest(senderId, receiverId) {
  return request(app)
    .post('/api/friends/request')
    .send({
      senderId: senderId.toString(),
      receiverId: receiverId.toString(),
    });
}

// Helper function for responding to requests.
async function respondToRequest(receiverId, requestId, action) {
  return request(app)
    .patch(
      `/api/friends/requests/${receiverId}/${requestId}`
    )
    .send({ action });
}

// Get the ID of a pending request.
async function getRequestId(receiverId) {
  const receiver = await User.findById(receiverId);

  const pendingRequest = receiver.friendRequests.find(
    (friendRequest) => friendRequest.status === 'pending'
  );

  return pendingRequest._id;
}

// -------------------------------------
// FRIEND LOOKUP TESTS
// -------------------------------------

describe('Friend Lookup', () => {
  test('finds a player by username', async () => {
    const response = await request(app)
      .get('/api/users/search')
      .query({ username: david.username });

    expect(response.status).toBe(200);

    expect(
      response.body.some(
        (user) => user.username === david.username
      )
    ).toBe(true);
  });

  test('returns an empty array for a nonexistent username', async () => {
    const response = await request(app)
      .get('/api/users/search')
      .query({
        username: 'nonexistent_player_123456789',
      });

    expect(response.status).toBe(200);
    expect(response.body).toEqual([]);
  });

  test('searches usernames case-insensitively', async () => {
    const response = await request(app)
      .get('/api/users/search')
      .query({
        username: daniah.username.toUpperCase(),
      });

    expect(response.status).toBe(200);

    expect(
      response.body.some(
        (user) => user.username === daniah.username
      )
    ).toBe(true);
  });

  test('supports partial username searches', async () => {
    const response = await request(app)
      .get('/api/users/search')
      .query({
        username: david.username.slice(0, 5),
      });

    expect(response.status).toBe(200);

    expect(
      response.body.some(
        (user) => user._id === david._id.toString()
      )
    ).toBe(true);
  });
});

// -------------------------------------
// FRIEND REQUEST TESTS
// -------------------------------------

describe('Friend Requests', () => {
  test('sends a friend request successfully', async () => {
    const response = await sendRequest(
      david._id,
      daniah._id
    );

    expect(response.status).toBe(201);

    const updatedDaniah = await User.findById(daniah._id);

    expect(updatedDaniah.friendRequests).toHaveLength(1);

    expect(
      updatedDaniah.friendRequests[0].from.toString()
    ).toBe(david._id.toString());

    expect(
      updatedDaniah.friendRequests[0].status
    ).toBe('pending');
  });

  test('prevents sending a request to yourself', async () => {
    const response = await sendRequest(
      david._id,
      david._id
    );

    expect(response.status).toBeGreaterThanOrEqual(400);
    expect(response.status).toBeLessThan(500);

    const updatedDavid = await User.findById(david._id);

    expect(updatedDavid.friendRequests).toHaveLength(0);
  });

  test('prevents duplicate pending requests', async () => {
    await sendRequest(david._id, daniah._id);

    const response = await sendRequest(
      david._id,
      daniah._id
    );

    expect(response.status).toBeGreaterThanOrEqual(400);
    expect(response.status).toBeLessThan(500);

    const updatedDaniah = await User.findById(daniah._id);

    expect(updatedDaniah.friendRequests).toHaveLength(1);
  });

  test('prevents reverse duplicate requests', async () => {
    await sendRequest(david._id, daniah._id);

    const response = await sendRequest(
      daniah._id,
      david._id
    );

    expect(response.status).toBeGreaterThanOrEqual(400);
    expect(response.status).toBeLessThan(500);

    const updatedDavid = await User.findById(david._id);

    expect(updatedDavid.friendRequests).toHaveLength(0);
  });

  test('retrieves incoming friend requests', async () => {
    await sendRequest(david._id, daniah._id);

    const response = await request(app)
      .get(`/api/friends/requests/${daniah._id}`);

    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(1);

    expect(response.body[0].username).toBe(david.username);
    expect(response.body[0].status).toBe('pending');
  });

  test('retrieves outgoing pending requests', async () => {
    await sendRequest(david._id, daniah._id);

    const response = await request(app)
      .get(`/api/friends/sent/${david._id}`);

    expect(response.status).toBe(200);

    expect(
      response.body.some(
        (user) => user._id === daniah._id.toString()
      )
    ).toBe(true);
  });

  test('accepting a request makes both users friends', async () => {
    await sendRequest(david._id, daniah._id);

    const requestId = await getRequestId(daniah._id);

    const response = await respondToRequest(
      daniah._id,
      requestId,
      'accept'
    );

    expect(response.status).toBe(200);

    const updatedDavid = await User.findById(david._id);
    const updatedDaniah = await User.findById(daniah._id);

    expect(
      updatedDavid.friends.map((id) => id.toString())
    ).toContain(daniah._id.toString());

    expect(
      updatedDaniah.friends.map((id) => id.toString())
    ).toContain(david._id.toString());
  });

  test('declining a request does not create a friendship', async () => {
    await sendRequest(david._id, philip._id);

    const requestId = await getRequestId(philip._id);

    const response = await respondToRequest(
      philip._id,
      requestId,
      'decline'
    );

    expect(response.status).toBe(200);

    const updatedDavid = await User.findById(david._id);
    const updatedPhilip = await User.findById(philip._id);

    expect(updatedDavid.friends).toHaveLength(0);
    expect(updatedPhilip.friends).toHaveLength(0);
  });

  test('accepted requests disappear from incoming requests', async () => {
    await sendRequest(david._id, daniah._id);

    const requestId = await getRequestId(daniah._id);

    await respondToRequest(
      daniah._id,
      requestId,
      'accept'
    );

    const response = await request(app)
      .get(`/api/friends/requests/${daniah._id}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual([]);
  });

  test('accepted requests disappear from outgoing pending requests', async () => {
    await sendRequest(david._id, daniah._id);

    const requestId = await getRequestId(daniah._id);

    await respondToRequest(
      daniah._id,
      requestId,
      'accept'
    );

    const response = await request(app)
      .get(`/api/friends/sent/${david._id}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual([]);
  });

  test('declined requests disappear from outgoing pending requests', async () => {
    await sendRequest(david._id, philip._id);

    const requestId = await getRequestId(philip._id);

    await respondToRequest(
      philip._id,
      requestId,
      'decline'
    );

    const response = await request(app)
      .get(`/api/friends/sent/${david._id}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual([]);
  });

  test('prevents sending a request to an existing friend', async () => {
    await sendRequest(david._id, daniah._id);

    const requestId = await getRequestId(daniah._id);

    await respondToRequest(
      daniah._id,
      requestId,
      'accept'
    );

    const response = await sendRequest(
      david._id,
      daniah._id
    );

    expect(response.status).toBeGreaterThanOrEqual(400);
    expect(response.status).toBeLessThan(500);
  });

  test('retrieves accepted friends', async () => {
    await sendRequest(david._id, daniah._id);

    const requestId = await getRequestId(daniah._id);

    await respondToRequest(
      daniah._id,
      requestId,
      'accept'
    );

    const response = await request(app)
      .get(`/api/friends/${david._id}`);

    expect(response.status).toBe(200);

    expect(
      response.body.some(
        (friend) => friend._id === daniah._id.toString()
      )
    ).toBe(true);
  });
});
