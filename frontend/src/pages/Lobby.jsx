
import { useState, useEffect } from 'react';
import './Lobby.css';

function Lobby({ tableSearch = '' }) {
  // Store the selected filter options
  const [selectedLevels, setSelectedLevels] = useState([]);
  const [selectedTypes, setSelectedTypes] = useState([]);
  const [selectedPlayers, setSelectedPlayers] = useState([]);

  // Store tables retrieved from the backend
  const [tables, setTables] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Fetch tables from the backend when the Lobby loads
  useEffect(() => {
    const controller = new AbortController();

    async function fetchTables() {
      try {
        setLoading(true);
        setError('');

        const response = await fetch(
          'http://localhost:5000/api/tables',
          { signal: controller.signal }
        );

        if (!response.ok) {
          throw new Error('Failed to retrieve tables.');
        }

        const data = await response.json();

        if (!Array.isArray(data)) {
          throw new Error('Invalid table data received.');
        }

        // Convert MongoDB fields to the format used by the Lobby
        const formattedTables = data.map((table) => {
          const players =
            (table.UserIds?.length ?? 0) +
            (table.BotCount ?? 0);

          // Temporary betting level thresholds
          let level = 'High';

          if (table.MaxBet <= 100) {
            level = 'Low';
          } else if (table.MaxBet <= 500) {
            level = 'Medium';
          }

          const isFull = players >= table.Capacity;

          return {
            id: table._id,
            name: table.Name || 'Unnamed Table',
            level,
            players,
            maxPlayers: table.Capacity,
            type: table.IsPublic ? 'Public' : 'Private',
            status: table.Status || 'Waiting',
            isFull,
          };
        });

        setTables(formattedTables);
      } catch (err) {
        if (err.name !== 'AbortError') {
          setError(err.message);
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

  // Add or remove a checkbox selection
  function toggleFilter(value, selected, setSelected) {
    if (selected.includes(value)) {
      setSelected(selected.filter((item) => item !== value));
    } else {
      setSelected([...selected, value]);
    }
  }

  // Filter the available tables based on selections
  const filteredTables = tables.filter((table) => {
    const matchesSearch = table.name
      .toLowerCase()
      .includes(tableSearch.trim().toLowerCase());

    const matchesLevel =
      selectedLevels.length === 0 ||
      selectedLevels.includes(table.level);

    const matchesType =
      selectedTypes.length === 0 ||
      selectedTypes.includes(table.type);

    const matchesPlayers =
      selectedPlayers.length === 0 ||
      selectedPlayers.includes(table.maxPlayers);

    return (
      matchesSearch &&
      matchesLevel &&
      matchesType &&
      matchesPlayers
    );
  });

  return (
    <main className='lobby-page'>
      <div className='lobby-layout'>
        {/* Filter sidebar */}
        <aside className='lobby-filters'>
          <h2>Filters</h2>

          <div className='filter-group'>
            <h3>Table Level</h3>
            {['Low', 'Medium', 'High'].map((level) => (
              <label key={level}>
                <input
                  type='checkbox'
                  checked={selectedLevels.includes(level)}
                  onChange={() =>
                    toggleFilter(
                      level,
                      selectedLevels,
                      setSelectedLevels
                    )
                  }
                />
                {level}
              </label>
            ))}
          </div>

          <div className='filter-group'>
            <h3>Table Type</h3>
            {['Public', 'Private'].map((type) => (
              <label key={type}>
                <input
                  type='checkbox'
                  checked={selectedTypes.includes(type)}
                  onChange={() =>
                    toggleFilter(
                      type,
                      selectedTypes,
                      setSelectedTypes
                    )
                  }
                />
                {type}
              </label>
            ))}
          </div>

          <div className='filter-group'>
            <h3>Players</h3>
            {[2, 3, 4, 5, 6].map((count) => (
              <label key={count}>
                <input
                  type='checkbox'
                  checked={selectedPlayers.includes(count)}
                  onChange={() =>
                    toggleFilter(
                      count,
                      selectedPlayers,
                      setSelectedPlayers
                    )
                  }
                />
                {count}
              </label>
            ))}
          </div>

          <button
            type='button'
            className='clear-filters-btn'
            onClick={() => {
              setSelectedLevels([]);
              setSelectedTypes([]);
              setSelectedPlayers([]);
            }}
          >
            Clear Filters
          </button>
        </aside>

        {/* Available tables */}
        <section className='lobby-tables'>
          <div className='lobby-heading'>
            <h1>Available Tables</h1>
            <button type='button'>
              + Create Table
            </button>
          </div>

          <div className='table-list-wrapper'>
            <table className='table-list'>
              <thead>
                <tr>
                  <th>Table Name</th>
                  <th>Level</th>
                  <th>Players</th>
                  <th>Type</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>

              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={6} className='no-tables'>
                      Loading tables...
                    </td>
                  </tr>
                ) : error ? (
                  <tr>
                    <td colSpan={6} className='no-tables'>
                      {error}
                    </td>
                  </tr>
                ) : filteredTables.length === 0 ? (
                  <tr>
                    <td colSpan={6} className='no-tables'>
                      {tables.length === 0
                        ? 'No tables available yet.'
                        : 'No tables match your selected filters.'}
                    </td>
                  </tr>
                ) : (
                  filteredTables.map((table) => (
                    <tr key={table.id}>
                      <td>{table.name}</td>
                      <td>{table.level}</td>
                      <td>
                        {table.players}/{table.maxPlayers}
                      </td>
                      <td>{table.type}</td>
                      <td>
                        {table.status === 'Waiting' && table.isFull
                          ? 'Full'
                          : table.status}
                      </td>
                      <td>
                        <div className='table-actions'>
                          <button
                            type='button'
                            className='join-btn'
                            disabled={
                              table.status !== 'Waiting' ||
                              table.isFull
                            }
                          >
                            Join
                          </button>

                          <button
                            type='button'
                            className='observe-btn'
                          >
                            Observe
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* Right advertisement */}
        <aside className='lobby-ad'>
          <p>ADVERTISEMENT</p>
        </aside>
      </div>

      {/* Bottom advertisement */}
      <div className='lobby-bottom-ad'>
        ADVERTISEMENT
      </div>
    </main>
  );
}

export default Lobby;
