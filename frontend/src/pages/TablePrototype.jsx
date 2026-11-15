
import { useMemo, useState } from 'react';
import './TablePrototype.css';

const sampleTables = [
  {
    id: 1,
    name: 'The Green Room',
    level: 'Low',
    players: 3,
    capacity: 6,
    status: 'Waiting',
    smallBet: 5,
    bigBet: 10,
    minBuyIn: 200,
    maxBuyIn: 1000,
    createdAt: '2026-11-10T14:00:00',
  },
  {
    id: 2,
    name: 'Midnight Stud',
    level: 'Medium',
    players: 2,
    capacity: 4,
    status: 'Waiting',
    smallBet: 10,
    bigBet: 20,
    minBuyIn: 400,
    maxBuyIn: 2000,
    createdAt: '2026-11-10T15:00:00',
  },
  {
    id: 3,
    name: 'High Rollers',
    level: 'High',
    players: 4,
    capacity: 6,
    status: 'In Progress',
    smallBet: 25,
    bigBet: 50,
    minBuyIn: 1000,
    maxBuyIn: 5000,
    createdAt: '2026-11-10T13:00:00',
  },
  {
    id: 4,
    name: 'Royal Flush Club',
    level: 'Medium',
    players: 6,
    capacity: 6,
    status: 'Waiting',
    smallBet: 10,
    bigBet: 20,
    minBuyIn: 400,
    maxBuyIn: 2000,
    createdAt: '2026-11-09T17:00:00',
  },
  {
    id: 5,
    name: 'Purple Palace',
    level: 'Low',
    players: 1,
    capacity: 6,
    status: 'Waiting',
    smallBet: 5,
    bigBet: 10,
    minBuyIn: 200,
    maxBuyIn: 1000,
    createdAt: '2026-11-10T16:00:00',
  },
];

const seatCoordinates = [
  { left: '50%', top: '7%' },
  { left: '17%', top: '27%' },
  { left: '17%', top: '73%' },
  { left: '83%', top: '27%' },
  { left: '83%', top: '73%' },
  { left: '50%', top: '93%' },
];

function PokerPreview({ table }) {
  const empty = table.capacity - table.players;
  const joinable = table.status === 'Waiting' && empty > 0;

  return (
    <div className="tp-preview-content">
      <div className="tp-preview-topline">
        <span className="tp-eyebrow">TABLE PREVIEW</span>

        <span className={`tp-status ${joinable ? 'tp-available' : ''}`}>
          {table.status === 'Waiting' && empty === 0
            ? 'Full'
            : table.status}
        </span>
      </div>

      <h2>{table.name}</h2>

      <p className="tp-preview-subtitle">
        {table.level} stakes · {table.players} of {table.capacity} seats occupied
      </p>

      <div className="tp-stage">
        <div className="tp-felt">
          <div className="tp-felt-inner" />

          <div className="tp-felt-logo">
            POKER FACE
            <span>SEVEN-CARD STUD</span>
          </div>
        </div>

        {seatCoordinates
          .slice(0, table.capacity)
          .map((position, index) => (
            <div
              key={index}
              className={`tp-seat ${
                index < table.players
                  ? 'tp-seat-taken'
                  : 'tp-seat-open'
              }`}
              style={position}
              title={
                index < table.players
                  ? `Player ${index + 1}`
                  : 'Open seat'
              }
            >
              {index < table.players ? (
                <span className="tp-person">♟</span>
              ) : (
                '+'
              )}
            </div>
          ))}
      </div>

      <div className="tp-preview-metrics">
        <div>
          <span>OPEN SEATS</span>
          <strong>{empty}</strong>
        </div>

        <div>
          <span>BUY-IN</span>
          <strong>
            {table.minBuyIn.toLocaleString()}–
            {table.maxBuyIn.toLocaleString()}
          </strong>
        </div>

        <div>
          <span>FIXED BETS</span>
          <strong>
            {table.smallBet} / {table.bigBet}
          </strong>
        </div>
      </div>

      <button
        className="tp-primary tp-preview-action"
        type="button"
        onClick={() =>
          window.alert(
            'Preview only — your existing Lobby.jsx handles real joining and spectating.'
          )
        }
      >
        {joinable ? 'Join This Table' : 'Observe Table'}
      </button>

      <p className="tp-disclaimer">
        Demo data only · No backend requests
      </p>
    </div>
  );
}

