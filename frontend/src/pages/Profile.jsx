import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import './Profile.css';

const sidebarItems = [
  { label: 'Profile', to: '/profile' },
  { label: 'Edit Profile', to: '/profile/edit' },
  { label: 'Stats', to: '/profile/stats' },
  { label: 'Achievements', to: '/profile/achievements' },
];

const stats = [
  { type: 'trophy', value: '', label: 'Games Won' },
  { type: 'chart', value: '', label: 'Games Played' },
  { type: 'star', value: '', label: 'Win Rate' },
  { type: 'coin', value: '', label: 'Total Chips Won' },
];

const achievements = [
  {
    type: 'trophy',
    title: 'First Win',
    text: 'Win your first game.',
  },
  {
    type: 'coin',
    title: 'Big Winner',
    text: 'Win 1,000 chips in a single game.',
  },
  {
    type: 'people',
    title: 'Social Player',
    text: 'Play 10 games with friends.',
  },
  {
    type: 'crown',
    title: 'High Roller',
    text: 'Win a game at the high level.',
  },
  {
    type: 'star',
    title: 'Consistent Player',
    text: 'Maintain a 50% win rate over 20 games.',
  },
  {
    type: 'spade',
    title: 'Seven-Card Stud Pro',
    text: 'Win 50 games total.',
  },
];

function StatIcon({ type }) {
  const commonProps = {
    viewBox: '0 0 64 64',
    className: 'icon-svg',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: '3.2',
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    'aria-hidden': 'true',
  };

  switch (type) {
    case 'trophy':
      return (
        <svg {...commonProps}>
          <path d='M18 12h28v8c0 6.5-5.5 12-12 12s-12-5.5-12-12v-8Z' />
          <path d='M18 12H12a5 5 0 0 0 5 5h1M46 12h6a5 5 0 0 1-5 5h-1' />
          <path d='M22 38h20v6H22z' />
          <path d='M16 52h32M20 26v12M44 26v12M24 12v-4M40 12v-4' />
        </svg>
      );
    case 'chart':
      return (
        <svg {...commonProps}>
          <path d='M16 48V22h8v26M30 48V12h8v36M44 48V28h8v20' />
          <path d='M10 52h44' />
        </svg>
      );
    case 'star':
      return (
        <svg {...commonProps}>
          <path d='m32 10 6.2 13.6 14.8 2.1-10.7 10.5 2.5 14.8-13.8-7.2-13.8 7.2 2.5-14.8L11 25.7l14.8-2.1L32 10Z' />
        </svg>
      );
    case 'coin':
      return (
        <svg {...commonProps}>
          <ellipse cx='32' cy='26' rx='20' ry='14' />
          <path d='M12 26c0 10 9 18 20 18s20-8 20-18S43 8 32 8 12 16 12 26Z' />
          <path d='M12 26h40' />
          <path d='M20 20v18M28 18v22M36 18v22M44 20v18' />
        </svg>
      );
    case 'people':
      return (
        <svg {...commonProps}>
          <circle cx='22' cy='23' r='7' />
          <circle cx='42' cy='23' r='6' />
          <path d='M12 48c1.5-7 6.8-11 14-11s12.5 4 14 11' />
          <path d='M34 48c1.1-5.5 5-9 10-9 5.4 0 9.5 3.5 10 9' />
        </svg>
      );
    case 'crown':
      return (
        <svg {...commonProps}>
          <path d='M14 44 18 18l14 12 14-12 4 26H14Z' />
          <path d='M18 18 20 12h24l2 6M20 44h24M22 28h20' />
        </svg>
      );
    case 'spade':
      return (
        <svg {...commonProps}>
          <path d='M32 10c3 6 10 10 10 17 0 6-5 10-10 10s-10-4-10-10c0-7 7-11 10-17Z' />
          <path d='M32 18v26' />
          <path d='M24 42h16v8H24z' />
          <path d='M28 50h8' />
        </svg>
      );
    default:
      return null;
  }
}

function AchievementIcon({ type }) {
  return <StatIcon type={type} />;
}

