const request = require('supertest');
const mongoose = require('mongoose');
const http = require('node:http');
const WebSocket = require('ws');
const path = require('path');

require('dotenv').config({
  path: path.join(__dirname, '../.env'),
});

const app = require('../app');
const User = require('../model/UserDao');
const Message = require('../model/MessageDao');
const passUtil = require('../util/PasswordUtil');
const createMessageSockets = require('../service/MessageSockets');

let sender;
let friend;
let stranger;

beforeAll(async () => {
  const uri = process.env.MONGODB_TEST_URI;
  if (!uri || new URL(uri).pathname.slice(1) !== 'test') {
    throw new Error('Tests must use MONGODB_TEST_URI for the test database');
  }
  await mongoose.connect(uri, { dbName: 'test' });
});

beforeEach(async () => {
  const unique = new mongoose.Types.ObjectId().toString();
  [sender, friend, stranger] = await User.create([
    {
      username: `message_sender_${unique}`,
      email: `message_sender_${unique}@example.com`,
      password: passUtil.hashPassword('testpass123'),
    },
    {
      username: `message_friend_${unique}`,
      email: `message_friend_${unique}@example.com`,
      password: passUtil.hashPassword('testpass123'),
    },
    {
      username: `message_stranger_${unique}`,
      email: `message_stranger_${unique}@example.com`,
      password: passUtil.hashPassword('testpass123'),
    },
  ]);
  sender.friends.push(friend._id);
  friend.friends.push(sender._id);
  await Promise.all([sender.save(), friend.save()]);
});

afterEach(async () => {
  if (mongoose.connection.name !== 'test') {
    throw new Error('Unsafe cleanup prevented');
  }

  await Message.deleteMany({
    $or: [
      { sender: { $in: [sender._id, friend._id, stranger._id] } },
      { recipient: { $in: [sender._id, friend._id, stranger._id] } },
    ],
  });
  await User.deleteMany({
    _id: { $in: [sender._id, friend._id, stranger._id] },
  });
});

afterAll(async () => {
  await mongoose.disconnect();
});

async function loggedInAgent(user) {
  const agent = request.agent(app);
  await agent
    .post('/api/accounts/login')
    .send({ txt_login: user.username, txt_pass: 'testpass123' })
    .expect(200);
  return agent;
}

describe('Private messages', () => {
  test('includes friend profile images in the friends list response', async () => {
    const avatar = 'data:image/png;base64,dGVzdA==';
    await User.findByIdAndUpdate(friend._id, { avatar });

    const response = await request(app)
      .get(`/api/friends/${sender._id}`)
      .expect(200);

    expect(
      response.body.find((item) => item._id === friend._id.toString()).avatar,
    ).toBe(avatar);
  });

  test('supports sending, reading, editing, and deleting messages', async () => {
    const senderAgent = await loggedInAgent(sender);
    const friendAgent = await loggedInAgent(friend);

    const sent = await senderAgent
      .post('/api/messages')
      .send({ recipientId: friend._id.toString(), content: 'Hello!' })
      .expect(201);
    expect(sent.body.content).toBe('Hello!');

    const conversation = await friendAgent
      .get(`/api/messages/${sender._id}`)
      .expect(200);
    expect(conversation.body).toHaveLength(1);
    expect(conversation.body[0]._id).toBe(sent.body._id);

    await friendAgent
      .patch(`/api/messages/${sent.body._id}`)
      .send({ content: 'Changed by recipient' })
      .expect(404);

    const updated = await senderAgent
      .patch(`/api/messages/${sent.body._id}`)
      .send({ content: 'Edited' })
      .expect(200);
    expect(updated.body.content).toBe('Edited');

    await senderAgent.delete(`/api/messages/${sent.body._id}`).expect(200);
    const emptyConversation = await senderAgent
      .get(`/api/messages/${friend._id}`)
      .expect(200);
    expect(emptyConversation.body).toEqual([]);
  });

  test('rejects messages between players who are not friends', async () => {
    const senderAgent = await loggedInAgent(sender);

    await senderAgent
      .post('/api/messages')
      .send({ recipientId: stranger._id.toString(), content: 'Hello' })
      .expect(403);

    await senderAgent.get(`/api/messages/${stranger._id}`).expect(403);
  });

  test('removing a friend deletes the entire conversation', async () => {
    const senderAgent = await loggedInAgent(sender);
    await senderAgent
      .post('/api/messages')
      .send({ recipientId: friend._id.toString(), content: 'Sent by sender' })
      .expect(201);
    await Message.create({
      sender: friend._id,
      recipient: sender._id,
      content: 'Sent by friend',
    });

    await User.removeFriend(sender._id, friend._id);

    expect(
      await Message.countDocuments({
        $or: [
          { sender: sender._id, recipient: friend._id },
          { sender: friend._id, recipient: sender._id },
        ],
      }),
    ).toBe(0);

    await senderAgent
      .post('/api/messages')
      .send({ recipientId: friend._id.toString(), content: 'Again?' })
      .expect(403);
  });

  test('requires an authenticated player', async () => {
    await request(app)
      .get(`/api/messages/${friend._id}`)
      .expect(401);
  });

  test('delivers new messages to connected friends immediately', async () => {
    const senderLogin = await request(app)
      .post('/api/accounts/login')
      .send({ txt_login: sender.username, txt_pass: 'testpass123' })
      .expect(200);
    const friendAgent = await loggedInAgent(friend);

    const server = http.createServer(app);
    const messageSockets = createMessageSockets(
      server,
      app.locals.sessionMiddleware,
    );

    try {
      await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
      const cookie = senderLogin.headers['set-cookie'][0].split(';')[0];
      const socket = new WebSocket(
        `ws://127.0.0.1:${server.address().port}/ws/messages?friendId=${friend._id}`,
        {
          headers: {
            Cookie: cookie,
            Origin: 'http://localhost:5173',
          },
        },
      );

      await new Promise((resolve, reject) => {
        socket.once('open', resolve);
        socket.once('error', reject);
      });

      const receivedMessage = new Promise((resolve, reject) => {
        const timer = setTimeout(
          () => reject(new Error('WebSocket message was not delivered')),
          3000,
        );
        socket.once('message', (data) => {
          clearTimeout(timer);
          resolve(JSON.parse(data.toString()));
        });
      });

      await friendAgent
        .post('/api/messages')
        .send({ recipientId: sender._id.toString(), content: 'Live message' })
        .expect(201);

      const event = await receivedMessage;
      expect(event.type).toBe('message-created');
      expect(event.message.content).toBe('Live message');

      socket.close();
    } finally {
      messageSockets.close();
      await new Promise((resolve) => server.close(resolve));
    }
  });
});
