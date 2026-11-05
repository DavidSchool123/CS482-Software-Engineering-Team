
const mongoose = require('mongoose');

const GameDao = require('../model/GameDao');
const TableDao = require('../model/TableDao');

const {
  performBettingAction,
  getBetSize,
  nextPlayer,
  isBettingRoundComplete
} = require('../service/BettingService');

jest.mock('../model/GameDao');
jest.mock('../model/TableDao');

// Mock database sessions, but use the real
// dealing and turn progression logic.
jest.spyOn(mongoose, 'startSession').mockImplementation(
  async () => ({
    withTransaction: async callback => callback(),
    endSession: jest.fn().mockResolvedValue(undefined)
  })
);

describe('Betting Service - P16 and P49', () => {
  const gameId = '507f1f77bcf86cd799439011';
  const tableId = '507f191e810c19729de860ea';

  function createDeck() {
    const suits = ['Hearts', 'Diamonds', 'Clubs', 'Spades'];
    const ranks = [
      '2', '3', '4', '5', '6', '7', '8',
      '9', '10', 'J', 'Q', 'K', 'A'
    ];

    return suits.flatMap(suit =>
      ranks.map(rank => ({ rank, suit }))
    );
  }

  function createPlayer(
    playerId,
    roundContribution,
    totalContribution,
    cards
  ) {
    return {
      PlayerId: playerId,
      Cards: cards,
      RoundContribution: roundContribution,
      TotalContribution: totalContribution,
      HasFolded: false,
      HasActed: false
    };
  }

  function createMockGame(overrides = {}) {
    return {
      _id: gameId,
      TableId: tableId,
      Status: 'In Progress',
      Street: 3,
      CurrentBet: 2,
      CurrentTurnPlayerId: 'user2',
      BettingRoundComplete: false,
      AwaitingNextRound: false,
      RaiseCount: 0,
      LastRaiseAmount: 0,
      Pot: 4,
      Deck: createDeck(),

      Players: [
        createPlayer('user1', 2, 3, [
          { rank: '2', suit: 'Hearts', faceUp: false },
          { rank: '3', suit: 'Hearts', faceUp: false },
          { rank: '4', suit: 'Hearts', faceUp: true }
        ]),
        createPlayer('user2', 0, 1, [
          { rank: '5', suit: 'Clubs', faceUp: false },
          { rank: '6', suit: 'Clubs', faceUp: false },
          { rank: '7', suit: 'Clubs', faceUp: true }
        ])
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

  // ----------------------------------------
  // Turn progression and betting round rules
  // ----------------------------------------

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
    expect(result.Street).toBe(3);
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

  test('automatically advances when everyone has acted and matched', async () => {
    const game = createMockGame();

    game.Players[0].HasActed = true;

    GameDao.findById.mockResolvedValue(game);

    const result = await performBettingAction(
      gameId, 'user2', 'call'
    );

    expect(result.Street).toBe(4);
    expect(result.Status).toBe('In Progress');
    expect(result.BettingRoundComplete).toBe(false);
    expect(result.AwaitingNextRound).toBe(false);
    expect(result.CurrentBet).toBe(0);
    expect(result.CurrentTurnPlayerId).toBe('user1');

    expect(result.Players[0].RoundContribution).toBe(0);
    expect(result.Players[1].RoundContribution).toBe(0);
    expect(result.Players.every(p => !p.HasActed)).toBe(true);

    expect(result.Players[0].Cards).toHaveLength(4);
    expect(result.Players[1].Cards).toHaveLength(4);
    expect(result.Players[0].Cards[3].faceUp).toBe(true);
    expect(result.Players[1].Cards[3].faceUp).toBe(true);

    expect(result.Deck).toHaveLength(50);
    expect(result.Pot).toBe(6);
    expect(game.save).toHaveBeenCalledTimes(1);
  });

  test('folded players are skipped when advancing turns', async () => {
    const game = createMockGame();

    game.Players.push(
      createPlayer('user3', 0, 1, [
        { rank: '8', suit: 'Diamonds', faceUp: false },
        { rank: '9', suit: 'Diamonds', faceUp: false },
        { rank: '10', suit: 'Diamonds', faceUp: true }
      ])
    );

    game.Players[2].HasFolded = true;

    GameDao.findById.mockResolvedValue(game);

    const result = await performBettingAction(
      gameId, 'user2', 'call'
    );

    expect(result.CurrentTurnPlayerId).toBe('user1');
    expect(result.Players[2].HasFolded).toBe(true);
    expect(result.Players[2].Cards).toHaveLength(3);
    expect(result.Street).toBe(3);
  });

  test('completing the bring-in does not count toward raise cap', async () => {
    const game = await performBettingAction(
      gameId, 'user2', 'raise'
    );

    expect(game.CurrentBet).toBe(5);
    expect(game.RaiseCount).toBe(0);
    expect(game.Players[1].RoundContribution).toBe(5);
  });

  // ----------------------------------------
  // Existing betting action tests
  // ----------------------------------------

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
    expect(game.BettingRoundComplete).toBe(true);
    expect(game.save).toHaveBeenCalledTimes(1);
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

  test('rejects a call when player has insufficient chips', async () => {
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

  // ----------------------------------------
  // P49: Additional progression tests
  // ----------------------------------------

  test('does not advance when betting is incomplete', async () => {
    const game = createMockGame();

    GameDao.findById.mockResolvedValue(game);

    await performBettingAction(
      gameId, 'user2', 'call'
    );

    expect(game.Street).toBe(3);
    expect(game.BettingRoundComplete).toBe(false);
    expect(game.CurrentTurnPlayerId).toBe('user1');
    expect(game.Players[0].Cards).toHaveLength(3);
    expect(game.Players[1].Cards).toHaveLength(3);
  });

  test('rejects betting when next round is pending', async () => {
    GameDao.findById.mockResolvedValue(
      createMockGame({
        AwaitingNextRound: true
      })
    );

    await expect(
      performBettingAction(gameId, 'user2', 'call')
    ).rejects.toThrow(
      'Betting round is not accepting actions'
    );
  });

  test('seventh street finishes at showdown', async () => {
    const game = createMockGame({
      Street: 7,
      CurrentBet: 10
    });

    game.Players[0].RoundContribution = 10;
    game.Players[0].HasActed = true;

    GameDao.findById.mockResolvedValue(game);

    const result = await performBettingAction(
      gameId, 'user2', 'call'
    );

    expect(result.Status).toBe('Showdown');
    expect(result.Street).toBe(7);
    expect(result.BettingRoundComplete).toBe(true);
    expect(result.CurrentTurnPlayerId).toBeNull();
    expect(result.Deck).toHaveLength(52);
  });

  test('folding to one player ends game without dealing', async () => {
    const game = createMockGame({
      Street: 5,
      CurrentTurnPlayerId: 'user2'
    });

    GameDao.findById.mockResolvedValue(game);

    const result = await performBettingAction(
      gameId, 'user2', 'fold'
    );

    expect(result.Status).toBe('Completed');
    expect(result.BettingRoundComplete).toBe(true);
    expect(result.CurrentTurnPlayerId).toBeNull();
    expect(result.Deck).toHaveLength(52);
  });

  test('nextPlayer returns to a player who still owes chips', () => {
    const players = [
      {
        PlayerId: 'user1',
        HasFolded: false,
        HasActed: true,
        RoundContribution: 5
      },
      {
        PlayerId: 'user2',
        HasFolded: false,
        HasActed: true,
        RoundContribution: 10
      }
    ];

    expect(
      nextPlayer(players, 'user2', 10)
    ).toBe('user1');
  });

  test('round completes only when active players match', () => {
    const players = [
      {
        PlayerId: 'user1',
        HasFolded: false,
        HasActed: true,
        RoundContribution: 10
      },
      {
        PlayerId: 'user2',
        HasFolded: false,
        HasActed: false,
        RoundContribution: 10
      }
    ];

    expect(
      isBettingRoundComplete(players, 10)
    ).toBe(false);

    players[1].HasActed = true;

    expect(
      isBettingRoundComplete(players, 10)
    ).toBe(true);
  });

  test('folded players do not receive new cards', async () => {
    const game = createMockGame();

    game.Players.push(
      createPlayer('user3', 0, 1, [
        { rank: '8', suit: 'Diamonds', faceUp: false },
        { rank: '9', suit: 'Diamonds', faceUp: false },
        { rank: '10', suit: 'Diamonds', faceUp: true }
      ])
    );

    game.Players[2].HasFolded = true;
    game.Players[0].HasActed = true;

    GameDao.findById.mockResolvedValue(game);

    const result = await performBettingAction(
      gameId, 'user2', 'call'
    );

    expect(result.Street).toBe(4);
    expect(result.Players[0].Cards).toHaveLength(4);
    expect(result.Players[1].Cards).toHaveLength(4);
    expect(result.Players[2].Cards).toHaveLength(3);
    expect(result.Deck).toHaveLength(50);
  });

  test('new betting round selects strongest exposed hand', async () => {
    const game = createMockGame();

    // Both players initially have one exposed card.
    // The deck deals A and K as the next upcards.
    game.Deck = [
      { rank: 'K', suit: 'Spades' },
      { rank: 'A', suit: 'Spades' }
    ];

    game.Players[0].HasActed = true;

    GameDao.findById.mockResolvedValue(game);

    const result = await performBettingAction(
      gameId, 'user2', 'call'
    );

    expect(result.Street).toBe(4);
    expect(result.CurrentTurnPlayerId).toBe('user1');
    expect(result.Players[0].Cards[3].rank).toBe('A');
    expect(result.Players[1].Cards[3].rank).toBe('K');
  });

  test('new betting round resets raise count', async () => {
    const game = createMockGame({
      RaiseCount: 2
    });

    game.Players[0].HasActed = true;

    GameDao.findById.mockResolvedValue(game);

    const result = await performBettingAction(
      gameId, 'user2', 'call'
    );

    expect(result.Street).toBe(4);
    expect(result.RaiseCount).toBe(0);
    expect(result.LastRaiseAmount).toBe(0);
  });

  // ----------------------------------------
  // Full multi-player betting sequence
  // ----------------------------------------

  test('handles a complete three-player betting sequence', async () => {
    const game = createMockGame({
      CurrentBet: 2,
      CurrentTurnPlayerId: 'user2',
      Pot: 5,
      RaiseCount: 0,
      BettingRoundComplete: false
    });

    game.Players[0].RoundContribution = 2;
    game.Players[0].TotalContribution = 3;

    game.Players[1].RoundContribution = 0;
    game.Players[1].TotalContribution = 1;

    game.Players.push(
      createPlayer('user3', 0, 1, [
        { rank: '8', suit: 'Diamonds', faceUp: false },
        { rank: '9', suit: 'Diamonds', faceUp: false },
        { rank: '10', suit: 'Diamonds', faceUp: true }
      ])
    );

    GameDao.findById.mockResolvedValue(game);

    // User2 completes the bring-in.
    await performBettingAction(
      gameId, 'user2', 'raise'
    );

    expect(game.CurrentBet).toBe(5);
    expect(game.Pot).toBe(10);
    expect(game.CurrentTurnPlayerId).toBe('user3');

    // User3 raises to 10.
    await performBettingAction(
      gameId, 'user3', 'raise'
    );

    expect(game.CurrentBet).toBe(10);
    expect(game.Pot).toBe(20);
    expect(game.RaiseCount).toBe(1);
    expect(game.CurrentTurnPlayerId).toBe('user1');

    // User1 calls the remaining 8 chips.
    await performBettingAction(
      gameId, 'user1', 'call'
    );

    expect(game.Players[0].RoundContribution).toBe(10);
    expect(game.Pot).toBe(28);
    expect(game.CurrentTurnPlayerId).toBe('user2');

    // User2 calls the remaining 5 chips.
    const result = await performBettingAction(
      gameId, 'user2', 'call'
    );

    expect(result.Street).toBe(4);
    expect(result.CurrentBet).toBe(0);
    expect(result.BettingRoundComplete).toBe(false);
    expect(result.AwaitingNextRound).toBe(false);

    expect(result.Players[0].RoundContribution).toBe(0);
    expect(result.Players[1].RoundContribution).toBe(0);
    expect(result.Players[2].RoundContribution).toBe(0);

    expect(result.Players[0].TotalContribution).toBe(11);
    expect(result.Players[1].TotalContribution).toBe(11);
    expect(result.Players[2].TotalContribution).toBe(11);

    expect(result.Pot).toBe(33);
    expect(result.Deck).toHaveLength(49);

    expect(result.Players.every(p => p.Cards.length === 4))
      .toBe(true);

    expect(game.save).toHaveBeenCalledTimes(4);
    expect(TableDao.deductPlayerChips)
      .toHaveBeenCalledTimes(4);
  });
});