function ProfileSidebar({ pathname }) {
  return (
    <aside className='profile-sidebar'>
      <nav className='profile-sidebar-nav' aria-label='Profile navigation'>
        {sidebarItems.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            className={`profile-sidebar-item ${
              pathname === item.to ? 'active' : ''
            }`}
            aria-current={pathname === item.to ? 'page' : undefined}
          >
            {item.label}
          </Link>
        ))}
      </nav>
    </aside>
  );
}

function Profile() {
  const location = useLocation();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchUser() {
      try {
        const response = await fetch(
          `${import.meta.env.VITE_API_URL}/api/accounts/me`,
          {
            credentials: 'include',
          },
        );

        if (response.ok) {
          const data = await response.json();
          setUser(data);
        }
      } catch (error) {
        console.error('Error fetching user:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchUser();
  }, []);

  return (
    <div className='profile-page'>
      <ProfileSidebar pathname={location.pathname} />

      <main className='profile-main'>
        <section className='profile-panel'>
          <h1>Profile</h1>

          <div className='profile-card'>
            <div className='profile-avatar-box'>
              <div
                className='profile-avatar-circle'
                aria-label='Profile avatar'
              >
                <svg
                  viewBox='0 0 100 100'
                  className='profile-avatar-svg'
                  aria-hidden='true'
                >
                  <circle cx='50' cy='38' r='23' />
                  <path d='M24 82c3-16 13-24 26-24s23 8 26 24' />
                </svg>
              </div>
              <button type='button' className='profile-change-button'>
                Change Avatar
              </button>
            </div>

            <div className='profile-overview'>
              <div className='profile-name-row'>
                <h2>
                  {loading
                    ? 'Loading...'
                    : user
                      ? user.username
                      : 'Not logged in'}
                </h2>
              </div>

              <p className='profile-meta'>Player since Oct 2026</p>

              <div className='profile-status-row'>
                <span>Just here for a good game!</span>
                <span className='profile-suit' aria-hidden='true'>
                  ♠
                </span>
              </div>

              <div className='profile-balance-wrap'>
                <div className='profile-balance-graphic' aria-hidden='true'>
                  <div className='coin-stack coin-stack-1' />
                  <div className='coin-stack coin-stack-2' />
                  <div className='coin-stack coin-stack-3' />
                </div>

                <div className='profile-balance-text'>
                  <div className='balance-amount'>$1,250</div>
                  <div className='balance-label'>Chip Balance</div>
                </div>
              </div>

              <button type='button' className='profile-add-chips'>
                Earn Chips
              </button>
            </div>
          </div>
        </section>

        <section className='stats-panel'>
          <h2>Stats</h2>

          <div className='stats-grid'>
            {stats.map((stat) => (
              <div className='stat-box' key={stat.label}>
                <div className='stat-icon'>
                  <StatIcon type={stat.type} />
                </div>
                <div className='stat-value'>{stat.value}</div>
                <div className='stat-label'>{stat.label}</div>
              </div>
            ))}
          </div>
        </section>
      </main>

      <aside className='achievements-panel'>
        <h2>Achievements</h2>

        <ul className='achievement-list'>
          {achievements.map((achievement) => (
            <li key={achievement.title} className='achievement-item'>
              <div className='achievement-icon'>
                <AchievementIcon type={achievement.type} />
              </div>

              <div className='achievement-copy'>
                <h3>{achievement.title}</h3>
                <p>{achievement.text}</p>
              </div>
            </li>
          ))}
        </ul>
      </aside>
    </div>
  );
}

function EditProfile() {
  const location = useLocation();
  const [confirmation, setConfirmation] = useState(null);
  const [feedback, setFeedback] = useState('');

  function requestConfirmation(event, type, description) {
    event.preventDefault();
    setFeedback('');

    if (
      type === 'password' &&
      event.currentTarget.newPassword.value !==
        event.currentTarget.confirmPassword.value
    ) {
      setFeedback('The new passwords do not match.');
      return;
    }

    setConfirmation({ type, description });
  }

  function closeConfirmation() {
    setConfirmation(null);
  }

  function confirmAction() {
    setFeedback(
      'Confirmation received. Account changes are not connected to a service yet.',
    );
    setConfirmation(null);
  }

  return (
    <div className='profile-page edit-profile-page'>
      <ProfileSidebar pathname={location.pathname} />

      <main className='profile-main edit-profile-main'>
        <section className='profile-panel edit-profile-panel'>
          <h1>Edit Profile</h1>
          <p className='edit-profile-intro'>
            Update your account details. You will be asked to confirm each
            change before it is submitted.
          </p>

          {feedback && (
            <p className='edit-profile-feedback' role='status'>
              {feedback}
            </p>
          )}

          <form
            className='edit-profile-form'
            onSubmit={(event) =>
              requestConfirmation(
                event,
                'username',
                `change your username to "${event.currentTarget.username.value.trim()}"`,
              )
            }
          >
            <label htmlFor='profile-username'>Change username</label>
            <div className='edit-profile-control'>
              <input
                id='profile-username'
                name='username'
                type='text'
                autoComplete='username'
                minLength='3'
                maxLength='30'
                required
              />
              <button type='submit' className='edit-profile-save-button'>
                Save username
              </button>
            </div>
          </form>

          <form
            className='edit-profile-form'
            onSubmit={(event) =>
              requestConfirmation(
                event,
                'email',
                `change your email address to "${event.currentTarget.email.value.trim()}"`,
              )
            }
          >
            <label htmlFor='profile-email'>Change email</label>
            <div className='edit-profile-control'>
              <input
                id='profile-email'
                name='email'
                type='email'
                autoComplete='email'
                required
              />
              <button type='submit' className='edit-profile-save-button'>
                Save email
              </button>
            </div>
          </form>

          <form
            className='edit-profile-form edit-password-form'
            onSubmit={(event) =>
              requestConfirmation(event, 'password', 'change your password')
            }
          >
            <label htmlFor='profile-current-password'>Change password</label>
            <input
              id='profile-current-password'
              name='currentPassword'
              type='password'
              autoComplete='current-password'
              placeholder='Current password'
              required
            />
            <input
              name='newPassword'
              type='password'
              autoComplete='new-password'
              placeholder='New password'
              minLength='8'
              required
            />
            <input
              name='confirmPassword'
              type='password'
              autoComplete='new-password'
              placeholder='Confirm new password'
              minLength='8'
              required
            />
            <button type='submit' className='edit-profile-save-button'>
              Save password
            </button>
          </form>

          <section className='delete-account-section'>
            <div>
              <h2>Delete account</h2>
              <p>This action cannot be undone.</p>
            </div>
            <button
              type='button'
              className='delete-account-button'
              onClick={() => {
                setFeedback('');
                setConfirmation({
                  type: 'delete',
                  description: 'permanently delete your account',
                });
              }}
            >
              Delete account
            </button>
          </section>
        </section>
      </main>

      {confirmation && (
        <div
          className='profile-confirmation-backdrop'
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeConfirmation();
            }
          }}
        >
          <section
            className='profile-confirmation-dialog'
            role='dialog'
            aria-modal='true'
            aria-labelledby='profile-confirmation-title'
          >
            <h2 id='profile-confirmation-title'>
              {confirmation.type === 'delete'
                ? 'Delete account?'
                : 'Confirm change'}
            </h2>
            <p>Are you sure you want to {confirmation.description}?</p>
            <p className='confirmation-note'>
              Account changes are not connected to a service yet.
            </p>
            <div className='profile-confirmation-actions'>
              <button
                type='button'
                className='confirmation-cancel-button'
                onClick={closeConfirmation}
              >
                Cancel
              </button>
              <button
                type='button'
                className={
                  confirmation.type === 'delete'
                    ? 'confirmation-delete-button'
                    : 'confirmation-accept-button'
                }
                onClick={confirmAction}
              >
                {confirmation.type === 'delete' ? 'Confirm delete' : 'Confirm'}
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

export default Profile;
export { EditProfile };
