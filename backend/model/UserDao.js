const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true,
  },
  password: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
  },
  friends: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  ],

  friendRequests: [
  {
    from: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    status: {
      type: String,
      enum: ['pending', 'accepted', 'declined'],
      default: 'pending',
    },
  },
],


});

// Create a model for the user schema
const User = mongoose.model('User', userSchema);

// Retrieve all users
async function readAll() {
  return await User.find().select('_id username');
}

exports.create = async function (userData) {
  const user = new User(userData);
  return await user.save();
};

exports.findByEmail = async function (email) {
  return await User.findOne({ email: email.toLowerCase().trim() });
};

exports.findByUsername = async function (username) {
  return await User.findOne({ username: username.trim() });
};

// Search users by username
async function searchByUsername(username) {
  const escapedUsername = username.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  return await User.find({
    username: {
      $regex: escapedUsername,
      $options: 'i',
    },
  })
    .select('_id username')
    .limit(20);
}

// Send a friend request
async function sendFriendRequest(senderId, receiverId) {
  if (senderId === receiverId) {
    throw new Error('You cannot send a friend request to yourself');
  }

  const sender = await User.findById(senderId);
  const receiver = await User.findById(receiverId);

  if (!sender || !receiver) {
    throw new Error('User not found');
  }

  if (sender.friends.some((id) => id.equals(receiver._id))) {
    throw new Error('You are already friends');
  }

  const existingRequest = receiver.friendRequests.some(
    (request) =>
      request.from.equals(sender._id) &&
      request.status === 'pending'
  );

  if (existingRequest) {
    throw new Error('Friend request already sent');
  }

  const reverseRequest = sender.friendRequests.some(
    (request) =>
      request.from.equals(receiver._id) &&
      request.status === 'pending'
  );

  if (reverseRequest) {
    throw new Error('This player has already sent you a friend request');
  }

  receiver.friendRequests.push({
    from: sender._id,
    status: 'pending',
  });

  await receiver.save();

  return { message: 'Friend request sent successfully' };
}


async function getFriendRequests(userId) {
  const user = await User.findById(userId)
    .populate('friendRequests.from', 'username')
    .select('friendRequests');

  if (!user) {
    throw new Error('User not found');
  }

  return user.friendRequests
    .filter((request) => request.status === 'pending')
    .map((request) => ({
      requestId: request._id,
      senderId: request.from?._id,
      username: request.from?.username,
      status: request.status,
    }));
}


async function respondToFriendRequest(userId, requestId, action) {
  if (!['accept', 'decline'].includes(action)) {
    throw new Error('Invalid action');
  }

  const user = await User.findById(userId);

  if (!user) {
    throw new Error('User not found');
  }

  const request = user.friendRequests.id(requestId);

  if (!request || request.status !== 'pending') {
    throw new Error('Pending friend request not found');
  }

  const sender = await User.findById(request.from);

  if (!sender) {
    throw new Error('Sender not found');
  }

  if (action === 'accept') {
    // Add each user to the other's friends list
    if (!user.friends.some((id) => id.equals(sender._id))) {
      user.friends.push(sender._id);
    }

    if (!sender.friends.some((id) => id.equals(user._id))) {
      sender.friends.push(user._id);
    }

    request.status = 'accepted';

    await user.save();
    await sender.save();

    return { message: 'Friend request accepted' };
  }

  request.status = 'declined';
  await user.save();

  return { message: 'Friend request declined' };
}


async function getFriends(userId) {
  const user = await User.findById(userId)
    .populate('friends', '_id username')
    .select('friends');

  if (!user) {
    throw new Error('User not found');
  }

  return user.friends;
}


async function getSentFriendRequests(userId) {
  const user = await User.findById(userId);

  if (!user) {
    throw new Error('User not found');
  }

  const receivers = await User.find({
    friendRequests: {
      $elemMatch: {
        from: user._id,
        status: 'pending',
      },
    },
  }).select('_id username');

  return receivers;
}


// Attach DAO methods while preserving the User model export
User.readAll = readAll;
User.searchByUsername = searchByUsername;
User.sendFriendRequest = sendFriendRequest;
User.getFriendRequests = getFriendRequests;
User.respondToFriendRequest = respondToFriendRequest;
User.getFriends = getFriends;
User.getSentFriendRequests = getSentFriendRequests;

module.exports = User;