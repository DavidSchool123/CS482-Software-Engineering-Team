
const http = require('node:http');
const { WebSocket } = require('ws');

jest.mock('../model/MessageDao', () => ({
  requireFriends: jest.fn(),
}));

const MessageDao = require('../model/MessageDao');
const MessageEvents = require('../service/MessageEvents');
const createMessageSockets = require('../service/MessageSockets');

const USER_A = '507f1f77bcf86cd799439011';
const USER_B = '507f191e810c19729de860ea';
const ORIGIN = process.env.FRONTEND_URL || 'http://localhost:5173';

describe('MessageSockets', () => {
  let server;
  let messageSockets;
  let baseUrl;
  let clients;

  beforeEach(async () => {
    jest.clearAllMocks();
    clients = [];

    MessageDao.requireFriends.mockResolvedValue(true);

    server = http.createServer();

    const sessionMiddleware = (req, res, next) => {
      const userId = req.headers['x-test-user-id'];

      if (userId) {
        req.session = { userId };
      }

      next();
    };

    messageSockets = createMessageSockets(
      server,
      sessionMiddleware
    );

    await new Promise((resolve) => {
      server.listen(0, '127.0.0.1', resolve);
    });

    const { port } = server.address();
    baseUrl = `ws://127.0.0.1:${port}`;
  });

  afterEach(async () => {
    for (const client of clients) {
      if (client.readyState !== WebSocket.CLOSED) {
        client.terminate();
      }
    }

    messageSockets.close();

    await new Promise((resolve) => {
      server.close(resolve);
    });
  });

  function connect({
    userId = USER_A,
    friendId = USER_B,
    origin = ORIGIN,
    path = '/ws/messages',
  } = {}) {
    const client = new WebSocket(
      `${baseUrl}${path}?friendId=${friendId}`,
      {
        headers: {
          Origin: origin,
          ...(userId ? { 'x-test-user-id': userId } : {}),
        },
      }
    );

    clients.push(client);
    return client;
  }

  function waitForOpen(client) {
    return new Promise((resolve, reject) => {
      client.once('open', resolve);
      client.once('error', reject);
    });
  }

  function waitForRejection(client) {
    return new Promise((resolve, reject) => {
      client.once('unexpected-response', (req, res) => {
        const status = res.statusCode;
        res.resume();
        resolve(status);
      });

      client.once('open', () => {
        reject(new Error('Connection was unexpectedly accepted'));
      });

      client.once('error', reject);
    });
  }

  function waitForMessage(client) {
    return new Promise((resolve, reject) => {
      client.once('message', (data) => {
        resolve(JSON.parse(data.toString()));
      });

      client.once('error', reject);
    });
  }

  function waitForClose(client) {
    return new Promise((resolve) => {
      client.once('close', (code, reason) => {
        resolve({
          code,
          reason: reason.toString(),
        });
      });
    });
  }

  test('rejects connections to the wrong path', async () => {
    const client = connect({ path: '/ws/invalid' });

    await expect(waitForRejection(client)).resolves.toBe(404);

    expect(MessageDao.requireFriends).not.toHaveBeenCalled();
  });

  test('rejects connections from an unauthorized origin', async () => {
    const client = connect({
      origin: 'http://unauthorized.example',
    });

    await expect(waitForRejection(client)).resolves.toBe(403);

    expect(MessageDao.requireFriends).not.toHaveBeenCalled();
  });

  test('rejects invalid friend IDs', async () => {
    const client = connect({ friendId: 'invalid-id' });

    await expect(waitForRejection(client)).resolves.toBe(400);

    expect(MessageDao.requireFriends).not.toHaveBeenCalled();
  });

  test('rejects unauthenticated connections', async () => {
    const client = connect({ userId: null });

    await expect(waitForRejection(client)).resolves.toBe(401);

    expect(MessageDao.requireFriends).not.toHaveBeenCalled();
  });

  test('rejects connections when users are not friends', async () => {
    MessageDao.requireFriends.mockRejectedValue(
      new Error('Users are not friends')
    );

    const client = connect();

    await expect(waitForRejection(client)).resolves.toBe(403);

    expect(MessageDao.requireFriends).toHaveBeenCalledTimes(1);
  });

  test('allows authenticated friends to connect', async () => {
    const client = connect();

    await waitForOpen(client);

    expect(client.readyState).toBe(WebSocket.OPEN);

    expect(MessageDao.requireFriends).toHaveBeenCalledWith(
      expect.objectContaining({
        toString: expect.any(Function),
      }),
      expect.objectContaining({
        toString: expect.any(Function),
      })
    );

    const [userId, friendId] =
      MessageDao.requireFriends.mock.calls[0];

    expect(userId.toString()).toBe(USER_A);
    expect(friendId.toString()).toBe(USER_B);
  });

  test('delivers messages to connected conversation members', async () => {
    const client = connect();

    await waitForOpen(client);

    const received = waitForMessage(client);

    const event = {
      type: 'message-created',
      userA: USER_A,
      userB: USER_B,
      message: {
        text: 'Hello!',
      },
    };

    MessageEvents.publish(event);

    await expect(received).resolves.toEqual(event);
  });

  test('closes the conversation when friendship ends', async () => {
    const client = connect();

    await waitForOpen(client);

    const received = waitForMessage(client);
    const closed = waitForClose(client);

    const event = {
      type: 'conversation-deleted',
      userA: USER_A,
      userB: USER_B,
    };

    MessageEvents.publish(event);

    await expect(received).resolves.toEqual(event);

    await expect(closed).resolves.toEqual({
      code: 4001,
      reason: 'Friendship ended',
    });
  });

  test('closes a user connection when they log out', async () => {
    const client = connect();

    await waitForOpen(client);

    const closed = waitForClose(client);

    MessageEvents.publish({
      type: 'user-logged-out',
      userId: USER_A,
    });

    await expect(closed).resolves.toEqual({
      code: 4002,
      reason: 'Session ended',
    });
  });

  test('closes active connections during server shutdown', async () => {
    const client = connect();

    await waitForOpen(client);

    const closed = waitForClose(client);

    messageSockets.close();

    await expect(closed).resolves.toEqual({
      code: 1001,
      reason: 'Server shutting down',
    });
  });
});
