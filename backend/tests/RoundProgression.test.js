
jest.mock('mongoose', () => ({
  startSession: jest.fn()
}));

jest.mock('../model/GameDao', () => ({
  findById: jest.fn()
}));

const mongoose = require('mongoose');
const GameDao = require('../model/GameDao');
const { progressToNextRound } = require('../service/NextStreetService');

function card(rank, suit = 'Hearts', faceUp = true) {
  return { rank, suit, faceUp };
}

function player(id, cards, hasFolded = false) {
  return {
    PlayerId: id,
    Cards: cards,
    HasFolded: hasFolded,
    HasActed: true,
    RoundContribution: 10,
    TotalContribution: 30
  };
}

function createGame() {
  return {
    _id: 'game-1',
    Street: 3,
    Status: 'In Progress',
    BettingRoundComplete: true,
    AwaitingNextRound: false,
    CurrentTurnPlayerId: null,
    CurrentBet: 10,
    RaiseCount: 1,
    LastRaiseAmount: 10,
    Deck: [
      card('5', 'Clubs'),
      card('Q', 'Spades')
    ],
    Players: [
      player('alice', [
        card('2', 'Hearts', false),
        card('3', 'Hearts', false),
        card('Q', 'Hearts')
      ]),
      player('bob', [
        card('4', 'Clubs', false),
        card('6', 'Clubs', false),
        card('K', 'Clubs')
      ])
    ],
    save: jest.fn().mockResolvedValue(undefined)
  };
}

describe('P49 - Round Progression', () => {
  let session;

  beforeEach(() => {
    jest.clearAllMocks();

    session = {
      withTransaction: jest.fn(async callback => {
        await callback();
      }),
      endSession: jest.fn().mockResolvedValue(undefined)
    };

    mongoose.startSession.mockResolvedValue(session);
  });

  test('should advance from third to fourth street', async () => {
    const game = createGame();
    GameDao.findById.mockResolvedValue(game);

    const result = await progressToNextRound('game-1');

    expect(result.Street).toBe(4);
    expect(result.BettingRoundComplete).toBe(false);
    expect(result.AwaitingNextRound).toBe(false);
    expect(game.save).toHaveBeenCalledWith({ session });
  });

  test('should deal one face-up card to each active player', async () => {
    const game = createGame();
    GameDao.findById.mockResolvedValue(game);

    await progressToNextRound('game-1');

    expect(game.Players[0].Cards).toHaveLength(4);
    expect(game.Players[1].Cards).toHaveLength(4);

    expect(game.Players[0].Cards[3].faceUp).toBe(true);
    expect(game.Players[1].Cards[3].faceUp).toBe(true);

    expect(game.Deck).toHaveLength(0);
  });

  test('should select the strongest exposed hand to act first', async () => {
    const game = createGame();
    GameDao.findById.mockResolvedValue(game);

    await progressToNextRound('game-1');

    // Alice receives Q, forming a visible pair of queens.
    expect(game.CurrentTurnPlayerId).toBe('alice');
  });

  test('should reset betting state for the new round', async () => {
    const game = createGame();
    GameDao.findById.mockResolvedValue(game);

    await progressToNextRound('game-1');

    expect(game.CurrentBet).toBe(0);
    expect(game.RaiseCount).toBe(0);
    expect(game.LastRaiseAmount).toBe(0);

    for (const p of game.Players) {
      expect(p.RoundContribution).toBe(0);
      expect(p.HasActed).toBe(false);
      expect(p.TotalContribution).toBe(30);
    }
  });

  test('should skip folded players when dealing', async () => {
    const game = createGame();

    game.Players.push(
      player('charlie', [
        card('7', 'Diamonds', false),
        card('8', 'Diamonds', false),
        card('A', 'Diamonds')
      ], true)
    );

    GameDao.findById.mockResolvedValue(game);

    await progressToNextRound('game-1');

    expect(game.Players[2].Cards).toHaveLength(3);
    expect(game.Players[0].Cards).toHaveLength(4);
    expect(game.Players[1].Cards).toHaveLength(4);
    expect(game.CurrentTurnPlayerId).not.toBe('charlie');
  });

  test('should reject progression when betting is incomplete', async () => {
    const game = createGame();
    game.BettingRoundComplete = false;

    GameDao.findById.mockResolvedValue(game);

    await expect(
      progressToNextRound('game-1')
    ).rejects.toThrow('Betting round is not complete');

    expect(game.save).not.toHaveBeenCalled();
  });

  test('should reject progression when a new round is pending', async () => {
    const game = createGame();
    game.AwaitingNextRound = true;

    GameDao.findById.mockResolvedValue(game);

    await expect(
      progressToNextRound('game-1')
    ).rejects.toThrow('Next betting round has not started');

    expect(game.save).not.toHaveBeenCalled();
  });

  test('should reject progression after seventh street', async () => {
    const game = createGame();
    game.Street = 7;

    GameDao.findById.mockResolvedValue(game);

    await expect(
      progressToNextRound('game-1')
    ).rejects.toThrow('No more streets to deal');
  });

  test('should reject a missing game', async () => {
    GameDao.findById.mockResolvedValue(null);

    await expect(
      progressToNextRound('missing-game')
    ).rejects.toThrow('Game not found');
  });

  test('should close the database session after progression', async () => {
    const game = createGame();
    GameDao.findById.mockResolvedValue(game);

    await progressToNextRound('game-1');

    expect(session.withTransaction).toHaveBeenCalledTimes(1);
    expect(session.endSession).toHaveBeenCalledTimes(1);
  });
});
