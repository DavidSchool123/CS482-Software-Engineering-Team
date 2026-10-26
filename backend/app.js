const express = require('express');
const cors = require('cors');
const session = require('express-session');
const mongoStore = require('connect-mongo').default;

const app = express();

// Middleware
app.use(cors({ origin: 'http://localhost:5173', credentials: true }));
app.use(express.json());

app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    store: mongoStore.create({
      mongoUrl: process.env.MONGODB_URI,
      ttl: 60 * 60 * 24 * 7,
    }),
    cookie: {
      maxAge: 1000 * 60 * 60 * 24,
    },
  }),
);

const TableController = require('./controller/TableController');
const UserController = require('./controller/UserController');

// Test endpoint
app.get('/', (req, res) => {
  res.status(200).json({
    message: 'Poker Face API is running!',
  });
});

// Lobby endpoint
app.get('/api/tables', TableController.getAllTables);

// Search users by username
app.get('/api/users/search', UserController.searchUsers);
app.get('/api/users', UserController.getUsers);

// Send a friend request
app.post('/api/friends/request', UserController.sendFriendRequest);

// Get friend requests for a user
app.get('/api/friends/requests/:userId', UserController.getFriendRequests);

// Respond to a friend request
app.post(
  '/api/friends/requests/:userId/:requestId',
  UserController.respondToFriendRequest,
);

// PATCH endpoint for responding to a friend request
app.patch(
  '/api/friends/requests/:userId/:requestId',
  UserController.respondToFriendRequest,
);

// Get friends for a user
app.get('/api/friends/:userId', UserController.getFriends);

// Get sent friend requests for a user
app.get('/api/friends/sent/:userId', UserController.getSentFriendRequests);

app.post('/api/accounts', UserController.userCreateUpdate);
app.post('/api/accounts/login', UserController.login);
app.get('/api/accounts/me', UserController.loggedUser);
app.post('/api/accounts/logout', UserController.logout);

module.exports = app;
