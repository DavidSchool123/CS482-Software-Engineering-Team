import { useRef, useState } from 'react';
import { EditProfile } from './Profile';
import './AdminDashboard.css';

const navigationItems = [
  'Dashboard',
  'Registered Users',
  'Player Statistics',
  'Game Monitoring',
  'Ad Engagement',
  'Edit Profile',
];

const users = [
  { username: 'Player1', email: 'player1@email.com', joined: 'Oct 1, 2026', status: 'Active' },
  { username: 'Player2', email: 'player2@email.com', joined: 'Sep 28, 2026', status: 'Active' },
  { username: 'Player3', email: 'player3@email.com', joined: 'Sep 25, 2026', status: 'Active' },
  { username: 'Player4', email: 'player4@email.com', joined: 'Sep 20, 2026', status: 'Inactive' },
  { username: 'Bot1', email: 'bot1@pokerface.com', joined: 'Aug 15, 2026', status: 'Bot' },
];

const topPlayers = [
  { rank: 1, username: 'PokerQueen', wins: 125, rate: '62%' },
  { rank: 2, username: 'AceKing', wins: 110, rate: '58%' },
  { rank: 3, username: 'StudMaster', wins: 98, rate: '55%' },
  { rank: 4, username: 'Player3', wins: 87, rate: '52%' },
  { rank: 5, username: 'CardPro', wins: 76, rate: '50%' },
];

const games = [
  { id: '#1023', players: '4/6', status: 'In Progress', time: '2:15 PM' },
  { id: '#1022', players: '6/6', status: 'In Progress', time: '2:10 PM' },
  { id: '#1021', players: '2/6', status: 'Waiting', time: '2:05 PM' },
  { id: '#1020', players: '5/6', status: 'In Progress', time: '1:58 PM' },
  { id: '#1019', players: '6/6', status: 'Completed', time: '1:45 PM' },
];

const initialAdvertisements = [
  {
    id: 1,
    title: 'Poker Tournament',
    placement: 'Lobby Banner',
    imageUrl: 'https://example.com/poker-tournament.png',
    destinationUrl: 'https://example.com/tournament',
    status: 'Active',
  },
  {
    id: 2,
    title: 'Weekly Rewards',
    placement: 'Game Page Sidebar',
    imageUrl: 'https://example.com/weekly-rewards.png',
    destinationUrl: 'https://example.com/rewards',
    status: 'Active',
  },
  {
    id: 3,
    title: 'New Player Bonus',
    placement: 'Homepage Banner',
    imageUrl: 'https://example.com/player-bonus.png',
    destinationUrl: 'https://example.com/register',
    status: 'Inactive',
  },
  {
    id: 4,
    title: 'Summer Poker Event',
    placement: 'Lobby Banner',
    imageUrl: 'https://example.com/summer-event.png',
    destinationUrl: 'https://example.com/events',
    status: 'Active',
  },
];

const adPlacements = [
  'Lobby Banner',
  'Game Page Sidebar',
  'Homepage Banner',
  'Profile Sidebar',
  'Tournament Lobby',
];

