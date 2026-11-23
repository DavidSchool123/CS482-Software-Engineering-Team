import { useEffect, useRef, useState } from 'react';
import { EditProfile } from './Profile';
import './AdminDashboard.css';
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const navigationItems = [
  'Dashboard',
  'Registered Users',
  'Player Statistics',
  'Game Monitoring',
  'Ad Engagement',
  'Edit Profile',
];

const users = [];
const topPlayers = [];
const games = [];

const adPlacements = [
  'Lobby Right Sidebar',
  'Lobby Bottom Banner',
  'Game Page Sidebar',
  'Homepage Bottom Banner',
];

const metricDefinitions = [
  { icon: 'users', label: 'Registered Users' },
  {
    icon: 'cards',
    label: 'Active Players',
    note: '(Currently seated)',
  },
  {
    icon: 'chips',
    label: 'Games Played',
    note: '(All recorded hands)',
  },
  {
    icon: 'chart',
    label: 'New Sign Ups',
    note: '(Last 7 days)',
  },
];

function MetricIcon({ type }) {
  const props = {
    viewBox: '0 0 48 48',
    className: 'admin-metric-icon',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: '2.5',
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    'aria-hidden': 'true',
  };

  if (type === 'users') {
    return (
      <svg {...props}>
        <circle cx='18' cy='17' r='7' />
        <circle cx='32' cy='18' r='6' />
        <path d='M5 39c1-8 6-13 13-13s12 5 13 13M29 27c7-1 12 4 14 11' />
      </svg>
    );
  }

  if (type === 'cards') {
    return (
      <svg {...props}>
        <path d='M8 15h32v22H8zM15 15l4-7h10l4 7M14 23l5 5 5-5 5 5 5-5' />
      </svg>
    );
  }

  if (type === 'chips') {
    return (
      <svg {...props}>
        <ellipse cx='24' cy='12' rx='13' ry='6' />
        <path d='M11 12v8c0 3 6 6 13 6s13-3 13-6v-8M11 20v8c0 3 6 6 13 6s13-3 13-6v-8M11 28v8c0 3 6 6 13 6s13-3 13-6v-8' />
      </svg>
    );
  }

  return (
    <svg {...props}>
      <path d='M7 39V26h8v13M20 39V17h8v22M33 39V8h8v31M4 42h40' />
    </svg>
  );
}

