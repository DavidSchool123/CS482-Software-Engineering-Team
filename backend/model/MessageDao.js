const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema(
  {
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    content: {
      type: String,
      required: true,
      trim: true,
      maxlength: 2000,
    },
  },
  { timestamps: true },
);

messageSchema.index({ sender: 1, recipient: 1, createdAt: 1 });
messageSchema.index({ recipient: 1, sender: 1, createdAt: 1 });

const Message = mongoose.model('Message', messageSchema);

async function requireFriends(userId, friendId) {
  if (userId.equals(friendId)) {
    throw new Error('You cannot message yourself');
  }

  const [user, friend] = await Promise.all([
    mongoose.model('User').findById(userId).select('friends'),
    mongoose.model('User').findById(friendId).select('friends'),
  ]);

  if (!user || !friend) {
    throw new Error('User not found');
  }

  if (
    !user.friends.some((id) => id.equals(friendId)) ||
    !friend.friends.some((id) => id.equals(userId))
  ) {
    throw new Error('You can only message a friend');
  }
}

async function listConversation(userId, friendId) {
  await requireFriends(userId, friendId);

  return Message.find({
    $or: [
      { sender: userId, recipient: friendId },
      { sender: friendId, recipient: userId },
    ],
  })
    .sort({ createdAt: 1 })
    .lean();
}

async function createMessage(senderId, recipientId, content) {
  await requireFriends(senderId, recipientId);
  return Message.create({ sender: senderId, recipient: recipientId, content });
}

async function updateMessage(userId, messageId, content) {
  const message = await Message.findOne({ _id: messageId, sender: userId });

  if (!message) {
    throw new Error('Message not found');
  }

  const friendId = message.recipient.equals(userId)
    ? message.sender
    : message.recipient;
  await requireFriends(userId, friendId);
  message.content = content;
  return message.save();
}

async function deleteMessage(userId, messageId) {
  const message = await Message.findOne({
    _id: messageId,
    sender: userId,
  });

  if (!message) {
    throw new Error('Message not found');
  }

  const friendId = message.recipient.equals(userId)
    ? message.sender
    : message.recipient;
  await requireFriends(userId, friendId);
  await message.deleteOne();
}

async function deleteConversation(userId, friendId) {
  await Message.deleteMany({
    $or: [
      { sender: userId, recipient: friendId },
      { sender: friendId, recipient: userId },
    ],
  });
}

Message.listConversation = listConversation;
Message.requireFriends = requireFriends;
Message.createMessage = createMessage;
Message.updateMessage = updateMessage;
Message.deleteMessage = deleteMessage;
Message.deleteConversation = deleteConversation;

module.exports = Message;
