import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import PlayingCard from '../components/PlayingCard';
import './PokerTable.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const otherSeatPositions = ['top', 'left', 'left-lower', 'right', 'right-upper'];

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

// This component represents the current player's seat.
function HostSeat({ cards = [] }) {
  return (
    <div className="stud-seat stud-seat-you seat-bottom">
      <div className="stud-seat-avatar" aria-hidden="true">♙</div>
      <div className="stud-seat-details">
        <strong>You</strong>
        <span>{cards.length > 0 ? 'Cards dealt' : 'Waiting for cards'}</span>
      </div>
      {cards.length > 0 && (
        <div className="stud-hole-cards">
          {cards.map((card, index) => (
            <PlayingCard key={index} card={card} />
          ))}
        </div>
      )}
    </div>
  );
}

// This component represents another player's seat.
function PlayerSeat({ name, position, cards = [] }) {
  return (
    <div className={`stud-seat seat-${position}`}>
      <div className="stud-seat-avatar" aria-hidden="true">♙</div>
      <div className="stud-seat-details">
        <strong>{name}</strong>
        <span>{cards.length > 0 ? 'Cards dealt' : 'Waiting for cards'}</span>
      </div>
      {cards.length > 0 && (
        <div className="stud-hole-cards">
          {cards.map((card, index) => (
            <PlayingCard key={index} card={card} hidden={!card.faceUp} />
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [gameNotice, setGameNotice] = useState(
    'Waiting for players to start the game.'
  );

  useEffect(() => {
    async function fetchTable() {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch(
          `${API_URL}/api/tables/${encodeURIComponent(joinCode)}`,
          { credentials: 'include', cache: 'no-store' }
        );

        if (!response.ok) {
          throw new Error(
            response.status === 404
              ? 'Table not found. Check the join code.'
              : 'Unable to load table information.'
          );
        }

        const data = await response.json();
        setTable(data);

// If a game already exists, retrieve its cards.
if (data.currentGameId) {
  const gameResponse = await fetch(
    `${API_URL}/api/games/${data.currentGameId}`,
    {
      credentials: 'include',
    }
  );

  const gameData = await gameResponse.json();

  if (!gameResponse.ok) {
    throw new Error(
      gameData.error || gameData.message || 'Unable to load existing game.'
    );
  }

  setGame(gameData);
  setGameNotice('Game in progress. Cards loaded.');
}
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    fetchTable();
  }, [joinCode]);

  function showNotImplemented(feature) {
    setGameNotice(`${feature} is not available yet.`);
  }

  function sendChat(event) {
    event.preventDefault();
    const message = chatMessage.trim();
    if (!message) return;

    setChatMessages((current) => [...current, { name: 'You', message }]);
    setChatMessage('');
    setGameNotice('Chat is a local preview only; messages are not sent to other players.');
  }

  async function handleStartGame() {
    if (!table?.id || startingGame || game || table.currentGameId) return;

    setStartingGame(true);
    try {
      const response = await fetch(`${API_URL}/api/tables/${table.id}/start`, {
        method: 'POST',
        credentials: 'include',
      });

      const responseText = await response.text();

      console.log('START GAME STATUS:', response.status);
      console.log('START GAME RESPONSE:', responseText);

      const data = JSON.parse(responseText);

      if (!response.ok) {
        setGameNotice(data.error || data.message || 'Unable to start the game.');
        console.error('Failed to start game:', data);
        return;
      }

      // Save the game ID immediately to prevent starting the same game twice.
      setTable((previous) => ({
        ...previous,
        currentGameId: data.gameId,
        status: 'In Progress',
      }));

      const gameResponse = await fetch(`${API_URL}/api/games/${data.gameId}`, {
        credentials: 'include',
      });
      const gameResponseText = await gameResponse.text();

      console.log('GET GAME STATUS:', gameResponse.status);
      console.log('GET GAME RESPONSE:', gameResponseText);

      const gameData = JSON.parse(gameResponseText);

      if (!gameResponse.ok) {
        setGameNotice(gameData.error || gameData.message || 'Unable to load cards.');
        console.error('Failed to retrieve game:', gameData);
        return;
      }

      setGame(gameData);
      setGameNotice('Initial cards have been dealt.');
      console.log('Game loaded:', gameData);
    } catch (err) {
      console.error('Error starting game:', err);
      setGameNotice(err.message || 'Unable to start the game.');
    } finally {
      setStartingGame(false);
    }
  }

  const players = game?.players || [];
  const me = players.find((player) => player.isCurrentPlayer);
  const opponents = players.filter((player) => !player.isCurrentPlayer);

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
        <p role="alert">{error || 'Table not found.'}</p>
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
          <p className="stud-eyebrow">POKER FACE · IN-GAME PLAY</p>
          <h1>Seven-Card Stud</h1>
          <p className="stud-subtitle">Your seven-card stud table</p>
        </div>
        <div className="stud-header-actions">
          <button
            type="button"
            className="stud-start-button"
            onClick={handleStartGame}
            disabled={startingGame || Boolean(game) || Boolean(table.currentGameId)}
          >
            {startingGame
              ? 'Starting Game...'
              : game || table.currentGameId
                ? 'Game Started'
                : 'Start Game'}
          </button>
          <Link to="/lobby" className="stud-back-link">← Back to Lobby</Link>
        </div>
      </div>

      <div className="stud-notice" role="status">
        <span className="stud-notice-icon" aria-hidden="true">!</span>
        <div>
          <strong>{game ? 'Cards dealt' : 'Game status'}</strong>
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
                <dd className="stud-table-id">{table.joinCode || 'Private tables only'}</dd>
              </div>
              <div><dt>Level</dt><dd>{table.level}</dd></div>
              <div><dt>Players</dt><dd>{table.filledSeats}/{table.capacity}</dd></div>
              <div><dt>Bots</dt><dd>{table.botCount}</dd></div>
            </dl>
            <button
              type="button"
              className="stud-secondary-button"
              onClick={() => showNotImplemented('Leaving the table')}
            >
              Leave Table
            </button>
          </section>

          <section className="stud-panel stud-chat-panel">
            <h2>Chat</h2>
            <div className="stud-chat-messages" aria-live="polite">
              {chatMessages.length === 0 ? (
                <p className="stud-chat-empty">No messages yet. Say hello when others arrive.</p>
              ) : (
                chatMessages.map((item, index) => (
                  <p key={`${item.name}-${index}`}>
                    <strong>{item.name}:</strong> {item.message}
                  </p>
                ))
              )}
            </div>
            <form className="stud-chat-form" onSubmit={sendChat}>
              <label className="stud-visually-hidden" htmlFor="stud-chat-input">
                Type a message
              </label>
              <input
                id="stud-chat-input"
                value={chatMessage}
                onChange={(event) => setChatMessage(event.target.value)}
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
            <p className="stud-chat-note">Preview only — chat is not connected.</p>
          </section>
        </aside>

        <section className="stud-game-area" aria-label="Seven-Card Stud table preview">
          <div className="stud-round-label">{game ? 'Third Street · Cards Dealt' : 'Waiting for players'}</div>
          <div className="stud-felt">
            {otherSeatPositions.map((position, index) => {
              const player = opponents[index];
              return player ? (
                <PlayerSeat
                  key={player.playerId}
                  name={String(player.playerId).startsWith('bot-') ? `Bot ${index + 1}` : `Player ${index + 2}`}
                  position={position}
                  cards={player.cards}
                />
              ) : (
                <EmptySeat key={position} position={position} />
              );
            })}
            <HostSeat cards={me?.cards || []} />

            <div className="stud-board stud-board-waiting">
              <div className="stud-pot">
                <span className="stud-pot-chips" aria-hidden="true">▤</span>
                <span>Pot: $0</span>
              </div>
              <p className="stud-board-caption">
                Each player receives two private cards and one exposed card.
              </p>
            </div>
          </div>


          <div className="stud-actions">
            {['Fold', 'Check', 'Bet', 'Raise'].map((action) => (
              <button
                key={action}
                type="button"
                onClick={() => showNotImplemented(action)}
              >
                {action}
              </button>
            ))}
            <label className="stud-bet-amount">
              <span>$</span>
              <input
                aria-label="Bet amount"
                type="number"
                min="1"
                defaultValue="50"
                disabled
              />
              <span className="stud-bet-spinner" aria-hidden="true">⌃<br />⌄</span>
            </label>
          </div>
        </section>

        <aside className="stud-right-column">
          <section className="stud-panel stud-players-panel">
            <h2>Players ({game ? players.length : table.filledSeats}/{table.capacity})</h2>
            <ul>
              <li>
                <span className="stud-player-icon" aria-hidden="true">♙</span>
                <span className="stud-player-name">You</span>
                <strong>{game ? 'Dealt' : 'Waiting'}</strong>
              </li>
            </ul>
            <div className="stud-spectators">
              <h3>Spectators (0)</h3>
              <p className="stud-empty-list">No spectators yet.</p>
            </div>
          </section>

          <section className="stud-panel stud-waiting-panel">
            <h2>Waiting Room</h2>
            <p>{game ? 'The game has started.' : 'Waiting for the game to start.'}</p>
            <p className="stud-waiting-muted">
              {table.joinCode ? 'Share the private table join code with friends.' : 'Players can find this table in the public lobby.'}
            </p>
          </section>
        </aside>
      </div>

      <p className="stud-footer-note">
        {game
          ? 'Third street cards are displayed. Betting and later streets are not implemented yet.'
          : 'Cards will appear after the game starts.'}
      </p>
    </main>
  );
}

export default Table;
