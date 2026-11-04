const http = require('node:http');
const mongoose = require('mongoose');
const { WebSocketServer, WebSocket } = require('ws');
const MessageDao = require('../model/MessageDao');
const MessageEvents = require('./MessageEvents');

const FRONTEND_ORIGIN =
  process.env.FRONTEND_URL || 'http://localhost:5173';

function conversationKey(userA, userB) {
  return [userA.toString(), userB.toString()].sort().join(':');
}

function createMessageSockets(server, sessionMiddleware) {
  const sockets = new WebSocketServer({ noServer: true });
  const conversations = new Map();

  function rejectUpgrade(socket, statusCode, statusText) {
    socket.write(
      `HTTP/1.1 ${statusCode} ${statusText}\r\nConnection: close\r\n\r\n`,
    );
    socket.destroy();
  }

  function publishToConversation(userA, userB, event) {
    const key = conversationKey(userA, userB);
    const members = conversations.get(key);
    for (const client of members?.keys() || []) {
      if (client.readyState === WebSocket.OPEN) {
        try {
          client.send(JSON.stringify(event));
        } catch (error) {
          console.error('Could not deliver a live message event:', error);
          client.terminate();
        }
      }
    }

    if (event.type === 'conversation-deleted') {
      if (members) {
        for (const client of members.keys()) {
          client.close(4001, 'Friendship ended');
        }
        conversations.delete(key);
      }
    }
  }

  const unsubscribe = MessageEvents.subscribe((event) => {
    if (event.type === 'user-logged-out') {
      for (const [key, members] of conversations) {
        for (const [client, userId] of members) {
          if (userId === event.userId) {
            client.close(4002, 'Session ended');
            members.delete(client);
          }
        }
        if (members.size === 0) {
          conversations.delete(key);
        }
      }
      return;
    }

    publishToConversation(event.userA, event.userB, event);
  });

  server.on('upgrade', (request, socket, head) => {
    let url;
    try {
      url = new URL(request.url, 'http://localhost');
    } catch {
      rejectUpgrade(socket, 400, 'Bad Request');
      return;
    }

    if (url.pathname !== '/ws/messages') {
      rejectUpgrade(socket, 404, 'Not Found');
      return;
    }

    if (request.headers.origin !== FRONTEND_ORIGIN) {
      rejectUpgrade(socket, 403, 'Forbidden');
      return;
    }

    const friendId = url.searchParams.get('friendId');
    if (!mongoose.Types.ObjectId.isValid(friendId)) {
      rejectUpgrade(socket, 400, 'Bad Request');
      return;
    }

    const response = new http.ServerResponse(request);
    sessionMiddleware(request, response, async (sessionError) => {
      if (sessionError || !request.session?.userId) {
        rejectUpgrade(socket, 401, 'Unauthorized');
        return;
      }

      const userId = request.session.userId;
      try {
        await MessageDao.requireFriends(
          new mongoose.Types.ObjectId(userId),
          new mongoose.Types.ObjectId(friendId),
        );
      } catch {
        rejectUpgrade(socket, 403, 'Forbidden');
        return;
      }

      sockets.handleUpgrade(request, socket, head, (client) => {
        const key = conversationKey(userId, friendId);
        const members = conversations.get(key) || new Map();
        members.set(client, userId);
        conversations.set(key, members);

        client.on('close', () => {
          members.delete(client);
          if (members.size === 0) {
            conversations.delete(key);
          }
        });
      });
    });
  });

  return {
    close() {
      unsubscribe();
      for (const client of sockets.clients) {
        client.close(1001, 'Server shutting down');
      }
      sockets.close();
    },
  };
}

module.exports = createMessageSockets;
