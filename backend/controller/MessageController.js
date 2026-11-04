const mongoose = require('mongoose');
const MessageDao = require('../model/MessageDao');

function getUserId(req, res) {
  const userId = req.session?.userId;

  if (!userId) {
    res.status(401).json({ message: 'You must be logged in to use messages.' });
    return null;
  }

  return new mongoose.Types.ObjectId(userId);
}

function validateId(id) {
  return mongoose.Types.ObjectId.isValid(id);
}

function handleError(res, error) {
  if (error.name === 'CastError') {
    return res.status(400).json({ message: 'Invalid ID.' });
  }

  if (error.message === 'User not found' || error.message === 'Message not found') {
    return res.status(404).json({ message: error.message });
  }

  if (
    error.message === 'You can only message a friend' ||
    error.message === 'You cannot message yourself'
  ) {
    return res.status(403).json({ message: error.message });
  }

  if (error.name === 'ValidationError') {
    return res.status(400).json({ message: error.message });
  }

  console.error('Message request failed:', error);
  return res.status(500).json({ message: 'Unable to process message request.' });
}

function validateContent(content) {
  return (
    typeof content === 'string' &&
    content.trim().length > 0 &&
    content.trim().length <= 2000
  );
}

async function getConversation(req, res) {
  const userId = getUserId(req, res);
  if (!userId) return;

  const { friendId } = req.params;
  if (!validateId(friendId)) {
    return res.status(400).json({ message: 'Invalid friend ID.' });
  }

  try {
    const messages = await MessageDao.listConversation(
      userId,
      new mongoose.Types.ObjectId(friendId),
    );
    return res.status(200).json(messages);
  } catch (error) {
    return handleError(res, error);
  }
}

async function createMessage(req, res) {
  const userId = getUserId(req, res);
  if (!userId) return;

  const { recipientId, content } = req.body;
  if (!validateId(recipientId) || !validateContent(content)) {
    return res.status(400).json({
      message: 'A valid recipient and message (up to 2000 characters) are required.',
    });
  }

  try {
    const message = await MessageDao.createMessage(
      userId,
      new mongoose.Types.ObjectId(recipientId),
      content.trim(),
    );
    return res.status(201).json(message);
  } catch (error) {
    return handleError(res, error);
  }
}

async function updateMessage(req, res) {
  const userId = getUserId(req, res);
  if (!userId) return;

  const { messageId } = req.params;
  const { content } = req.body;
  if (!validateId(messageId) || !validateContent(content)) {
    return res.status(400).json({
      message: 'A valid message ID and message (up to 2000 characters) are required.',
    });
  }

  try {
    const message = await MessageDao.updateMessage(
      userId,
      new mongoose.Types.ObjectId(messageId),
      content.trim(),
    );
    return res.status(200).json(message);
  } catch (error) {
    return handleError(res, error);
  }
}

async function deleteMessage(req, res) {
  const userId = getUserId(req, res);
  if (!userId) return;

  const { messageId } = req.params;
  if (!validateId(messageId)) {
    return res.status(400).json({ message: 'Invalid message ID.' });
  }

  try {
    await MessageDao.deleteMessage(
      userId,
      new mongoose.Types.ObjectId(messageId),
    );
    return res.status(200).json({ message: 'Message deleted.' });
  } catch (error) {
    return handleError(res, error);
  }
}

module.exports = {
  getConversation,
  createMessage,
  updateMessage,
  deleteMessage,
};