export default function TablePrototype() {
  const [query, setQuery] = useState('');
  const [level, setLevel] = useState('All');
  const [availability, setAvailability] = useState('All');

  const [activeId, setActiveId] = useState(null);
  const [pinnedId, setPinnedId] = useState(null);

  const visibleTables = useMemo(() => {
    return sampleTables
      .filter((table) => {
        const matchesQuery = table.name
          .toLowerCase()
          .includes(query.trim().toLowerCase());

        const matchesLevel =
          level === 'All' || table.level === level;

        const joinable =
          table.status === 'Waiting' &&
          table.players < table.capacity;

        const matchesAvailability =
          availability === 'All' ||
          (availability === 'Joinable' && joinable) ||
          (availability === 'In Progress' &&
            table.status === 'In Progress');

        return (
          matchesQuery &&
          matchesLevel &&
          matchesAvailability
        );
      })
      .sort((a, b) => {
        const priority = (table) => {
          if (
            table.status === 'Waiting' &&
            table.players < table.capacity
          ) {
            return 0;
          }

          if (table.status === 'Waiting') {
            return 1;
          }

          return 2;
        };

        return (
          priority(a) - priority(b) ||
          new Date(b.createdAt) - new Date(a.createdAt)
        );
      });
  }, [query, level, availability]);

  // Hover previews a table.
  // Clicking pins it open until clicked again.
  const expandedId = activeId ?? pinnedId;

  function resetSelection() {
    setActiveId(null);
    setPinnedId(null);
  }

  return (
    <main className="tp-page">
      <div className="tp-shell">
        <header className="tp-header">
          <div>
            <p className="tp-eyebrow">
              POKER FACE / GAME LOBBY
            </p>

            <h1>Find Your Table</h1>

            <p>
              Browse available games. Hover over a table
              to see its seats.
            </p>
          </div>

          <div className="tp-header-actions">
            <button
              type="button"
              className="tp-outline"
              onClick={() =>
                window.alert(
                  'Preview only — use /lobby for real tables.'
                )
              }
            >
              Join Private
            </button>

            <button
              type="button"
              className="tp-primary"
              onClick={() =>
                window.alert(
                  'Preview only — use /lobby for real tables.'
                )
              }
            >
              + Create Table
            </button>
          </div>
        </header>

        <section
          className="tp-practice"
          aria-label="Practice mode coming soon"
        >
          <div className="tp-practice-icon">♠</div>

          <div>
            <strong>Practice Arena</strong>
            <p>
              Sharpen your Seven-Card Stud skills against bots.
            </p>
          </div>

          <span className="tp-coming">
            COMING SOON
          </span>
        </section>

        <div className="tp-toolbar">
          <label className="tp-search">
            <span aria-hidden="true">⌕</span>

            <input
              type="search"
              placeholder="Search tables by name..."
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                resetSelection();
              }}
            />
          </label>

          <label className="tp-select-label">
            Stakes

            <select
              value={level}
              onChange={(event) => {
                setLevel(event.target.value);
                resetSelection();
              }}
            >
              <option>All</option>
              <option>Low</option>
              <option>Medium</option>
              <option>High</option>
            </select>
          </label>

          <label className="tp-select-label">
            Status

            <select
              value={availability}
              onChange={(event) => {
                setAvailability(event.target.value);
                resetSelection();
              }}
            >
              <option>All</option>
              <option>Joinable</option>
              <option>In Progress</option>
            </select>
          </label>
        </div>

        <div className="tp-section-heading">
          <div>
            <h2>
              Public Tables
              <span>{visibleTables.length}</span>
            </h2>

            <p>
              Available seats first · Newest tables first
            </p>
          </div>

          <span className="tp-hint">
            Hover to preview · Click to keep open
          </span>
        </div>

        <div className="tp-browser tp-browser-dropdown">
          <div className="tp-table-list">
            {visibleTables.length === 0 && (
              <div className="tp-empty">
                No tables match your search or filters.
              </div>
            )}

            {visibleTables.map((table) => {
              const joinable =
                table.status === 'Waiting' &&
                table.players < table.capacity;

              const expanded = table.id === expandedId;

              return (
                <div
                  key={table.id}
                  className={`tp-dropdown-item ${
                    expanded ? 'tp-dropdown-open' : ''
                  }`}
                  onMouseEnter={() =>
                    setActiveId(table.id)
                  }
                  onMouseLeave={() =>
                    setActiveId(null)
                  }
                >
                  <button
                    type="button"
                    className={`tp-table-row ${
                      expanded
                        ? 'tp-table-row-active'
                        : ''
                    }`}
                    onClick={() => {
                      setPinnedId((previous) =>
                        previous === table.id
                          ? null
                          : table.id
                      );

                      setActiveId(null);
                    }}
                    aria-expanded={expanded}
                    aria-controls={`tp-details-${table.id}`}
                  >
                    <div className="tp-row-icon">
                      ♠
                    </div>

                    <div className="tp-row-main">
                      <strong>{table.name}</strong>

                      <span>
                        {table.level} Stakes
                        <i> · </i>
                        {table.smallBet}/{table.bigBet} bets
                      </span>
                    </div>

                    <div className="tp-row-right">
                      <span
                        className={`tp-row-status ${
                          joinable ? 'tp-joinable' : ''
                        }`}
                      >
                        {joinable
                          ? '● Waiting'
                          : table.status === 'In Progress'
                            ? '● In Progress'
                            : '● Full'}
                      </span>

                      <span className="tp-row-players">
                        {table.players}/{table.capacity} players

                        <span
                          className={`tp-chevron ${
                            expanded
                              ? 'tp-chevron-open'
                              : ''
                          }`}
                        >
                          ⌄
                        </span>
                      </span>
                    </div>
                  </button>

                  {expanded && (
                    <div
                      className="tp-dropdown-panel"
                      id={`tp-details-${table.id}`}
                    >
                      <PokerPreview table={table} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <footer className="tp-footer">
          Prototype only. Your existing lobby, buy-in
          modal, and backend are unchanged.
        </footer>
      </div>
    </main>
  );
}
