
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import PlayingCard from '../components/PlayingCard';
import './PokerTable.css';
import './PokerChips.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const otherSeatPositions = [
  'top',
  'left',
  'left-lower',
  'right',
  'right-upper',
];

const TABLE_BETS = {
  Low: 5,
  Medium: 10,
  High: 25,
};

function EmptySeat({ position }) {
  return (
    <div className={`stud-seat stud-seat-empty seat-${position}`}>
      <div className="stud-seat-avatar" aria-hidden="true">＋</div>
      <div className="stud-seat-details">
        <strong>Open seat</strong>
        <span>Waiting for player</span>
      </div>
    </div>
  );
}

// Decorative pot chips. Actual balances come from the API.
function ChipStack({ amount = 0, small = false }) {
  const count = amount > 0 ? 5 : 0;

  return (
    <div
      style={{
        position: 'relative',
        display: 'inline-block',
        width: small ? 26 : 46,
        height: small ? 32 : 55,
        flexShrink: 0,
      }}
    >
      {Array.from({ length: count }, (_, index) => (
        <span
          key={index}
          style={{
            position: 'absolute',
            display: 'block',
            left: 2,
            bottom: 2 + index * (small ? 4 : 7),
            width: small ? 22 : 40,
            height: small ? 11 : 17,
            borderRadius: '50%',
            background:
              'radial-gradient(ellipse at 45% 35%, #cfa6ff 0%, #8b36e9 45%, #43206d 100%)',
            border: '2px solid #ead9ff',
            boxShadow:
              '0 3px 0 #3b1c5d, 0 5px 2px rgba(0, 0, 0, 0.45)',
            boxSizing: 'border-box',
          }}
        />
      ))}
    </div>
  );
}

