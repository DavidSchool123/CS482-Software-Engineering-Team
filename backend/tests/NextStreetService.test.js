
const mongoose = require('mongoose');
const GameDao = require('../model/GameDao');
const { createDeck, shuffleDeck } = require('../service/DeckService');
const { dealInitialCards } = require('../service/DealingService');

jest.mock('mongoose', () => ({
  startSession: jest.fn()
}));

jest.mock('../model/GameDao', () => ({
  findById: jest.fn(),
  advanceStreet: jest.fn()
}));

const { advanceToNextStreet } =
  require('../service/NextStreetService');

describe('P40 - Next Street Service', () => {
  let session;

  beforeEach(() => {
    jest.clearAllMocks();

    session = {
      withTransaction: jest.fn(async callback => {
        await callback();
      }),
      endSession: jest.fn()
    };

    mongoose.startSession.mockResolvedValue(session);
  });

  function createTestGame() {
    const deck = shuffleDeck(createDeck());

    const hands = dealInitialCards(deck, [
      { id: 'alice' },
      { id: 'bob' },
      { id: 'charlie' }
    ]);

    return {
      _id: 'game-1',
      Status: 'In Progress',
      Street: 3,
      BettingRoundComplete: true,
      AwaitingNextRound: false,
      CurrentTurnPlayerId: null,
      Deck: deck,
      Players: hands.map(hand => ({
        PlayerId: hand.playerId,
        Cards: hand.cards,
        HasFolded: false
      }))
    };
  }

  test('should reject a game that does not exist', async () => {
    GameDao.findById.mockResolvedValue(null);

    await expect(
      advanceToNextStreet('missing-game')
    ).rejects.toThrow('Game not found');

    expect(GameDao.advanceStreet).not.toHaveBeenCalled();
    expect(session.endSession).toHaveBeenCalled();
  });

  test('should reject a game that is not in progress', async () => {
    GameDao.findById.mockResolvedValue({
      Status: 'Completed'
    });

    await expect(
      advanceToNextStreet('game-1')
    ).rejects.toThrow('Game is not in progress');

    expect(GameDao.advanceStreet).not.toHaveBeenCalled();
  });

  test('should reject advancement before betting completes', async () => {
    GameDao.findById.mockResolvedValue({
      Status: 'In Progress',
      BettingRoundComplete: false,
      Street: 3,
      AwaitingNextRound: false
    });

    await expect(
      advanceToNextStreet('game-1')
    ).rejects.toThrow('Betting round is not complete');

    expect(GameDao.advanceStreet).not.toHaveBeenCalled();
  });

  test('should reject advancing beyond seventh street', async () => {
    GameDao.findById.mockResolvedValue({
      Status: 'In Progress',
      BettingRoundComplete: true,
      AwaitingNextRound: false,
      Street: 7
    });

    await expect(
      advanceToNextStreet('game-1')
    ).rejects.toThrow('No more streets to deal');

    expect(GameDao.advanceStreet).not.toHaveBeenCalled();
  });

  test('should reject advancing while the next round is pending', async () => {
    GameDao.findById.mockResolvedValue({
      Status: 'In Progress',
      BettingRoundComplete: true,
      AwaitingNextRound: true,
      Street: 4
    });

    await expect(
      advanceToNextStreet('game-1')
    ).rejects.toThrow('Next betting round has not started');

    expect(GameDao.advanceStreet).not.toHaveBeenCalled();
  });

  test('should successfully deal and save fourth street', async () => {
    const game = createTestGame();

    GameDao.findById.mockResolvedValue(game);

    GameDao.advanceStreet.mockImplementation(
      async (gameId, expectedStreet, players, deck) => ({
        ...game,
        Street: expectedStreet + 1,
        Players: players,
        Deck: deck,
        BettingRoundComplete: true,
        AwaitingNextRound: true,
        CurrentTurnPlayerId: null
      })
    );

    const result = await advanceToNextStreet('game-1');

    expect(result.Street).toBe(4);
    expect(result.Deck).toHaveLength(40);
    expect(result.AwaitingNextRound).toBe(true);

    for (const player of result.Players) {
      expect(player.Cards).toHaveLength(4);
      expect(player.Cards[3].faceUp).toBe(true);
    }

    expect(GameDao.advanceStreet).toHaveBeenCalledTimes(1);
    expect(GameDao.advanceStreet).toHaveBeenCalledWith(
      'game-1',
      3,
      expect.any(Array),
      expect.any(Array),
      session
    );

    expect(session.endSession).toHaveBeenCalled();
  });

  test('should reject advancement if database update fails', async () => {
    const game = createTestGame();

    GameDao.findById.mockResolvedValue(game);
    GameDao.advanceStreet.mockResolvedValue(null);

    await expect(
      advanceToNextStreet('game-1')
    ).rejects.toThrow('Street has already advanced');

    expect(GameDao.advanceStreet).toHaveBeenCalledTimes(1);
    expect(session.endSession).toHaveBeenCalled();
  });

  test('should not deal another street while the next round is pending', async () => {
    const game = createTestGame();

    GameDao.findById.mockResolvedValue(game);

    GameDao.advanceStreet.mockImplementation(
      async (gameId, expectedStreet, players, deck) => ({
        ...game,
        Street: expectedStreet + 1,
        Players: players,
        Deck: deck,
        BettingRoundComplete: true,
        AwaitingNextRound: true,
        CurrentTurnPlayerId: null
      })
    );

    const result = await advanceToNextStreet('game-1');

    GameDao.findById.mockResolvedValue(result);

    await expect(
      advanceToNextStreet('game-1')
    ).rejects.toThrow('Next betting round has not started');

    expect(GameDao.advanceStreet).toHaveBeenCalledTimes(1);
  });
});
