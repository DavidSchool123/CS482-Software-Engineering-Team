import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './Lobby.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';;

function Lobby({ tableSearch = '' }) {
  const [selectedLevels, setSelectedLevels] = useState([]);
  const [selectedSizes, setSelectedSizes] = useState([]);
  const [availability, setAvailability] = useState('all');
  const [tables, setTables] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [showPrivateModal, setShowPrivateModal] = useState(false);
  const [joinCode, setJoinCode] = useState('');

  const [showCreateModal, setShowCreateModal] = useState(false);
  const navigate = useNavigate();
  const [creatingTable, setCreatingTable] = useState(false);
  const [createError, setCreateError] = useState('');
  const [createTableData, setCreateTableData] = useState({
    Name: '',
    Capacity: 6,
    BotCount: 0,
    IsPublic: true,
    Level: 'Medium',
  });


  const [showBuyInModal, setShowBuyInModal] = useState(false);
  const [selectedTable, setSelectedTable] = useState(null);
  const [buyIn, setBuyIn] = useState(0);

  // Temporary balance until the account/chip system is connected.
  const demoBalance = 1000;

  useEffect(() => {
    const controller = new AbortController();

    async function fetchTables() {
      try {
        setLoading(true);
        setError('');

        const response = await fetch(
          `${API_URL}/api/tables`,
          { signal: controller.signal }
        );

        if (!response.ok) {
          throw new Error('Failed to load tables.');
        }

        const data = await response.json();
        setTables(data);
      } catch (err) {
        if (err.name !== 'AbortError') {
          setError('Unable to load tables. Please try again later.');
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    fetchTables();

    return () => controller.abort();
  }, []);

  function toggleLevel(level) {
    setSelectedLevels((previous) =>
      previous.includes(level)
        ? previous.filter((item) => item !== level)
        : [...previous, level]
    );
  }

  function toggleSize(size) {
    setSelectedSizes((previous) =>
      previous.includes(size)
        ? previous.filter((item) => item !== size)
        : [...previous, size]
    );
  }

  function clearFilters() {
    setSelectedLevels([]);
    setSelectedSizes([]);
    setAvailability('all');
  }

  function isTableFull(table) {
    return table.playerCount >= table.capacity;
  }

  function canJoinTable(table) {
    return (
      table.status !== 'Closed' &&
      !isTableFull(table) &&
      Boolean(table.stakes)
    );
  }

  const filteredTables = tables
    .filter((table) => {
      const matchesSearch = table.name
        .toLowerCase()
        .includes(tableSearch.trim().toLowerCase());

      const matchesLevel =
        selectedLevels.length === 0 ||
        selectedLevels.includes(table.level);

      const matchesSize =
        selectedSizes.length === 0 ||
        selectedSizes.includes(table.capacity);

      const matchesAvailability =
        availability === 'all' ||
        (availability === 'available' && canJoinTable(table)) ||
        (availability === 'inProgress' &&
          table.status === 'In Progress');

      return (
        matchesSearch &&
        matchesLevel &&
        matchesSize &&
        matchesAvailability
      );
    })
    .sort((a, b) => {
      // Show joinable tables before full tables.
      return Number(canJoinTable(b)) - Number(canJoinTable(a));
    });

  function openJoinModal(table) {
    if (!canJoinTable(table)) return;

    setSelectedTable(table);
    setBuyIn(table.stakes.minBuyIn);
    setShowBuyInModal(true);
  }

  function closeJoinModal() {
    setShowBuyInModal(false);
    setSelectedTable(null);
    setBuyIn(0);
  }

  function handlePrivateJoin(event) {
    event.preventDefault();

    if (!joinCode.trim()) return;

    // Private-table lookup belongs to the Join Table feature.
    alert('Private table lookup is not available yet.');
  }

  async function handleCreateTable(event) {
    event.preventDefault();

    setCreatingTable(true);
    setCreateError('');

    try {
      const response = await fetch(`${API_URL}/api/tables`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(createTableData),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || 'Failed to create table.');
      }

      if (!result.id) {
        throw new Error('The server did not return a table ID.');
      }

      setShowCreateModal(false);
      navigate(`/table/${result.joinCode}`); //theoretically, this should also use the same buy in as the join table -- i need to talk with the team about how the buy-ins should work...
    } catch (error) {
          console.error('Create table failed:', error);

      setCreateError(error.message || 'Unable to create table.');
    } finally {
      setCreatingTable(false);
    }
  }


  function renderTableCard(table) {
    const isFull = isTableFull(table);
    const isInProgress = table.status === 'In Progress';
    const joinable = canJoinTable(table);

    const displayStatus =
      isInProgress
        ? 'In Progress'
        : isFull
          ? 'Full'
          : table.status;

    return (
      <article className="table-card" key={table.id}>
        <div className="table-card-header">
          <div>
            <h3>{table.name}</h3>
            <p className="table-card-subtitle">
              {table.level} Stakes · {table.playerCount}/
              {table.capacity} Players
            </p>
          </div>

          <span
            className={`table-status ${
              isInProgress ? 'status-progress' : ''
            }`}
          >
            {displayStatus}
          </span>
        </div>

        <div className="table-card-details">
          <div className="table-detail">
            <span className="detail-label">
              Buy-In Range
              <span
                className="info-icon"
                title="The minimum and maximum number of chips you can bring to this table."
                tabIndex={0}
                aria-label="Buy-in range is the minimum and maximum number of chips you can bring to this table."
              >
                ⓘ
              </span>
            </span>

            <strong>
              {table.stakes
                ? `${table.stakes.minBuyIn.toLocaleString()}–${table.stakes.maxBuyIn.toLocaleString()} chips`
                : 'Unavailable'}
            </strong>
          </div>

          <div className="table-detail">
            <span className="detail-label">
              Bet Amounts
              <span
                className="info-icon"
                title="The fixed betting increments used during the game. Early rounds use the smaller amount; later rounds use the larger amount."
                tabIndex={0}
                aria-label="Bet amounts are the fixed betting increments. Early rounds use the smaller amount and later rounds use the larger amount."
              >
                ⓘ
              </span>
            </span>

            <strong>
              {table.stakes
                ? `${table.stakes.smallBet} / ${table.stakes.bigBet} chips`
                : 'Unavailable'}
            </strong>
          </div>
        </div>

        <div className="table-card-footer">
          {isInProgress && joinable && (
            <span className="join-next-hand-note">
              Join now, play next hand
            </span>
          )}

          <div className="table-actions">
            {isInProgress && (
              <button
                type="button"
                className="observe-btn"
                disabled
                title="Spectator functionality is coming soon."
              >
                Observe
              </button>
            )}

            <button
              type="button"
              className="join-btn"
              disabled={!joinable}
              onClick={() => openJoinModal(table)}
            >
              {isFull ? 'Table Full' : 'Join Table'}
            </button>
          </div>
        </div>
      </article>
    );
  }

  const maxAffordableBuyIn = selectedTable
    ? Math.min(selectedTable.stakes.maxBuyIn, demoBalance)
    : 0;

  const canAffordTable = selectedTable
    ? demoBalance >= selectedTable.stakes.minBuyIn
    : false;



  return (
    <div className="lobby-page">
      <div className="lobby-layout">
        {/* LEFT: FILTERS */}
        <aside className="lobby-filters">
          <h2>Filters</h2>

          <div className="filter-group">
            <h3>Table Level</h3>

            {['Low', 'Medium', 'High'].map((level) => (
              <label className="filter-option" key={level}>
                <input
                  type="checkbox"
                  checked={selectedLevels.includes(level)}
                  onChange={() => toggleLevel(level)}
                />
                <span>{level} Stakes</span>
              </label>
            ))}
          </div>

          <div className="filter-group">
            <h3>Table Size</h3>

            {[2, 3, 4, 5, 6].map((size) => (
              <label className="filter-option" key={size}>
                <input
                  type="checkbox"
                  checked={selectedSizes.includes(size)}
                  onChange={() => toggleSize(size)}
                />
                <span>{size} Players</span>
              </label>
            ))}
          </div>

          <div className="filter-group">
            <h3>Availability</h3>

            <label className="filter-option">
              <input
                type="radio"
                name="availability"
                value="all"
                checked={availability === 'all'}
                onChange={() => setAvailability('all')}
              />
              <span>All Tables</span>
            </label>

            <label className="filter-option">
              <input
                type="radio"
                name="availability"
                value="available"
                checked={availability === 'available'}
                onChange={() => setAvailability('available')}
              />
              <span>Available Seats</span>
            </label>

            <label className="filter-option">
              <input
                type="radio"
                name="availability"
                value="inProgress"
                checked={availability === 'inProgress'}
                onChange={() => setAvailability('inProgress')}
              />
              <span>In Progress</span>
            </label>
          </div>

          <button
            type="button"
            className="clear-filters-btn"
            onClick={clearFilters}
          >
            Clear Filters
          </button>
        </aside>

        {/* CENTER: PUBLIC TABLES */}
        <main className="lobby-tables">
          <div className="lobby-heading">
            <div>
              <h1>Public Tables</h1>
              <p>Find a table to play or watch a game.</p>
            </div>

            <div className="lobby-heading-actions">
              <button
                type="button"
                className="create-table-btn"
                onClick={() => setShowCreateModal(true)}
              >
                + Create Table
              </button>

              <button
                type="button"
                className="private-table-btn"
                onClick={() => setShowPrivateModal(true)}
              >
                Join Private Table
              </button>
            </div>
          </div>

          {loading ? (
            <p className="no-tables">Loading tables...</p>
          ) : error ? (
            <p className="no-tables" role="alert">{error}</p>
          ) : filteredTables.length === 0 ? (
            <p className="no-tables">
              No tables match your filters.
            </p>
          ) : (
            <div className="table-card-list">
              {filteredTables.map(renderTableCard)}
            </div>
          )}
        </main>

        {/* RIGHT: ADVERTISEMENT PLACEHOLDER */}
        <aside className="lobby-ad">
          <span>Advertisement</span>
        </aside>
      </div>

      <div className="lobby-bottom-ad">
        Advertisement
      </div>


      {/* CREATE TABLE MODAL */}
      {showCreateModal && (
        <div
          className="lobby-modal-overlay"
          onClick={() => setShowCreateModal(false)}
        >
          <div
            className="lobby-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="create-modal-title"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 id="create-modal-title">Create Table</h2>
            <p>Configure your new table.</p>

            <form onSubmit={handleCreateTable}>
              <label htmlFor="create-table-name">Table Name</label>
              <input
                id="create-table-name"
                type="text"
                value={createTableData.Name}
                onChange={(event) =>
                  setCreateTableData({
                    ...createTableData,
                    Name: event.target.value,
                  })
                }
                required
              />

              <label htmlFor="create-table-capacity">Capacity</label>
              <input
                id="create-table-capacity"
                type="number"
                min="2"
                max="6"
                value={createTableData.Capacity}
                onChange={(event) =>
                  setCreateTableData({
                    ...createTableData,
                    Capacity: Number(event.target.value),
                  })
                }
                required
              />

              <label htmlFor="create-table-bots">Bot Count</label>
              <input
                id="create-table-bots"
                type="number"
                min="0"
                max="5"
                value={createTableData.BotCount}
                onChange={(event) =>
                  setCreateTableData({
                    ...createTableData,
                    BotCount: Number(event.target.value),
                  })
                }
                required
              />

              <label htmlFor="create-table-level">Level</label>
              <select
                id="create-table-level"
                value={createTableData.Level}
                onChange={(event) =>
                  setCreateTableData({
                    ...createTableData,
                    Level: event.target.value,
                  })
                }
              >
                <option value="Low">Low</option>
                <option value="Medium">Medium</option>
                <option value="High">High</option>
              </select>

              <label htmlFor="create-table-visibility">
                Visibility
              </label>
              <select
                id="create-table-visibility"
                value={String(createTableData.IsPublic)}
                onChange={(event) =>
                  setCreateTableData({
                    ...createTableData,
                    IsPublic: event.target.value === 'true',
                  })
                }
              >
                <option value="true">Public</option>
                <option value="false">Private</option>
              </select>

              {createError && (
                <p className="modal-note" role="alert">
                  {createError}
                </p>
              )}
              <div className="modal-actions">
                <button
                  type="button"
                  className="cancel-btn"
                  onClick={() => setShowCreateModal(false)}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="join-btn"
                  disabled={creatingTable}
                >
                  {creatingTable ? 'Creating...' : 'Create Table'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PRIVATE TABLE MODAL */}
      {showPrivateModal && (
        <div
          className="lobby-modal-overlay"
          onClick={() => setShowPrivateModal(false)}
        >
          <div
            className="lobby-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="private-modal-title"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 id="private-modal-title">Join Private Table</h2>
            <p>Enter the code shared by the table creator.</p>

            <form onSubmit={handlePrivateJoin}>
              <label htmlFor="private-join-code">
                Table Code
              </label>

              <input
                id="private-join-code"
                type="text"
                value={joinCode}
                onChange={(event) =>
                  setJoinCode(event.target.value)
                }
                placeholder="Enter table code"
                required
              />

              <div className="modal-actions">
                <button
                  type="button"
                  className="cancel-btn"
                  onClick={() => setShowPrivateModal(false)}
                >
                  Cancel
                </button>

                <button type="submit" className="join-btn">
                  Find Table
                </button>
              </div>
            </form>

            <p className="modal-note">
              Private table lookup will be connected later.
            </p>
          </div>
        </div>
      )}

      {/* BUY-IN MODAL */}
      {showBuyInModal && selectedTable && (
        <div
          className="lobby-modal-overlay"
          onClick={closeJoinModal}
        >
          <div
            className="lobby-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="buy-in-modal-title"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 id="buy-in-modal-title">
              Join {selectedTable.name}
            </h2>

            {selectedTable.status === 'In Progress' && (
              <p className="modal-note">
                This game is already in progress. You can
                take an available seat and play starting
                with the next hand.
              </p>
            )}

            <p>
              Your Balance:{' '}
              <strong>
                {demoBalance.toLocaleString()} chips
              </strong>
            </p>

            <p>
              Buy-In Range:{' '}
              <strong>
                {selectedTable.stakes.minBuyIn.toLocaleString()}
                {' – '}
                {selectedTable.stakes.maxBuyIn.toLocaleString()}
                {' chips'}
              </strong>
            </p>

            {canAffordTable ? (
              <>
                <label htmlFor="buy-in-slider">
                  Your Buy-In:{' '}
                  <strong>{buyIn.toLocaleString()} chips</strong>
                </label>

                <input
                  id="buy-in-slider"
                  type="range"
                  min={selectedTable.stakes.minBuyIn}
                  max={maxAffordableBuyIn}
                  step={1}
                  value={buyIn}
                  onChange={(event) =>
                    setBuyIn(Number(event.target.value))
                  }
                />

                <p className="modal-note">
                  Choose how many chips to bring to the table.
                </p>
              </>
            ) : (
              <p className="modal-note" role="alert">
                You don't have enough chips to meet this
                table's minimum buy-in.
              </p>
            )}

            <div className="modal-actions">
              <button
                type="button"
                className="cancel-btn"
                onClick={closeJoinModal}
              >
                Cancel
              </button>

              <button
                type="button"
                className="join-btn"
                disabled
                title="Joining a table will be connected later."
              >
                Confirm Buy-In
              </button>
            </div>

            <p className="modal-note">
              Chip transfers and joining will be connected
              when the account and gameplay features are ready.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export default Lobby;
