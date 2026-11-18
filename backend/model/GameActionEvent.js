const mongoose = require('mongoose');
const GameActionEventSchema = new mongoose.Schema({
  gameId: { type: mongoose.Schema.Types.ObjectId, ref: 'Game', required: true, index: true },
  playerId: { type: String, required: true },
  action: { type: String, enum: ['fold', 'check', 'call', 'bet', 'raise'], required: true },
  amount: { type: Number, default: 0 },
  street: { type: Number, required: true },
  createdAt: { type: Date, default: Date.now }
}, { versionKey: false });
GameActionEventSchema.index({ gameId: 1, _id: -1 });
module.exports = mongoose.models.GameActionEvent || mongoose.model('GameActionEvent', GameActionEventSchema);
