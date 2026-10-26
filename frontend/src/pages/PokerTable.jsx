import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import './PokerTable.css';

const currentPlayer = { name: 'You (Host)', chips: null, position: 'bottom', you: true };

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

function HostSeat() {
  return (
    <div className="stud-seat stud-seat-you seat-bottom">
      <div className="stud-seat-avatar" aria-hidden="true">♙</div>
      <div className="stud-seat-details">
        <strong>{currentPlayer.name}</strong>
        <span>Ready to join</span>
      </div>
    </div>
  );
}

function Table() {
  const { tableId } = useParams();
  const [chatMessage, setChatMessage] = useState('');
  const [chatMessages, setChatMessages] = useState([]);
  const [gameNotice, setGameNotice] = useState(
    'Waiting for other players. The game will be available when gameplay is implemented.'
  );

  function showNotImplemented(feature) {
    setGameNotice(`${feature} is not available yet. The game has not started.`);
  }

  function sendChat(event) {
    event.preventDefault();
    const message = chatMessage.trim();
    if (!message) return;
    setChatMessages((current) => [...current, { name: 'You', message }]);
    setChatMessage('');
    setGameNotice('Chat is a local preview only; messages are not sent to other players.');
  }

  return (
    <main className="stud-page">
      <div className="stud-page-heading">
        <div>
          <p className="stud-eyebrow">POKER FACE · IN-GAME PLAY</p>
          <h1>Seven-Card Stud</h1>
          <p className="stud-subtitle">Your table is set up. Gameplay is coming soon.</p>
        </div>
        <Link to="/lobby" className="stud-back-link">← Back to Lobby</Link>
      </div>

      <div className="stud-notice" role="status">
        <span className="stud-notice-icon" aria-hidden="true">!</span>
        <div>
          <strong>Gameplay unavailable</strong>
          <p>{gameNotice}</p>
        </div>
      </div>

      <div className="stud-layout">
        <aside className="stud-left-column">
          <section className="stud-panel stud-table-info">
            <h2>Table: Waiting Room</h2>
            <dl>
              <div><dt>Level</dt><dd>—</dd></div>
              <div><dt>Type</dt><dd>—</dd></div>
              <div><dt>Players</dt><dd>1/6</dd></div>
              <div><dt>Bots</dt><dd>0</dd></div>
              {tableId && <div><dt>Table ID</dt><dd className="stud-table-id">{tableId}</dd></div>}
            </dl>
            <button type="button" className="stud-secondary-button" onClick={() => showNotImplemented('Leaving the table')}>Leave Table</button>
          </section>

          <section className="stud-panel stud-chat-panel">
            <h2>Chat</h2>
            <div className="stud-chat-messages" aria-live="polite">
              {chatMessages.length === 0 ? (
                <p className="stud-chat-empty">No messages yet. Say hello when others arrive.</p>
              ) : chatMessages.map((item, index) => (
                <p key={`${item.name}-${index}`}><strong>{item.name}:</strong> {item.message}</p>
              ))}
            </div>
            <form className="stud-chat-form" onSubmit={sendChat}>
              <label className="stud-visually-hidden" htmlFor="stud-chat-input">Type a message</label>
              <input id="stud-chat-input" value={chatMessage} onChange={(event) => setChatMessage(event.target.value)} placeholder="Type a message..." maxLength={200} />
              <button type="submit" aria-label="Add chat message" title="Add local preview message">➤</button>
            </form>
            <p className="stud-chat-note">Preview only — chat is not connected.</p>
          </section>
        </aside>

        <section className="stud-game-area" aria-label="Seven-Card Stud table preview">
          <div className="stud-round-label">Waiting for players</div>
          <div className="stud-felt">
            <EmptySeat position="top" />
            <EmptySeat position="left" />
            <EmptySeat position="left-lower" />
            <EmptySeat position="right" />
            <EmptySeat position="right-upper" />
            <HostSeat />
            <div className="stud-board stud-board-waiting">
              <div className="stud-community-cards stud-community-cards-empty" aria-label="No cards dealt yet">
                <span className="stud-empty-card" />
                <span className="stud-empty-card" />
                <span className="stud-empty-card" />
                <span className="stud-empty-card" />
                <span className="stud-empty-card" />
              </div>
              <div className="stud-pot">
                <span className="stud-pot-chips" aria-hidden="true">▤</span>
                <span>Pot: $0</span>
              </div>
              <p className="stud-board-caption">Cards will appear here when the game starts.</p>
            </div>
          </div>

          <div className="stud-actions">
            {['Fold', 'Check', 'Bet', 'Raise'].map((action) => (
              <button key={action} type="button" onClick={() => showNotImplemented(action)}>{action}</button>
            ))}
            <label className="stud-bet-amount">
              <span>$</span>
              <input aria-label="Bet amount" type="number" min="1" defaultValue="50" disabled />
              <span className="stud-bet-spinner" aria-hidden="true">⌃<br />⌄</span>
            </label>
          </div>
        </section>

        <aside className="stud-right-column">
          <section className="stud-panel stud-players-panel">
            <h2>Players (1/6)</h2>
            <ul>
              <li>
                <span className="stud-player-icon" aria-hidden="true">♙</span>
                <span className="stud-player-name">You (Host)</span>
                <strong>Ready</strong>
              </li>
            </ul>
            <div className="stud-spectators">
              <h3>Spectators (0)</h3>
              <p className="stud-empty-list">No spectators yet.</p>
            </div>
          </section>

          <section className="stud-panel stud-waiting-panel">
            <h2>Waiting Room</h2>
            <p>You're the first one here.</p>
            <p className="stud-waiting-muted">Share the table's join code with friends so they can join.</p>
          </section>
        </aside>
      </div>

      <p className="stud-footer-note">The game has not started. Player seats and cards will populate when the table and gameplay services are connected.</p>
    </main>
  );
}

export default Table;