function RegisteredUsersView({
  users: registeredUsers,
  search,
  onSearchChange,
  currentPage,
  onPageChange,
  onViewUser,
  onToggleBan,
  onToggleAdmin,
}) {
  const searchInputRef = useRef(null);
  const pageCount = Math.max(
    1,
    Math.ceil(registeredUsers.length / 10)
  );

  const pages =
    pageCount <= 5
      ? Array.from({ length: pageCount }, (_, i) => i + 1)
      : currentPage <= 3
        ? [1, 2, 3, 'ellipsis', pageCount]
        : currentPage >= pageCount - 2
          ? [
              1,
              'ellipsis',
              pageCount - 2,
              pageCount - 1,
              pageCount,
            ]
          : [
              1,
              'ellipsis',
              currentPage - 1,
              currentPage,
              currentPage + 1,
              'ellipsis',
              pageCount,
            ];

  const pageUsers = registeredUsers.slice(
    (currentPage - 1) * 10,
    currentPage * 10
  );

  return (
    <section
      className='admin-registered-users-view'
      aria-labelledby='registered-users-title'
    >
      <div className='admin-registered-users-heading'>
        <h1 id='registered-users-title'>Registered Users</h1>
        <div className='admin-user-search admin-user-search-large'>
          <button
            type='button'
            className='admin-search-icon-button'
            aria-label='Focus user search'
            onClick={() => searchInputRef.current?.focus()}
          >
            <span className='admin-search-icon' aria-hidden='true' />
          </button>
          <input
            ref={searchInputRef}
            type='search'
            aria-label='Search users'
            placeholder='Search users...'
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
          />
        </div>
      </div>

      <div className='admin-table-scroll'>
        <table className='admin-dashboard-table admin-registered-users-table'>
          <thead>
            <tr>
              <th>Username</th>
              <th>Email</th>
              <th>Join Date</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {pageUsers.map((user) => (
              <tr key={user.username}>
                <td>{user.username}</td>
                <td>{user.email}</td>
                <td>
                  {user.joined
                    ? new Date(user.joined).toLocaleDateString()
                    : '—'}
                </td>

                <td>
                  <span
                    className={`admin-status-dot status-${
                      user.isBanned ? 'inactive' : 'active'
                    }`}
                    aria-hidden='true'
                  />
                  {user.isBanned
                    ? 'Banned'
                    : user.isAdmin
                      ? 'Admin'
                      : 'Active'}
                </td>
                <td>
                  <button
                    type='button'
                    className='admin-view-button'
                    aria-label={`View ${user.username}`}
                    onClick={() => onViewUser?.(user)}
                  >
                    View
                  </button>

                  <button
                    type='button'
                    className='admin-view-button'
                    onClick={() => onToggleBan?.(user)}
                  >
                    {user.isBanned ? 'Unban' : 'Ban'}
                  </button>

                  <button
                    type='button'
                    className='admin-view-button'
                    onClick={() => onToggleAdmin?.(user)}
                  >
                    {user.isAdmin ? 'Remove Admin' : 'Make Admin'}
                  </button>
                </td>
              </tr>
            ))}
            {pageUsers.length === 0 && (
              <tr>
                <td colSpan='5' className='admin-empty-results'>
                  No users match that search.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <nav
        className='admin-pagination admin-registered-users-pagination'
        aria-label='Registered user pages'
      >
        <button
          type='button'
          aria-label='Previous page'
          disabled={currentPage === 1}
          onClick={() => onPageChange(Math.max(1, currentPage - 1))}
        >
          ‹
        </button>
        {pages.map((page, index) =>
          typeof page === 'number' ? (
            <button
              type='button'
              className={currentPage === page ? 'current-page' : ''}
              aria-current={currentPage === page ? 'page' : undefined}
              key={page}
              onClick={() => onPageChange(page)}
            >
              {page}
            </button>
          ) : (
            <span
              className='admin-pagination-ellipsis'
              aria-hidden='true'
              key={`${page}-${index}`}
            >
              …
            </span>
          ),
        )}
        <button
          type='button'
          aria-label='Next page'
          disabled={currentPage === 25}
          onClick={() => onPageChange(Math.min(25, currentPage + 1))}
        >
          ›
        </button>
      </nav>
    </section>
  );
}

function PlayerStatisticsView({
  group,
  onGroupChange,
  players = [],
}) {
  const selectedPlayers = players;
  return (
    <section
      className='admin-player-statistics-view'
      aria-labelledby='player-statistics-title'
    >
      <div className='admin-player-statistics-heading'>
        <h1 id='player-statistics-title'>Player Statistics</h1>
        <div className='admin-player-statistics-select-wrap'>
          <select
            className='admin-player-statistics-select'
            aria-label='Player statistics group'
            value={group}
            onChange={(event) => onGroupChange(event.target.value)}
          >
            <option>Top Players</option>
            <option>Most Games Played</option>
            <option>Highest Win Rate</option>
          </select>
          <span className='admin-player-statistics-arrow' aria-hidden='true' />
        </div>
      </div>

      <div className='admin-table-scroll'>
        <table className='admin-dashboard-table admin-player-statistics-table'>
          <thead>
            <tr>
              <th>Rank</th>
              <th>Username</th>
              <th>Games Won</th>
              <th>Win Rate</th>
            </tr>
          </thead>
          <tbody>
            {selectedPlayers.slice(0, 5).map((player, index) => (
              <tr key={player._id || player.rank || player.username}>
                <td>{index + 1}</td>
                <td>{player.username}</td>
                <td>{player.wins || 0}</td>
                <td>{Math.round((player.winRate || 0) * 100)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function GameMonitoringView({
  group,
  onGroupChange,
  games: allGames = [],
  onViewTable,
}) {
  const visibleGames = allGames.filter(
    (game) =>
      group === 'All Games' ||
      (
        group === 'Active Games'
          ? ['Waiting', 'In Progress'].includes(game.status)
          : game.status === 'Closed'
      )
  );
  return (
    <section
      className='admin-game-monitoring-view'
      aria-labelledby='game-monitoring-title'
    >
      <div className='admin-game-monitoring-heading'>
        <h1 id='game-monitoring-title'>Game Monitoring</h1>
        <div className='admin-player-statistics-select-wrap'>
          <select
            className='admin-player-statistics-select'
            aria-label='Game monitoring group'
            value={group}
            onChange={(event) => onGroupChange(event.target.value)}
          >
            <option>Active Games</option>
            <option>All Games</option>
            <option>Completed Games</option>
          </select>
          <span className='admin-player-statistics-arrow' aria-hidden='true' />
        </div>
      </div>

      <div className='admin-table-scroll'>
        <table className='admin-dashboard-table admin-game-monitoring-table'>
          <thead>
            <tr>
              <th>Table ID</th>
              <th>Players</th>
              <th>Status</th>
              <th>Table Created</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {visibleGames.map((game) => (
              <tr key={game._id}>
                <td>{game.name || game._id}</td>

                <td>
                  {game.players}/{game.capacity} (+{game.bots} bots)
                </td>

                <td>
                  <span
                    className={`admin-status-dot status-${game.status
                      .toLowerCase()
                      .replace(' ', '-')}`}
                    aria-hidden='true'
                  />
                  {game.status}
                </td>

                <td>
                  {game.createdAt
                    ? new Date(game.createdAt).toLocaleString()
                    : '—'}
                </td>

                <td>
                  <button
                    type='button'
                    className='admin-view-button'
                    aria-label={`Observe table ${game.name || game._id}`}
                    onClick={() => onViewTable?.(game)}
                  >
                    View
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function AdEngagementView({ period, onPeriodChange }) {
  const [advertisements, setAdvertisements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editingAdId, setEditingAdId] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [draft, setDraft] = useState({
    title: '',
    placement: '',
    imageUrl: '',
    destinationUrl: '',
    status: 'Active',
  });

  async function fetchAdvertisements() {
    try {
      setLoading(true);

      const response = await fetch(
        `${API_URL}/api/advertisements`,
        {
          credentials: 'include',
        },
      );

      if (!response.ok) {
        throw new Error('Failed to retrieve advertisements.');
      }

      const data = await response.json();

      setAdvertisements(
        data.map((ad) => ({
          ...ad,
          id: ad._id,
          title: ad.name,
          status: ad.status === 'active' ? 'Active' : 'Inactive',
        })),
      );

      setError('');
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchAdvertisements();
  }, []);

  function openCreateForm() {
    setEditingAdId(null);
    setDraft({
      title: '',
      placement: '',
      imageUrl: '',
      destinationUrl: '',
      status: 'Active',
    });
    setFormOpen(true);
  }

  function openEditForm(ad) {
    setEditingAdId(ad.id);
    setDraft({
      title: ad.title,
      placement: ad.placement,
      imageUrl: ad.imageUrl || '',
      destinationUrl: ad.destinationUrl || '',
      status: ad.status,
    });
    setFormOpen(true);
  }

  async function saveAdvertisement(event) {
    event.preventDefault();

    try {
      const advertisementData = {
        name: draft.title.trim(),
        placement: draft.placement,
        imageUrl: draft.imageUrl,
        destinationUrl: draft.destinationUrl,
        status: draft.status.toLowerCase(),
      };

      const url = editingAdId
        ? `${API_URL}/api/advertisements${editingAdId}`
        : `${API_URL}/api/advertisements`;

      const response = await fetch(url, {
        method: editingAdId ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(advertisementData),
      });

      if (!response.ok) {
        throw new Error('Failed to save advertisement.');
      }

      // Refresh advertisements from the database
      await fetchAdvertisements();

      setFormOpen(false);
      setEditingAdId(null);
    } catch (error) {
      setError(error.message);
    }
  }

  return (
    <section
      className='admin-ad-engagement-view'
      aria-labelledby='ad-engagement-title'
    >
      <div className='admin-ad-engagement-heading'>
        <h1 id='ad-engagement-title'>Ad Engagement</h1>
        <div className='admin-player-statistics-select-wrap'>
          <select
            className='admin-player-statistics-select'
            aria-label='Ad engagement period'
            value={period}
            onChange={(event) => onPeriodChange(event.target.value)}
          >
            <option>Last 7 Days</option>
            <option>Last 30 Days</option>
            <option>Last 90 Days</option>
          </select>
          <span className='admin-player-statistics-arrow' aria-hidden='true' />
        </div>
      </div>

      <div className='admin-ad-engagement-frame'>
        <div
          className='admin-ad-engagement-chart'
          aria-label='Impressions 152, clicks 87, conversions 28'
        >
          <div className='admin-ad-engagement-chart-grid'>
            <span>200</span>
            <span>150</span>
            <span>100</span>
            <span>50</span>
            <span>0</span>
            <div className='admin-ad-engagement-bars'>
              <div className='admin-ad-engagement-bar impressions'>
                <span>Impressions</span>
              </div>
              <div className='admin-ad-engagement-bar clicks'>
                <span>Clicks</span>
              </div>
              <div className='admin-ad-engagement-bar conversions'>
                <span>Conversions</span>
              </div>
            </div>
          </div>
        </div>

        <dl className='admin-ad-engagement-stats'>
          <div>
            <dt>Impressions</dt>
            <dd>152</dd>
          </div>
          <div>
            <dt>Clicks</dt>
            <dd>87</dd>
          </div>
          <div>
            <dt>Conversions</dt>
            <dd>28</dd>
          </div>
        </dl>
      </div>

      <section
        className='admin-ad-management'
        aria-labelledby='ad-management-title'
      >
        <header className='admin-ad-management-heading'>
          <div>
            <h2 id='ad-management-title'>Ad Management</h2>
            <p>
              Manage your website&apos;s advertisements and available
              placements.
            </p>
          </div>
          <span className='admin-ad-management-role'>Admin</span>
        </header>

        <div className='admin-ad-management-summary'>
          <article className='admin-ad-management-stat'>
            <strong>{advertisements.length}</strong>
            <span>Total Ads</span>
          </article>
          <article className='admin-ad-management-stat'>
            <strong>
              {advertisements.filter((ad) => ad.status === 'Active').length}
            </strong>
            <span>Active Ads</span>
          </article>
          <article className='admin-ad-management-stat'>
            <strong>{adPlacements.length}</strong>
            <span>Placements</span>
          </article>
        </div>

        {loading && <p>Loading advertisements...</p>}

        {error && <p className='admin-error-message'>{error}</p>}
        
        <div className='admin-ad-list-heading'>
          <div>
            <h3>Advertisements</h3>
            <p>All advertisements assigned to placements</p>
          </div>
          <span className='admin-ad-active-count'>
            {advertisements.filter((ad) => ad.status === 'Active').length}{' '}
            Active
          </span>
        </div>

        <div className='admin-advertisement-list'>
          {advertisements.map((ad) => (
            <article className='admin-advertisement-card' key={ad.id}>
              <div>
                <h4>{ad.title}</h4>
                <p>Placement: {ad.placement}</p>
              </div>
              <div className='admin-advertisement-card-actions'>
                <span
                  className={`admin-ad-status ${
                    ad.status === 'Active' ? 'active' : 'inactive'
                  }`}
                >
                  {ad.status}
                </span>
                <div>
                  <button
                    type='button'
                    onClick={() => openEditForm(ad)}
                    aria-label={`Edit ${ad.title}`}
                  >
                    Edit
                  </button>
                  <span aria-hidden='true'>·</span>
                  <button
                    type='button'
                    onClick={async () => {
                      try {
                        const response = await fetch(
                          `${API_URL}/api/advertisements/${ad.id}`,
                          {
                            method: 'DELETE',
                            credentials: 'include',
                          },
                        );

                        if (!response.ok) {
                          throw new Error('Failed to delete advertisement.');
                        }

                        await fetchAdvertisements();
                      } catch (error) {
                        setError(error.message);
                      }
                    }}
                    aria-label={`Delete ${ad.title}`}
                  >
                    Delete
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>

        <button
          type='button'
          className='admin-ad-create-button'
          onClick={openCreateForm}
        >
          <span aria-hidden='true'>+</span> Create Advertisement
        </button>
      </section>

      {formOpen && (
        <div
          className='admin-ad-form-backdrop'
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setFormOpen(false);
            }
          }}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              setFormOpen(false);
            }
          }}
        >
          <section
            className='admin-ad-form-dialog'
            role='dialog'
            aria-modal='true'
            aria-labelledby='admin-ad-form-title'
          >
            <header className='admin-ad-form-header'>
              <div>
                <h2 id='admin-ad-form-title'>
                  {editingAdId === null
                    ? 'Create Advertisement'
                    : 'Edit Advertisement'}
                </h2>
                <p>Add an advertisement to an existing website placement.</p>
              </div>
              <button
                type='button'
                className='admin-ad-form-close'
                aria-label='Close advertisement form'
                onClick={() => setFormOpen(false)}
              >
                ×
              </button>
            </header>

            <form className='admin-ad-form' onSubmit={saveAdvertisement}>
              <label>
                Advertisement Name
                <input
                  type='text'
                  placeholder='e.g. Weekly Poker Tournament'
                  value={draft.title}
                  autoFocus
                  onChange={(event) =>
                    setDraft((currentDraft) => ({
                      ...currentDraft,
                      title: event.target.value,
                    }))
                  }
                  required
                />
              </label>
              <label>
                Placement
                <select
                  value={draft.placement}
                  onChange={(event) =>
                    setDraft((currentDraft) => ({
                      ...currentDraft,
                      placement: event.target.value,
                    }))
                  }
                  required
                >
                  <option value=''>Select a placement</option>
                  {adPlacements.map((placement) => (
                    <option key={placement}>{placement}</option>
                  ))}
                </select>
              </label>
              <label>
                Image URL
                <input
                  type='url'
                  placeholder='https://example.com/ad-image.png'
                  value={draft.imageUrl}
                  onChange={(event) =>
                    setDraft((currentDraft) => ({
                      ...currentDraft,
                      imageUrl: event.target.value,
                    }))
                  }
                />
              </label>
              <label>
                Destination URL
                <input
                  type='url'
                  placeholder='https://example.com'
                  value={draft.destinationUrl}
                  onChange={(event) =>
                    setDraft((currentDraft) => ({
                      ...currentDraft,
                      destinationUrl: event.target.value,
                    }))
                  }
                />
              </label>
              <fieldset className='admin-ad-status-fieldset'>
                <legend>Status</legend>
                <div className='admin-ad-status-options'>
                  {['Active', 'Inactive'].map((status) => (
                    <label key={status}>
                      <input
                        type='radio'
                        name='advertisement-status'
                        value={status}
                        checked={draft.status === status}
                        onChange={(event) =>
                          setDraft((currentDraft) => ({
                            ...currentDraft,
                            status: event.target.value,
                          }))
                        }
                      />
                      {status}
                    </label>
                  ))}
                </div>
              </fieldset>
              <button type='submit' className='admin-ad-primary-button'>
                {editingAdId === null ? 'Create Advertisement' : 'Save Changes'}
              </button>
            </form>
          </section>
        </div>
      )}
    </section>
  );
}

function PlayerDetailsModal({ user, onClose }) {
  if (!user) return null;

  const stats = [
    {
      label: 'Games Won',
      value: user.wins || 0,
    },
    {
      label: 'Games Lost',
      value: user.losses || 0,
    },
    {
      label: 'Games Played',
      value: user.gamesPlayed || 0,
    },
    {
      label: 'Win Rate',
      value: `${((user.winRate || 0) * 100).toFixed(1)}%`,
    },
    {
      label: 'Total Chips Won',
      value: (user.totalChipsWon || 0).toLocaleString(),
    },
    {
      label: 'Net Winnings',
      value: `${(user.netWinnings || 0) > 0 ? '+' : ''}${(user.netWinnings || 0).toLocaleString()}`,
    },
  ];

  return (
    <div
      className='admin-modal-overlay'
      onClick={onClose}
    >
      <section
        className='admin-player-modal'
        role='dialog'
        aria-modal='true'
        aria-labelledby='admin-player-modal-title'
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type='button'
          className='admin-modal-close'
          onClick={onClose}
          aria-label='Close player details'
        >
          ×
        </button>

        <header className='admin-player-modal-header'>
          <h2 id='admin-player-modal-title'>
            {user.username}
          </h2>

          <p>{user.email || 'No email available'}</p>

          <div className='admin-player-modal-badges'>
            <span>
              {user.isAdmin ? 'Administrator' : 'Player'}
            </span>

            <span className={user.isBanned ? 'banned' : 'active'}>
              {user.isBanned ? 'Banned' : 'Active'}
            </span>
          </div>
        </header>

        <div className='admin-player-modal-stats'>
          {stats.map((stat) => (
            <article
              className='admin-player-stat-card'
              key={stat.label}
            >
              <strong>{stat.value}</strong>
              <span>{stat.label}</span>
            </article>
          ))}
        </div>

        <footer className='admin-player-modal-footer'>
          <button
            type='button'
            className='admin-view-button'
            onClick={onClose}
          >
            Close
          </button>
        </footer>
      </section>
    </div>
  );
}

function AdminTableModal({ data, onClose }) {
  if (!data) return null;

  const { table, game } = data;

  return (
    <div
      className='admin-modal-overlay'
      onClick={onClose}
    >
      <section
        className='admin-table-modal'
        role='dialog'
        aria-modal='true'
        aria-labelledby='admin-table-modal-title'
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type='button'
          className='admin-modal-close'
          onClick={onClose}
          aria-label='Close table observation'
        >
          ×
        </button>

        <header className='admin-table-modal-header'>
          <h2 id='admin-table-modal-title'>
            {table.name}
          </h2>

          <div className='admin-player-modal-badges'>
            <span>
              {table.isPublic ? 'Public Table' : 'Private Table'}
            </span>

            <span>{table.status}</span>
          </div>

          <p>
            Table ID: {table._id}
          </p>
        </header>

        <section className='admin-table-overview-grid'>
          <article className='admin-table-overview-card'>
            <strong>
              {table.players.length}/{table.capacity}
            </strong>
            <span>Players</span>
          </article>

          <article className='admin-table-overview-card'>
            <strong>{table.botCount}</strong>
            <span>Bots</span>
          </article>

          <article className='admin-table-overview-card'>
            <strong>{table.level}</strong>
            <span>Table Level</span>
          </article>

          <article className='admin-table-overview-card'>
            <strong>{game?.pot?.toLocaleString() ?? 0}</strong>
            <span>Current Pot</span>
          </article>
        </section>

        {game && (
          <section className='admin-table-game-details'>
            <h3>Current Game</h3>

            <div className='admin-table-game-grid'>
              <div>
                <span>Status</span>
                <strong>{game.status}</strong>
              </div>

              <div>
                <span>Street</span>
                <strong>{game.street}</strong>
              </div>

              <div>
                <span>Ante</span>
                <strong>{game.ante}</strong>
              </div>

              <div>
                <span>Bring In</span>
                <strong>{game.bringIn}</strong>
              </div>

              <div>
                <span>Current Bet</span>
                <strong>{game.currentBet}</strong>
              </div>

              <div>
                <span>Current Turn</span>
                <strong>
                  {game.currentTurnUsername || '—'}
                </strong>
              </div>
            </div>
          </section>
        )}

        <section className='admin-table-players-section'>
          <h3>Players at Table</h3>

          {table.players.length === 0 ? (
            <p>No players are currently seated.</p>
          ) : (
            <div className='admin-table-players-list'>
              {table.players.map((player) => (
                <article
                  className='admin-observed-player'
                  key={player.playerId}
                >
                  <header>
                    <div>
                      <strong>{player.username}</strong>

                      {player.hasFolded && (
                        <span className='admin-player-folded'>
                          Folded
                        </span>
                      )}
                    </div>

                    <span className='admin-player-stack'>
                      {player.chips.toLocaleString()} chips
                    </span>
                  </header>

                  <div className='admin-observed-player-details'>
                    <span>
                      Total contribution: {player.totalContribution}
                    </span>

                    <span>
                      Current round: {player.roundContribution}
                    </span>
                  </div>

                  {player.cards?.length > 0 && (
                    <div className='admin-observed-cards'>
                      <strong>Cards</strong>

                      <div className='admin-observed-card-list'>
                        {player.cards.map((card, index) => (
                          <span
                            className='admin-observed-card'
                            key={`${card.rank}-${card.suit}-${index}`}
                          >
                            {card.rank} {card.suit}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </article>
              ))}
            </div>
          )}
        </section>

        <footer className='admin-player-modal-footer'>
          <button
            type='button'
            className='admin-view-button'
            onClick={onClose}
          >
            Close Observation
          </button>
        </footer>
      </section>
    </div>
  );
}

function AdminDashboard() {
  const [activeSection, setActiveSection] = useState('Dashboard');
  const [userSearch, setUserSearch] = useState('');
  const [usersPage, setUsersPage] = useState(1);
  const [playerGroup, setPlayerGroup] = useState('Top Players');
  const [gameGroup, setGameGroup] = useState('Active Games');
  const [engagementPeriod, setEngagementPeriod] = useState('Last 7 Days');
  const [dashboardData, setDashboardData] = useState(null);
  const [dashboardError, setDashboardError] = useState('');
  const [selectedUser, setSelectedUser] = useState(null);
  const [selectedTable, setSelectedTable] = useState(null);
  const [tableLoading, setTableLoading] = useState(false);

  const currentUsers = dashboardData?.users || [];


  const filteredUsers = currentUsers.filter((user) =>
    `${user.username} ${user.email}`
      .toLowerCase()
      .includes(userSearch.trim().toLowerCase()),
  );

  useEffect(() => {
    let cancelled = false;

    fetch(`${API_URL}/api/admin/dashboard`, {
      credentials: 'include',
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error(
            response.status === 403
              ? 'Admin access required.'
              : 'Failed to load dashboard data.'
          );
        }

        return response.json();
      })
      .then((data) => {
        if (!cancelled) {
          setDashboardData(data);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setDashboardError(error.message);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);


  async function updateAdminUser(user, changes) {
    try {
      const response = await fetch(
        `${API_URL}/api/admin/users/${user._id}`,
        {
          method: 'PATCH',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(changes),
        }
      );

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));

        throw new Error(
          payload.message || 'User update failed.'
        );
      }

      const updated = await response.json();

      setDashboardData((old) => ({
        ...old,
        users: old.users.map((item) =>
          item._id === updated._id
            ? { ...item, ...updated }
            : item
        ),
      }));
    } catch (error) {
      setDashboardError(error.message);
    }
  }

  async function viewUser(user) {
    setDashboardError('');

    try {
      const response = await fetch(
        `${API_URL}/api/admin/users/${user._id}`,
        {
          credentials: 'include',
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || 'Unable to load player profile.'
        );
      }

      const stats = data.stats || {};
      const gamesPlayed = stats.gamesPlayed || 0;
      const wins = stats.wins || 0;

      setSelectedUser({
        ...user,
        ...data,
        wins,
        losses: stats.losses || 0,
        gamesPlayed,
        winRate: gamesPlayed ? wins / gamesPlayed : 0,
        totalChipsWon: stats.totalChipsWon || 0,
        netWinnings: stats.netWinnings || 0,
      });
    } catch (error) {
      setDashboardError(error.message);
    }
  }

  async function viewTable(game) {
    setTableLoading(true);
    setDashboardError('');

    try {
      const response = await fetch(
        `${API_URL}/api/admin/tables/${game._id}`,
        {
          credentials: 'include',
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || 'Unable to load table observation.'
        );
      }

      setSelectedTable(data);
    } catch (error) {
      setDashboardError(error.message);
    } finally {
      setTableLoading(false);
    }
  }

  const toggleBan = (user) =>
    updateAdminUser(user, {
      isBanned: !user.isBanned,
    });

  const toggleAdmin = (user) =>
    updateAdminUser(user, {
      isAdmin: !user.isAdmin,
    });

  const metrics = dashboardData
    ? [
        {
          icon: 'users',
          value: dashboardData.metrics.registeredUsers.toLocaleString(),
          label: 'Registered Users',
        },
        {
          icon: 'cards',
          value: dashboardData.metrics.activePlayers.toLocaleString(),
          label: 'Active Players',
          note: '(Currently seated)',
        },
        {
          icon: 'chips',
          value: dashboardData.metrics.gamesPlayed.toLocaleString(),
          label: 'Games Played',
          note: '(All recorded hands)',
        },
        {
          icon: 'chart',
          value: dashboardData.metrics.newSignups.toLocaleString(),
          label: 'New Sign Ups',
          note: '(Last 7 days)',
        },
      ]
    : metricDefinitions.map((item) => ({
        ...item,
        value: '—',
      }));

  const selectedPlayers =
    dashboardData?.playerStatistics?.[
      playerGroup === 'Most Games Played'
        ? 'mostGamesPlayed'
        : playerGroup === 'Highest Win Rate'
          ? 'highestWinRate'
          : 'topPlayers'
    ] || [];

  const visibleGames = (
    dashboardData?.games || []
  ).filter(
    (game) =>
      gameGroup === 'All Games' ||
      (
        gameGroup === 'Active Games'
          ? ['Waiting', 'In Progress'].includes(game.status)
          : game.status === 'Closed'
      )
  );



  return (
    <div className='admin-dashboard-page'>
      <aside className='admin-dashboard-sidebar'>
        <nav aria-label='Admin dashboard sections'>
          {navigationItems.map((item) => (
            <button
              key={item}
              type='button'
              className={`admin-dashboard-nav-item ${
                activeSection === item ? 'active' : ''
              }`}
              aria-current={activeSection === item ? 'page' : undefined}
              onClick={() => setActiveSection(item)}
            >
              {item}
            </button>
          ))}
        </nav>
      </aside>

      <main className='admin-dashboard-content'>
        {dashboardError && (
          <p role='alert' className='admin-error-message'>
            {dashboardError}
          </p>
        )}

        {activeSection === 'Edit Profile' && (
          <EditProfile embedded pathnameOverride='/profile/edit' />
        )}

        {activeSection === 'Registered Users' && (
          <RegisteredUsersView
            users={filteredUsers}
            search={userSearch}
            onSearchChange={(search) => {
              setUserSearch(search);
              setUsersPage(1);
            }}
            currentPage={usersPage}
            onPageChange={setUsersPage}
            onViewUser={viewUser}
            onToggleBan={toggleBan}
            onToggleAdmin={toggleAdmin}
          />
        )}

        {activeSection === 'Player Statistics' && (
          <PlayerStatisticsView
            group={playerGroup}
            onGroupChange={setPlayerGroup}
            players={selectedPlayers}
          />
        )}

        {activeSection === 'Game Monitoring' && (
          <GameMonitoringView
            group={gameGroup}
            onGroupChange={setGameGroup}
            games={dashboardData?.games || []}
            onViewTable={viewTable}
          />
        )}

        {activeSection === 'Ad Engagement' && (
          <AdEngagementView
            period={engagementPeriod}
            onPeriodChange={setEngagementPeriod}
          />
        )}

        <div
          className='admin-dashboard-view'
          hidden={
            activeSection === 'Edit Profile' ||
            activeSection === 'Registered Users' ||
            activeSection === 'Player Statistics' ||
            activeSection === 'Game Monitoring' ||
            activeSection === 'Ad Engagement'
          }
        >
          <header className='admin-dashboard-heading'>
            <h1>Admin Dashboard</h1>
            <p>
              Overview of users, game activity, and advertising performance.
            </p>
          </header>

          <section
            className='admin-metrics-grid'
            aria-label='Dashboard overview'
          >
            {metrics.map((metric) => (
              <article className='admin-metric-card' key={metric.label}>
                <MetricIcon type={metric.icon} />
                <div>
                  <strong>{metric.value}</strong>
                  <span>{metric.label}</span>
                  {metric.note && <small>{metric.note}</small>}
                </div>
              </article>
            ))}
          </section>

          <div className='admin-dashboard-panels'>
            <section className='admin-dashboard-panel'>
              <div className='admin-panel-heading'>
                <h2>Registered Users</h2>
                <label className='admin-user-search'>
                  <span className='admin-search-icon' aria-hidden='true' />
                  <span className='visually-hidden'>Search users</span>
                  <input
                    type='search'
                    placeholder='Search users...'
                    value={userSearch}
                    onChange={(event) => setUserSearch(event.target.value)}
                  />
                </label>
              </div>
              <div className='admin-table-scroll'>
                <table className='admin-dashboard-table'>
                  <thead>
                    <tr>
                      <th>Username</th>
                      <th>Email</th>
                      <th>Join Date</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.slice(0, 5).map((user) => (
                      <tr key={user.username}>
                        <td>{user.username}</td>
                        <td>{user.email}</td>
                        <td>
                          {user.joined
                            ? new Date(user.joined).toLocaleDateString()
                            : '—'}
                        </td>
                        <td>
                          <span
                            className={`admin-status-dot status-${
                              user.isBanned ? 'inactive' : 'active'
                            }`}
                            aria-hidden='true'
                          />

                          {user.isBanned
                            ? 'Banned'
                            : user.isAdmin
                              ? 'Admin'
                              : 'Active'}
                          {user.status}
                        </td>
                        <td>
                          <button
                            type='button'
                            className='admin-view-button'
                            onClick={() => viewUser(user)}
                          >
                            View
                          </button>

                          <button
                            type='button'
                            className='admin-view-button'
                            onClick={() => toggleBan(user)}
                          >
                            {user.isBanned ? 'Unban' : 'Ban'}
                          </button>

                          <button
                            type='button'
                            className='admin-view-button'
                            onClick={() => toggleAdmin(user)}
                          >
                            {user.isAdmin ? 'Remove Admin' : 'Make Admin'}
                          </button>
                        </td>
                      </tr>
                    ))}
                    {filteredUsers.length === 0 && (
                      <tr>
                        <td colSpan='5' className='admin-empty-results'>
                          No users match that search.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              <div className='admin-pagination' aria-label='User pages'>
                <button type='button' aria-label='Previous page' disabled>
                  ‹
                </button>
                <button
                  type='button'
                  className='current-page'
                  aria-current='page'
                >
                  1
                </button>
                <button type='button'>2</button>
                <button type='button'>3</button>
                <span>…</span>
                <button type='button'>25</button>
                <button type='button' aria-label='Next page'>
                  ›
                </button>
              </div>
            </section>

            <section className='admin-dashboard-panel'>
              <div className='admin-panel-heading'>
                <h2>Player Statistics</h2>
                <select
                  aria-label='Player statistics group'
                  value={playerGroup}
                  onChange={(event) => setPlayerGroup(event.target.value)}
                >
                  <option>Top Players</option>
                  <option>Most Games Played</option>
                  <option>Highest Win Rate</option>
                </select>
              </div>
              <div className='admin-table-scroll'>
                <table className='admin-dashboard-table admin-player-table'>
                  <thead>
                    <tr>
                      <th>Rank</th>
                      <th>Username</th>
                      <th>Games Won</th>
                      <th>Win Rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedPlayers.slice(0, 5).map((player, index) => (
                      <tr key={player._id || player.username}>
                        <td>{index + 1}</td>
                        <td>{player.username}</td>
                        <td>{player.wins || 0}</td>
                        <td>{Math.round((player.winRate || 0) * 100)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className='admin-dashboard-panel'>
              <div className='admin-panel-heading'>
                <h2>Game Monitoring</h2>
                <select
                  aria-label='Game monitoring group'
                  value={gameGroup}
                  onChange={(event) => setGameGroup(event.target.value)}
                >
                  <option>Active Games</option>
                  <option>All Games</option>
                  <option>Completed Games</option>
                </select>
              </div>
              <div className='admin-table-scroll'>
                <table className='admin-dashboard-table'>
                  <thead>
                    <tr>
                      <th>Table ID</th>
                      <th>Players</th>
                      <th>Status</th>
                      <th>Table Created</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleGames.map((game) => (
                      <tr key={game._id}>
                        <td>{game.name || game._id}</td>

                        <td>
                          {game.players}/{game.capacity} (+{game.bots} bots)
                        </td>

                        <td>
                          <span
                            className={`admin-status-dot status-${game.status
                              .toLowerCase()
                              .replace(' ', '-')}`}
                            aria-hidden='true'
                          />
                          {game.status}
                        </td>

                        <td>
                          {game.createdAt
                            ? new Date(game.createdAt).toLocaleString()
                            : '—'}
                        </td>

                        <td>
                          <button
                            type='button'
                            className='admin-view-button'
                            aria-label={`Observe table ${game.name || game._id}`}
                            onClick={() => viewTable(game)}
                          >
                            View
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className='admin-dashboard-panel admin-engagement-panel'>
              <div className='admin-panel-heading'>
                <h2>Ad Engagement</h2>
                <select
                  aria-label='Ad engagement period'
                  value={engagementPeriod}
                  onChange={(event) => setEngagementPeriod(event.target.value)}
                >
                  <option>Last 7 Days</option>
                  <option>Last 30 Days</option>
                  <option>Last 90 Days</option>
                </select>
              </div>
              <div className='admin-engagement-content'>
                <div
                  className='admin-chart'
                  aria-label='Impressions 152, clicks 87, conversions 28'
                >
                  <div className='admin-chart-grid'>
                    <span>200</span>
                    <span>150</span>
                    <span>100</span>
                    <span>50</span>
                    <span>0</span>
                    <div className='admin-chart-bars'>
                      <div className='admin-chart-bar bar-impressions'>
                        <span>Impressions</span>
                      </div>
                      <div className='admin-chart-bar bar-clicks'>
                        <span>Clicks</span>
                      </div>
                      <div className='admin-chart-bar bar-conversions'>
                        <span>Conversions</span>
                      </div>
                    </div>
                  </div>
                </div>
                <dl className='admin-engagement-stats'>
                  <div>
                    <dt>Impressions</dt>
                    <dd>152</dd>
                  </div>
                  <div>
                    <dt>Clicks</dt>
                    <dd>87</dd>
                  </div>
                  <div>
                    <dt>Conversions</dt>
                    <dd>28</dd>
                  </div>
                </dl>
              </div>
            </section>
          </div>
        </div>
      </main>

    {tableLoading && (
      <div className='admin-modal-overlay'>
        <section className='admin-table-modal' role='status'>
          <p>Loading table observation...</p>
        </section>
      </div>
    )}

    {selectedTable && (
      <AdminTableModal
        data={selectedTable}
        onClose={() => setSelectedTable(null)}
      />
    )}

    {selectedUser && (
      <PlayerDetailsModal
        user={selectedUser}
        onClose={() => setSelectedUser(null)}
      />
    )}

    </div>
  );
}

export default AdminDashboard;
