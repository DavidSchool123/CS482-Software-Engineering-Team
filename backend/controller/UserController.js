const dao = require('../model/UserDao');

async function getUsers(req, res) {
  try {
    const users = await dao.readAll();
    res.status(200).json(users);
  } catch (error) {
    res.status(500).json({
      message: 'Failed to retrieve users',
    });
  }
}

async function searchUsers(req, res) {
  try {
    const username = req.query.username?.trim();

    if (!username) {
      return res.status(400).json({
        message: 'Please enter a username',
      });
    }

    const users = await dao.searchByUsername(username);

    res.status(200).json(users);
  } catch (error) {
    res.status(500).json({
      message: 'Failed to search users',
    });
  }
}

// Send a friend request
async function sendFriendRequest(req, res) {
  try {
    const { senderId, receiverId } = req.body;

    if (!senderId || !receiverId) {
      return res.status(400).json({
        message: 'Sender and receiver are required',
      });
    }

    const result = await dao.sendFriendRequest(senderId, receiverId);

    res.status(201).json(result);
  } catch (error) {
    res.status(400).json({
      message: error.message,
    });
  }
}


async function getFriendRequests(req, res) {
  try {
    const { userId } = req.params;

    const requests = await dao.getFriendRequests(userId);

    res.status(200).json(requests);
  } catch (error) {
    res.status(400).json({
      message: error.message,
    });
  }
}


async function respondToFriendRequest(req, res) {
  try {
    const { userId, requestId } = req.params;
    const { action } = req.body;

    if (!['accept', 'decline'].includes(action)) {
      return res.status(400).json({
        message: 'Action must be accept or decline',
      });
    }

    const result = await dao.respondToFriendRequest(
      userId,
      requestId,
      action
    );

    res.status(200).json(result);
  } catch (error) {
    res.status(400).json({
      message: error.message,
    });
  }
}


async function getFriends(req, res) {
  try {
    const { userId } = req.params;

    const friends = await dao.getFriends(userId);

    res.status(200).json(friends);
  } catch (error) {
    res.status(400).json({
      message: error.message,
    });
  }
}


async function getSentFriendRequests(req, res) {
  try {
    const { userId } = req.params;

    const requests = await dao.getSentFriendRequests(userId);

    res.status(200).json(requests);
  } catch (error) {
    res.status(400).json({
      message: error.message,
    });
  }
}


module.exports = { getUsers, 
                  searchUsers, 
                  sendFriendRequest, 
                  getFriendRequests, 
                  respondToFriendRequest,
                  getFriends,
                  getSentFriendRequests };