const metrics = [
  { icon: 'users', value: '1,248', label: 'Registered Users' },
  { icon: 'cards', value: '312', label: 'Active Players', note: '(Last 24 hours)' },
  { icon: 'chips', value: '5,630', label: 'Games Played', note: '(Last 24 hours)' },
  { icon: 'chart', value: '87', label: 'New Sign Ups', note: '(Last 7 days)' },
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
}) {
  const searchInputRef = useRef(null);
  const pages =
    currentPage <= 3
      ? [1, 2, 3, 'ellipsis', 25]
      : currentPage >= 23
        ? [1, 'ellipsis', 23, 24, 25]
        : [
            1,
            'ellipsis',
            currentPage - 1,
            currentPage,
            currentPage + 1,
            'ellipsis',
            25,
          ];

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
            {registeredUsers.map((user) => (
              <tr key={user.username}>
                <td>{user.username}</td>
                <td>{user.email}</td>
                <td>{user.joined}</td>
                <td>
                  <span
                    className={`admin-status-dot status-${user.status.toLowerCase()}`}
                    aria-hidden='true'
                  />
                  {user.status}
                </td>
                <td>
                  <button
                    type='button'
                    className='admin-view-button'
                    aria-label={`View ${user.username}`}
                  >
                    View
                  </button>
                </td>
              </tr>
            ))}
            {registeredUsers.length === 0 && (
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

function PlayerStatisticsView({ group, onGroupChange }) {
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
          <span
            className='admin-player-statistics-arrow'
            aria-hidden='true'
          />
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
            {topPlayers.map((player) => (
              <tr key={player.rank}>
                <td>{player.rank}</td>
                <td>{player.username}</td>
                <td>{player.wins}</td>
                <td>{player.rate}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function GameMonitoringView({ group, onGroupChange }) {
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
          <span
            className='admin-player-statistics-arrow'
            aria-hidden='true'
          />
        </div>
      </div>

      <div className='admin-table-scroll'>
        <table className='admin-dashboard-table admin-game-monitoring-table'>
          <thead>
            <tr>
              <th>Table ID</th>
              <th>Players</th>
              <th>Status</th>
              <th>Start Time</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {games.map((game) => (
              <tr key={game.id}>
                <td>{game.id}</td>
                <td>{game.players}</td>
                <td>
                  <span
                    className={`admin-status-dot status-${game.status
                      .toLowerCase()
                      .replace(' ', '-')}`}
                    aria-hidden='true'
                  />
                  {game.status}
                </td>
                <td>{game.time}</td>
                <td>
                  <button
                    type='button'
                    className='admin-view-button'
                    aria-label={`View game ${game.id}`}
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
  const [advertisements, setAdvertisements] = useState(initialAdvertisements);
  const [editingAdId, setEditingAdId] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [draft, setDraft] = useState({
    title: '',
    placement: '',
    imageUrl: '',
    destinationUrl: '',
    status: 'Active',
  });

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

  function saveAdvertisement(event) {
    event.preventDefault();
    const updatedAd = { ...draft, title: draft.title.trim() };

    if (editingAdId !== null) {
      setAdvertisements((currentAds) =>
        currentAds.map((ad) =>
          ad.id === editingAdId ? { ...ad, ...updatedAd } : ad,
        ),
      );
    } else {
      setAdvertisements((currentAds) => [
        ...currentAds,
        { id: Date.now(), ...updatedAd },
      ]);
    }

    setFormOpen(false);
    setEditingAdId(null);
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
          <span
            className='admin-player-statistics-arrow'
            aria-hidden='true'
          />
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
            <p>Manage your website&apos;s advertisements and available placements.</p>
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

        <div className='admin-ad-list-heading'>
          <div>
            <h3>Advertisements</h3>
            <p>All advertisements assigned to placements</p>
          </div>
          <span className='admin-ad-active-count'>
            {advertisements.filter((ad) => ad.status === 'Active').length} Active
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
                    onClick={() =>
                      setAdvertisements((currentAds) =>
                        currentAds.filter((currentAd) => currentAd.id !== ad.id),
                      )
                    }
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
                {editingAdId === null
                  ? 'Create Advertisement'
                  : 'Save Changes'}
              </button>
            </form>
          </section>
        </div>
      )}
    </section>
  );
}

function AdminDashboard() {
  const [activeSection, setActiveSection] = useState('Dashboard');
  const [userSearch, setUserSearch] = useState('');
  const [usersPage, setUsersPage] = useState(1);
  const [playerGroup, setPlayerGroup] = useState('Top Players');
  const [gameGroup, setGameGroup] = useState('Active Games');
  const [engagementPeriod, setEngagementPeriod] = useState('Last 7 Days');

  const filteredUsers = users.filter((user) =>
    `${user.username} ${user.email}`
      .toLowerCase()
      .includes(userSearch.trim().toLowerCase()),
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
          />
        )}

        {activeSection === 'Player Statistics' && (
          <PlayerStatisticsView
            group={playerGroup}
            onGroupChange={setPlayerGroup}
          />
        )}

        {activeSection === 'Game Monitoring' && (
          <GameMonitoringView
            group={gameGroup}
            onGroupChange={setGameGroup}
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
            <p>Overview of users, game activity, and advertising performance.</p>
          </header>

          <section className='admin-metrics-grid' aria-label='Dashboard overview'>
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
                  {filteredUsers.map((user) => (
                    <tr key={user.username}>
                      <td>{user.username}</td>
                      <td>{user.email}</td>
                      <td>{user.joined}</td>
                      <td>
                        <span
                          className={`admin-status-dot status-${user.status.toLowerCase()}`}
                          aria-hidden='true'
                        />
                        {user.status}
                      </td>
                      <td>
                        <button
                          type='button'
                          className='admin-view-button'
                          aria-label={`View ${user.username}`}
                        >
                          View
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
              <button type='button' className='current-page' aria-current='page'>
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
                  {topPlayers.map((player) => (
                    <tr key={player.rank}>
                      <td>{player.rank}</td>
                      <td>{player.username}</td>
                      <td>{player.wins}</td>
                      <td>{player.rate}</td>
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
                    <th>Start Time</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {games.map((game) => (
                    <tr key={game.id}>
                      <td>{game.id}</td>
                      <td>{game.players}</td>
                      <td>
                        <span
                          className={`admin-status-dot status-${game.status
                            .toLowerCase()
                            .replace(' ', '-')}`}
                          aria-hidden='true'
                        />
                        {game.status}
                      </td>
                      <td>{game.time}</td>
                      <td>
                        <button
                          type='button'
                          className='admin-view-button'
                          aria-label={`View game ${game.id}`}
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
              <div className='admin-chart' aria-label='Impressions 152, clicks 87, conversions 28'>
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

      <aside className='admin-advertisement' aria-label='Advertisement'>
        <div className='admin-ad-art' aria-hidden='true'>
          <span />
          <span />
        </div>
        <strong>ADVERTISEMENT</strong>
        <div className='admin-ad-lines' aria-hidden='true'>
          <span />
          <span />
          <span />
        </div>
      </aside>
    </div>
  );
}

export default AdminDashboard;