// Compact seat shared by the current player and opponents.
function PokerSeat({
  name,
  position,
  cards = [],
  chips,
  isBringIn = false,
  isTurn = false,
  hasFolded = false,
  contribution = 0,
  isYou = false,
}) {
  return (
    <div
      className={`stud-seat stud-seat-compact seat-${position} ${
        isYou ? 'stud-seat-you' : ''
      }`}
    >
      <div className="stud-seat-header">
        <div className="stud-seat-avatar" aria-hidden="true">
          ♙
        </div>

        <div className="stud-seat-info">
          <strong className="stud-seat-name">{name}</strong>

          <div className="stud-seat-meta">
            {chips != null && (
              <span className="stud-seat-balance">
                🪙 {chips}
              </span>
            )}

            {contribution > 0 && (
              <span className="stud-seat-bet">
                Bet: {contribution}
              </span>
            )}
          </div>
        </div>
      </div>

      {(isBringIn || isTurn || hasFolded) && (
        <div className="stud-seat-status">
          {hasFolded ? (
            <span className="stud-bring-in-label">
              Folded
            </span>
          ) : (
            <>
              {isBringIn && (
                <span className="stud-bring-in-label">
                  Bring-in
                </span>
              )}

              {isTurn && (
                <span className="stud-bring-in-label">
                  {isYou ? 'Your turn' : 'Current turn'}
                </span>
              )}
            </>
          )}
        </div>
      )}

      {cards.length > 0 && (
        <div 
          className="stud-hole-cards"
          style={{ '--card-count': cards.length }}
          >
          {cards.map((card, index) => (
            <PlayingCard
              key={index}
              card={card}
              hidden={!isYou && !card.faceUp}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function Table() {
  const { tableId: joinCode } = useParams();

  const [chatMessage, setChatMessage] = useState('');
  const [chatMessages, setChatMessages] = useState([]);

  const [table, setTable] = useState(null);
  const [game, setGame] = useState(null);

  const [startingGame, setStartingGame] = useState(false);
  const [submittingAction, setSubmittingAction] = useState(false);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [gameNotice, setGameNotice] = useState(
    'Waiting for players to start the game.'
  );

  useEffect(() => {
    let cancelled = false;

    async function fetchTable() {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch(
          `${API_URL}/api/tables/${encodeURIComponent(joinCode)}`,
          {
            credentials: 'include',
            cache: 'no-store',
          }
        );

        const data = await response.json();

        if (!response.ok) {
          throw new Error(
            data.error ||
              (response.status === 404
                ? 'Table not found. Check the join code.'
                : 'Unable to load table information.')
          );
        }

        if (cancelled) return;

        setTable(data);

        // Load an existing game if one is already running.
        if (data.currentGameId) {
          const gameResponse = await fetch(
            `${API_URL}/api/games/${data.currentGameId}`,
            {
              credentials: 'include',
              cache: 'no-store',
            }
          );

          const gameData = await gameResponse.json();

          if (!gameResponse.ok) {
            throw new Error(
              gameData.error ||
                gameData.message ||
                'Unable to load existing game.'
            );
          }

          if (!cancelled) {
            setGame(gameData);
            setGameNotice('Game in progress. Cards loaded.');
          }
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    fetchTable();

    return () => {
      cancelled = true;
    };
  }, [joinCode]);

  function showNotImplemented(feature) {
    setGameNotice(`${feature} is not available yet.`);
  }

  function sendChat(event) {
    event.preventDefault();

    const message = chatMessage.trim();
    if (!message) return;

    setChatMessages((current) => [
      ...current,
      { name: 'You', message },
    ]);

    setChatMessage('');

    setGameNotice(
      'Chat is a local preview only; messages are not sent to other players.'
    );
  }

  // Retrieve the latest game state after betting actions.
  async function refreshGame(gameId) {
    const response = await fetch(
      `${API_URL}/api/games/${gameId}`,
      {
        credentials: 'include',
        cache: 'no-store',
      }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        data.error || data.message || 'Unable to refresh game.'
      );
    }

    setGame(data);

    return data;
  }

  async function handleStartGame() {
    if (
      !table?.id ||
      startingGame ||
      game ||
      table.currentGameId
    ) {
      return;
    }

    setStartingGame(true);

    try {
      const response = await fetch(
        `${API_URL}/api/tables/${table.id}/start`,
        {
          method: 'POST',
          credentials: 'include',
        }
      );

      const data = await response.json();

      if (!response.ok) {
        setGameNotice(
          data.error || data.message || 'Unable to start the game.'
        );
        return;
      }

      // Prevent starting the same game twice.
      setTable((previous) => ({
        ...previous,
        currentGameId: data.gameId,
        status: 'In Progress',
      }));

      await refreshGame(data.gameId);

      setGameNotice('Initial cards have been dealt.');
    } catch (err) {
      console.error('Error starting game:', err);

      setGameNotice(
        err.message || 'Unable to start the game.'
      );
    } finally {
      setStartingGame(false);
    }
  }

  // P16: Perform fold, check, call, bet, or raise.
  async function handleBettingAction(action) {
    if (!game?.gameId || submittingAction) return;

    setSubmittingAction(true);

    try {
      const response = await fetch(
        `${API_URL}/api/games/${game.gameId}/action`,
        {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            action: action.toLowerCase(),
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || 'Unable to perform betting action.'
        );
      }

      await refreshGame(game.gameId);

      setGameNotice(`${action} completed successfully.`);
    } catch (err) {
      console.error('Betting action failed:', err);

      setGameNotice(
        err.message || 'Unable to perform betting action.'
      );
    } finally {
      setSubmittingAction(false);
    }
  }

  const players = game?.players || [];

  const me = players.find(
    (player) => player.isCurrentPlayer
  );

  const opponents = players.filter(
    (player) => !player.isCurrentPlayer
  );

  const getPlayerChips = (playerId) => {
    return game?.playerStacks?.find(
      (stack) => String(stack.playerId) === String(playerId)
    )?.chips;
  };

  const isMyTurn =
    Boolean(game && me) &&
    String(game.currentTurnPlayerId) === String(me.playerId);

  const amountToCall = Math.max(
    0,
    (game?.currentBet ?? 0) -
      (me?.roundContribution ?? 0)
  );

  const canAct =
    game?.status === 'In Progress' &&
    !game?.bettingRoundComplete &&
    !me?.hasFolded &&
    isMyTurn &&
    !submittingAction;

  const smallBet = TABLE_BETS[table?.level] ?? 5;

  const isBringInCompletion =
    game?.street === 3 &&
    (game?.currentBet ?? 0) > 0 &&
    (game?.currentBet ?? 0) < smallBet;

  const raiseLimitReached =
    (game?.raiseCount ?? 0) >= 3 &&
    !isBringInCompletion;

  const myChips = getPlayerChips(me?.playerId);

  const requiredRaise =
    isBringInCompletion
      ? smallBet - (me?.roundContribution ?? 0)
      : amountToCall +
        (game?.street <= 4
          ? smallBet
          : smallBet * 2);

  const canAfford = (amount) =>
    myChips != null && myChips >= amount;

  // Tooltip amounts for fixed-limit betting.
  const betAmount =
    game?.street <= 4 ? smallBet : smallBet * 2;

  const raiseToAmount = isBringInCompletion
    ? smallBet
    : (game?.currentBet ?? 0) + betAmount;

  function getActionTooltip(action) {
    switch (action) {
      case 'Fold':
        return 'Give up this hand. You cannot win the pot.';

      case 'Check':
        return 'Stay in the hand without betting any additional chips.';

      case 'Call':
        return `Match the current bet by adding ${amountToCall} chips.`;

      case 'Bet':
        return `Place a bet of ${betAmount} chips.`;

      case 'Raise':
        return `Increase the current bet to ${raiseToAmount} chips.`;

      default:
        return '';
    }
  }

  if (loading) {
    return (
      <main className="stud-page">
        <p role="status">Loading table...</p>
      </main>
    );
  }

  if (error || !table) {
    return (
      <main className="stud-page">
        <p role="alert">
          {error || 'Table not found.'}
        </p>

        <Link to="/lobby" className="stud-back-link">
          ← Back to Lobby
        </Link>
      </main>
    );
  }

  return (
    <main className="stud-page">
      <div className="stud-page-heading">
        <div>
          <p className="stud-eyebrow">
            POKER FACE · IN-GAME PLAY
          </p>

          <h1>Seven-Card Stud</h1>

          <p className="stud-subtitle">
            Your seven-card stud table
          </p>
        </div>

        <div className="stud-header-actions">
          <button
            type="button"
            className="stud-start-button"
            onClick={handleStartGame}
            disabled={
              startingGame ||
              Boolean(game) ||
              Boolean(table.currentGameId)
            }
          >
            {startingGame
              ? 'Starting Game...'
              : game || table.currentGameId
                ? 'Game Started'
                : 'Start Game'}
          </button>

          <Link to="/lobby" className="stud-back-link">
            ← Back to Lobby
          </Link>
        </div>
      </div>

      <div className="stud-notice" role="status">
        <span
          className="stud-notice-icon"
          aria-hidden="true"
        >
          !
        </span>

        <div>
          <strong>
            {game ? 'Game status' : 'Waiting for game'}
          </strong>

          <p>{gameNotice}</p>
        </div>
      </div>

      <div className="stud-layout">
        <aside className="stud-left-column">
          <section className="stud-panel stud-table-info">
            <h2>Table: {table.name}</h2>

            <dl>
              <div>
                <dt>Join Code</dt>
                <dd className="stud-table-id">
                  {table.joinCode || 'Private tables only'}
                </dd>
              </div>

              <div>
                <dt>Level</dt>
                <dd>{table.level}</dd>
              </div>

              <div>
                <dt>Players</dt>
                <dd>
                  {table.filledSeats}/{table.capacity}
                </dd>
              </div>

              <div>
                <dt>Bots</dt>
                <dd>{table.botCount}</dd>
              </div>
            </dl>

            <button
              type="button"
              className="stud-secondary-button"
              onClick={() =>
                showNotImplemented('Leaving the table')
              }
            >
              Leave Table
            </button>
          </section>

          <section className="stud-panel stud-chat-panel">
            <h2>Chat</h2>

            <div
              className="stud-chat-messages"
              aria-live="polite"
            >
              {chatMessages.length === 0 ? (
                <p className="stud-chat-empty">
                  No messages yet. Say hello when others arrive.
                </p>
              ) : (
                chatMessages.map((item, index) => (
                  <p key={`${item.name}-${index}`}>
                    <strong>{item.name}:</strong>{' '}
                    {item.message}
                  </p>
                ))
              )}
            </div>

            <form
              className="stud-chat-form"
              onSubmit={sendChat}
            >
              <label
                className="stud-visually-hidden"
                htmlFor="stud-chat-input"
              >
                Type a message
              </label>

              <input
                id="stud-chat-input"
                value={chatMessage}
                onChange={(event) =>
                  setChatMessage(event.target.value)
                }
                placeholder="Type a message..."
                maxLength={200}
              />

              <button
                type="submit"
                aria-label="Add chat message"
                title="Add local preview message"
              >
                ➤
              </button>
            </form>

            <p className="stud-chat-note">
              Preview only — chat is not connected.
            </p>
          </section>
        </aside>

        <section
          className="stud-game-area"
          aria-label="Seven-Card Stud table"
        >
          <div className="stud-round-label">
            {game
              ? `Street ${game.street} · ${
                  game.bettingRoundComplete
                    ? 'Betting Complete'
                    : 'Betting In Progress'
                }`
              : 'Waiting for players'}
          </div>

          <div className="stud-felt">
            {otherSeatPositions.map((position, index) => {
              const player = opponents[index];

              return player ? (
                <PokerSeat
                  key={player.playerId}
                  name={
                    String(player.playerId).startsWith('bot-')
                      ? `Bot ${index + 1}`
                      : `Player ${index + 2}`
                  }
                  position={position}
                  chips={getPlayerChips(player.playerId)}
                  isBringIn={
                    String(game?.bringInPlayerId) ===
                    String(player.playerId)
                  }
                  isTurn={
                    String(game?.currentTurnPlayerId) ===
                    String(player.playerId)
                  }
                  hasFolded={player.hasFolded}
                  contribution={player.roundContribution}
                  cards={player.cards}
                />
              ) : (
                <EmptySeat
                  key={position}
                  position={position}
                />
              );
            })}

            <PokerSeat
              name="You"
              position="bottom"
              isYou
              cards={me?.cards || []}
              chips={myChips}
              isBringIn={Boolean(
                me &&
                  String(game?.bringInPlayerId) ===
                    String(me.playerId)
              )}
              isTurn={isMyTurn}
              hasFolded={me?.hasFolded}
              contribution={me?.roundContribution}
            />

            <div className="stud-board stud-board-waiting poker-pot-area">
              {game && (
                <div
                  className="poker-pot-chips"
                  aria-hidden="true"
                >
                  <ChipStack amount={game.pot} />
                  <ChipStack amount={game.pot} />
                  <ChipStack amount={game.pot} />
                </div>
              )}

              <div className="stud-pot">
                <span>
                  Pot: {game?.pot ?? 0} chips
                </span>
              </div>

              {game ? (
                <div className="stud-betting-info">
                  <span>Ante: {game.ante}</span>
                  <span>Bring-in: {game.bringIn}</span>
                  <span>
                    Current bet: {game.currentBet ?? 0}
                  </span>

                  <span>
                    {game.status === 'Completed'
                      ? 'Game completed'
                      : game.bettingRoundComplete
                        ? 'Betting round complete'
                        : isMyTurn
                          ? 'Your turn'
                          : 'Waiting for another player'}
                  </span>
                </div>
              ) : (
                <p className="stud-board-caption">
                  Each player receives two private cards
                  and one exposed card.
                </p>
              )}
            </div>
          </div>

          {/* P16: Betting actions with hover tooltips */}
          <div className="stud-actions">
            {[
              'Fold',
              'Check',
              'Call',
              'Bet',
              'Raise',
            ].map((action) => {
              const disabledByRules =
                (action === 'Check' &&
                  amountToCall > 0) ||
                (action === 'Call' &&
                  (amountToCall === 0 ||
                    !canAfford(amountToCall))) ||
                (action === 'Bet' &&
                  ((game?.currentBet ?? 0) > 0 ||
                    !canAfford(betAmount))) ||
                (action === 'Raise' &&
                  ((game?.currentBet ?? 0) === 0 ||
                    raiseLimitReached ||
                    !canAfford(requiredRaise)));

              return (
                <button
                  key={action}
                  type="button"
                  title={getActionTooltip(action)}
                  onClick={() =>
                    handleBettingAction(action)
                  }
                  disabled={
                    !canAct || disabledByRules
                  }
                >
                  {action}
                </button>
              );
            })}
          </div>
        </section>

        <aside className="stud-right-column">
          <section className="stud-panel stud-players-panel">
            <h2>
              Players (
              {game
                ? players.length
                : `${table.filledSeats}/${table.capacity}`}
              )
            </h2>

            <ul>
              <li>
                <span
                  className="stud-player-icon"
                  aria-hidden="true"
                >
                  ♙
                </span>

                <span className="stud-player-name">
                  You
                </span>

                <strong>
                  {me?.hasFolded
                    ? 'Folded'
                    : isMyTurn
                      ? 'Your turn'
                      : game
                        ? 'Dealt'
                        : 'Waiting'}
                </strong>
              </li>
            </ul>

            <div className="stud-spectators">
              <h3>Spectators (0)</h3>
              <p className="stud-empty-list">
                No spectators yet.
              </p>
            </div>
          </section>

          <section className="stud-panel stud-waiting-panel">
            <h2>Waiting Room</h2>

            <p>
              {game
                ? 'The game has started.'
                : 'Waiting for the game to start.'}
            </p>

            <p className="stud-waiting-muted">
              {table.joinCode
                ? 'Share the private table join code with friends.'
                : 'Players can find this table in the public lobby.'}
            </p>
          </section>
        </aside>
      </div>

      <p className="stud-footer-note">
        {game
          ? 'Betting is available on the current street. Later streets are not implemented yet.'
          : 'Cards will appear after the game starts.'}
      </p>
    </main>
  );
}

export default Table;
