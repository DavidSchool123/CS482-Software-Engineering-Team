
import { useState } from 'react';
import './Lobby.css';

const sampleTables = [
  {
    id: 1,
    name: 'High Rollers',
    level: 'High',
    players: 4,
    maxPlayers: 6,
    type: 'Public',
    status: 'In Progress',
  },
  {
    id: 2,
    name: 'Ravens Table',
    level: 'Medium',
    players: 3,
    maxPlayers: 6,
    type: 'Private',
    status: 'Waiting',
  },
  {
    id: 3,
    name: 'Chill Game',
    level: 'Low',
    players: 2,
    maxPlayers: 6,
    type: 'Public',
    status: 'Waiting',
  },
  {
    id: 4,
    name: 'Study Break',
    level: 'Low',
    players: 6,
    maxPlayers: 6,
    type: 'Public',
    status: 'Full',
  },
];

function Lobby({ tableSearch }) {
  // Store the selected filter options
  const [selectedLevels, setSelectedLevels] = useState([]);
  const [selectedTypes, setSelectedTypes] = useState([]);
  const [selectedPlayers, setSelectedPlayers] = useState([]);

  // Add or remove a checkbox selection
  function toggleFilter(value, selected, setSelected) {
    if (selected.includes(value)) {
      setSelected(selected.filter((item) => item !== value));
    } else {
      setSelected([...selected, value]);
    }
  }

  // Filter the available tables based on selections
  const filteredTables = sampleTables.filter((table) => {
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

    return matchesSearch && matchesLevel && matchesType && matchesPlayers;
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
        </aside> {/* End of filter sidebar */}

        {/* Available tables */}
        <section className='lobby-tables'>
          <div className='lobby-heading'>
            <h1>Available Tables</h1>
            <button type='button'>+ Create Table</button>
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
                {filteredTables.map((table) => (
                  <tr key={table.id}>
                    <td>{table.name}</td>
                    <td>{table.level}</td>
                    <td>
                      {table.players}/{table.maxPlayers}
                    </td>
                    <td>{table.type}</td>
                    <td>{table.status}</td>
                    <td>
                      <div className='table-actions'>
                        <button
                          type='button'
                          className='join-btn'
                          disabled={table.status !== 'Waiting'}
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
                ))}

                {filteredTables.length === 0 && (
                  <tr>
                    <td colSpan={6} className='no-tables'>
                      No tables match your selected filters.
                    </td>
                  </tr>
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
