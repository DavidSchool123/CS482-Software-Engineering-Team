
const mongoose = require('mongoose');

const GameDao = require('../model/GameDao');
const TableDao = require('../model/TableDao');

const {
  performBettingAction,
  getBetSize
} = require('../service/BettingService');

jest.mock('../model/GameDao');
jest.mock('../model/TableDao');

jest.spyOn(mongoose, 'startSession').mockImplementation(
  async () => ({
    withTransaction: async callback => callback(),
    endSession: jest.fn().mockResolvedValue(undefined)
  })
);

describe('Betting Service - P16', () => {
  const gameId = '507f1f77bcf86cd799439011';
  const tableId = '507f191e810c19729de860ea';

  function createMockGame(overrides = {}) {
    return {
      _id: gameId,
      TableId: tableId,
      Status: 'In Progress',
      Street: 3,
      CurrentBet: 2,
      CurrentTurnPlayerId: 'user2',
      Pot: 4,

      Players: [
        {
          PlayerId: 'user1',
          RoundContribution: 2,
          TotalContribution: 3,
          HasFolded: false,
          HasActed: false
        },
        {
          PlayerId: 'user2',
          RoundContribution: 0,
          TotalContribution: 1,
          HasFolded: false,
          HasActed: false
        }
      ],

      save: jest.fn().mockResolvedValue(undefined),
      ...overrides
    };
  }

  beforeEach(() => {
    jest.clearAllMocks();

    GameDao.findById.mockImplementation(
      async () => createMockGame()
    );

    TableDao.findById.mockResolvedValue({
      _id: tableId,
      Level: 'Low'
    });

    TableDao.deductPlayerChips.mockResolvedValue({
      _id: tableId
    });
  });

  // Turn progression and betting round rules

  test('player must act again after another player raises', async () => {
    const game = createMockGame({
      CurrentBet: 5,
      CurrentTurnPlayerId: 'user2'
    });

    game.Players[0].RoundContribution = 5;
    game.Players[0].HasActed = true;

    GameDao.findById.mockResolvedValue(game);

    const result = await performBettingAction(
      gameId, 'user2', 'raise'
    );

    expect(result.CurrentBet).toBe(10);
    expect(result.Players[0].HasActed).toBe(false);
    expect(result.CurrentTurnPlayerId).toBe('user1');
    expect(result.BettingRoundComplete).toBe(false);
  });

  test('rejects a fourth full raise', async () => {
    GameDao.findById.mockResolvedValue(
      createMockGame({
        CurrentBet: 20,
        RaiseCount: 3
      })
    );

    await expect(
      performBettingAction(gameId, 'user2', 'raise')
    ).rejects.toThrow('Maximum raises reached');
  });

  test('betting round completes when everyone has acted and matched the bet', async () => {
    const game = createMockGame({
      CurrentBet: 2,
      CurrentTurnPlayerId: 'user2'
    });

    game.Players[0].HasActed = true;
    game.Players[0].RoundContribution = 2;

    GameDao.findById.mockResolvedValue(game);

    const result = await performBettingAction(
      gameId, 'user2', 'call'
    );

    expect(result.Players[1].RoundContribution).toBe(2);
    expect(result.CurrentTurnPlayerId).toBeNull();
    expect(result.BettingRoundComplete).toBe(true);
  });

  test('folded players are skipped when advancing turns', async () => {
    const game = createMockGame({
      CurrentBet: 2,
      CurrentTurnPlayerId: 'user2'
    });

    game.Players.push({
      PlayerId: 'user3',
      RoundContribution: 0,
      TotalContribution: 1,
      HasFolded: true,
      HasActed: false
    });

    GameDao.findById.mockResolvedValue(game);

    const result = await performBettingAction(
      gameId, 'user2', 'call'
    );

    expect(result.CurrentTurnPlayerId).toBe('user1');
    expect(result.Players[2].HasFolded).toBe(true);
  });

  test('completing the bring-in does not count as a full raise', async () => {
    GameDao.findById.mockResolvedValue(
      createMockGame({
        CurrentBet: 2,
        RaiseCount: 0
      })
    );

    const result = await performBettingAction(
      gameId, 'user2', 'raise'
    );

    expect(result.CurrentBet).toBe(5);
    expect(result.RaiseCount).toBe(0);
    expect(result.Players[1].RoundContribution).toBe(5);
  });

  // Existing betting action tests

  test('uses small bet on Third Street', () => {
    expect(
      getBetSize({ smallBet: 5, bigBet: 10 }, 3)
    ).toBe(5);
  });

  test('uses big bet on Fifth Street', () => {
    expect(
      getBetSize({ smallBet: 5, bigBet: 10 }, 5)
    ).toBe(10);
  });

  test('fold marks the player as folded', async () => {
    const game = await performBettingAction(
      gameId, 'user2', 'fold'
    );

    expect(game.Players[1].HasFolded).toBe(true);
    expect(game.Status).toBe('Completed');
    expect(game.CurrentTurnPlayerId).toBeNull();
    expect(game.save).toHaveBeenCalled();
  });

  test('check succeeds when nothing is owed', async () => {
    GameDao.findById.mockResolvedValue(
      createMockGame({ CurrentBet: 0 })
    );

    const game = await performBettingAction(
      gameId, 'user2', 'check'
    );

    expect(game.Players[1].HasActed).toBe(true);
    expect(game.Pot).toBe(4);
    expect(TableDao.deductPlayerChips)
      .not.toHaveBeenCalled();
  });

  test('check fails when facing a bet', async () => {
    await expect(
      performBettingAction(gameId, 'user2', 'check')
    ).rejects.toThrow(
      'Cannot check when facing a bet'
    );
  });

  test('call deducts chips and updates contributions', async () => {
    const game = await performBettingAction(
      gameId, 'user2', 'call'
    );

    expect(TableDao.deductPlayerChips)
      .toHaveBeenCalledWith(
        tableId, 'user2', 2, expect.anything()
      );

    expect(game.Players[1].RoundContribution).toBe(2);
    expect(game.Players[1].TotalContribution).toBe(3);
    expect(game.Pot).toBe(6);
  });

  test('call fails when there is nothing to call', async () => {
    GameDao.findById.mockResolvedValue(
      createMockGame({ CurrentBet: 0 })
    );

    await expect(
      performBettingAction(gameId, 'user2', 'call')
    ).rejects.toThrow('Nothing to call');
  });

  test('bet opens betting when CurrentBet is zero', async () => {
    GameDao.findById.mockResolvedValue(
      createMockGame({ CurrentBet: 0 })
    );

    const game = await performBettingAction(
      gameId, 'user2', 'bet'
    );

    expect(game.CurrentBet).toBe(5);
    expect(game.Pot).toBe(9);
    expect(game.Players[1].RoundContribution).toBe(5);
  });

  test('bet fails when betting is already open', async () => {
    await expect(
      performBettingAction(gameId, 'user2', 'bet')
    ).rejects.toThrow(
      'Cannot bet when a bet already exists'
    );
  });

  test('raise completes the Third Street bring-in', async () => {
    const game = await performBettingAction(
      gameId, 'user2', 'raise'
    );

    expect(game.CurrentBet).toBe(5);
    expect(game.Players[1].RoundContribution).toBe(5);
    expect(game.Pot).toBe(9);
  });

  test('raise increases an existing full bet', async () => {
    GameDao.findById.mockResolvedValue(
      createMockGame({ CurrentBet: 5 })
    );

    const game = await performBettingAction(
      gameId, 'user2', 'raise'
    );

    expect(game.CurrentBet).toBe(10);
    expect(game.Players[1].RoundContribution).toBe(10);
    expect(game.Pot).toBe(14);
  });

  test('rejects an invalid action', async () => {
    await expect(
      performBettingAction(gameId, 'user2', 'dance')
    ).rejects.toThrow('Invalid betting action');
  });

  test('rejects an action from the wrong player', async () => {
    await expect(
      performBettingAction(gameId, 'user1', 'call')
    ).rejects.toThrow(
      'It is not this player’s turn'
    );
  });

  test('rejects actions when the game is completed', async () => {
    GameDao.findById.mockResolvedValue(
      createMockGame({ Status: 'Completed' })
    );

    await expect(
      performBettingAction(gameId, 'user2', 'call')
    ).rejects.toThrow('Game is not in progress');
  });

  test('rejects an action from a folded player', async () => {
    const game = createMockGame();
    game.Players[1].HasFolded = true;

    GameDao.findById.mockResolvedValue(game);

    await expect(
      performBettingAction(gameId, 'user2', 'call')
    ).rejects.toThrow('Player cannot act');
  });

  test('rejects a call when the player has insufficient chips', async () => {
    TableDao.deductPlayerChips.mockResolvedValue(null);

    await expect(
      performBettingAction(gameId, 'user2', 'call')
    ).rejects.toThrow('Insufficient chips');
  });

  test('rejects an unknown game', async () => {
    GameDao.findById.mockResolvedValue(null);

    await expect(
      performBettingAction(gameId, 'user2', 'call')
    ).rejects.toThrow('Game not found');
  });

  test('rejects an unknown table', async () => {
    TableDao.findById.mockResolvedValue(null);

    await expect(
      performBettingAction(gameId, 'user2', 'call')
    ).rejects.toThrow('Table not found');
  });

  // Full multi-player betting sequence

  test('handles a complete three-player betting sequence', async () => {
    const game = createMockGame({
      CurrentBet: 2,
      CurrentTurnPlayerId: 'user2',
      Pot: 5,
      RaiseCount: 0,
      BettingRoundComplete: false
    });

    // User1 posted the bring-in.
    game.Players[0].RoundContribution = 2;
    game.Players[0].TotalContribution = 3;

    // User2 and User3 paid only the ante.
    game.Players[1].RoundContribution = 0;
    game.Players[1].TotalContribution = 1;

    game.Players.push({
      PlayerId: 'user3',
      RoundContribution: 0,
      TotalContribution: 1,
      HasFolded: false,
      HasActed: false
    });

    GameDao.findById.mockResolvedValue(game);

    // User2 completes the bring-in.
    await performBettingAction(gameId, 'user2', 'raise');

    expect(game.CurrentBet).toBe(5);
    expect(game.Pot).toBe(10);
    expect(game.CurrentTurnPlayerId).toBe('user3');

    // User3 raises to 10.
    await performBettingAction(gameId, 'user3', 'raise');

    expect(game.CurrentBet).toBe(10);
    expect(game.Pot).toBe(20);
    expect(game.RaiseCount).toBe(1);
    expect(game.CurrentTurnPlayerId).toBe('user1');

    // User1 calls the remaining 8 chips.
    await performBettingAction(gameId, 'user1', 'call');

    expect(game.Players[0].RoundContribution).toBe(10);
    expect(game.Pot).toBe(28);
    expect(game.CurrentTurnPlayerId).toBe('user2');

    // User2 calls the remaining 5 chips.
    await performBettingAction(gameId, 'user2', 'call');

    expect(game.Players[1].RoundContribution).toBe(10);
    expect(game.Pot).toBe(33);
    expect(game.Players[2].RoundContribution).toBe(10);

    expect(game.CurrentTurnPlayerId).toBeNull();
    expect(game.BettingRoundComplete).toBe(true);

    expect(game.save).toHaveBeenCalledTimes(4);
    expect(TableDao.deductPlayerChips).toHaveBeenCalledTimes(4);
  });
});
