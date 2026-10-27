
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import './Friends.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

function Friends() {
  const [currentUserId, setCurrentUserId] = useState('');
  const [checkingLogin, setCheckingLogin] = useState(true);
  const [activeTab, setActiveTab] = useState('friends');

  const [friends, setFriends] = useState([]);
  const [requests, setRequests] = useState([]);
  const [sentRequests, setSentRequests] = useState([]);

  const [showSearch, setShowSearch] = useState(false);
  const [username, setUsername] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [hasSearched, setHasSearched] = useState(false);

  // Get the currently logged-in player.
  useEffect(() => {
    let cancelled = false;

    async function loadCurrentUser() {
      try {
        const response = await fetch(`${API_URL}/api/accounts/me`, {
          credentials: 'include',
        });

        if (!response.ok) {
          throw new Error('Not logged in');
        }

        const data = await response.json();
        const user = data.user || data;

        if (!user._id) {
          throw new Error('User ID not found');
        }

        if (!cancelled) {
          setCurrentUserId(user._id);
        }
      } catch (err) {
        console.error(err);

        if (!cancelled) {
          setError('Please log in to access your friends.');
        }
      } finally {
        if (!cancelled) {
          setCheckingLogin(false);
        }
      }
    }

    loadCurrentUser();

    return () => {
      cancelled = true;
    };
  }, []);

  // Load friends and incoming/outgoing requests.
  useEffect(() => {
    if (!currentUserId) {
      setFriends([]);
      setRequests([]);
      setSentRequests([]);
      return;
    }

    let cancelled = false;

    async function loadFriendData() {
      try {
        const [friendsResponse, requestsResponse, sentResponse] =
          await Promise.all([
            fetch(`${API_URL}/api/friends/${currentUserId}`, {
              credentials: 'include',
            }),
            fetch(`${API_URL}/api/friends/requests/${currentUserId}`, {
              credentials: 'include',
            }),
            fetch(`${API_URL}/api/friends/sent/${currentUserId}`, {
              credentials: 'include',
            }),
          ]);

        if (
          !friendsResponse.ok ||
          !requestsResponse.ok ||
          !sentResponse.ok
        ) {
          throw new Error('Failed to load friend data');
        }

        const [friendsData, requestsData, sentData] = await Promise.all([
          friendsResponse.json(),
          requestsResponse.json(),
          sentResponse.json(),
        ]);

        if (!cancelled) {
          setFriends(friendsData);
          setRequests(requestsData);
          setSentRequests(sentData);
        }
      } catch (err) {
        console.error(err);

        if (!cancelled) {
          setError('Could not load friends or requests.');
        }
      }
    }

    loadFriendData();

    return () => {
      cancelled = true;
    };
  }, [currentUserId]);

  // Refresh friend data after an action.
  async function refreshFriendData() {
    if (!currentUserId) return;

    const [friendsResponse, requestsResponse, sentResponse] =
      await Promise.all([
        fetch(`${API_URL}/api/friends/${currentUserId}`, {
          credentials: 'include',
        }),
        fetch(`${API_URL}/api/friends/requests/${currentUserId}`, {
          credentials: 'include',
        }),
        fetch(`${API_URL}/api/friends/sent/${currentUserId}`, {
          credentials: 'include',
        }),
      ]);

    if (
      !friendsResponse.ok ||
      !requestsResponse.ok ||
      !sentResponse.ok
    ) {
      throw new Error('Could not refresh friend data');
    }

    const [friendsData, requestsData, sentData] = await Promise.all([
      friendsResponse.json(),
      requestsResponse.json(),
      sentResponse.json(),
    ]);

    setFriends(friendsData);
    setRequests(requestsData);
    setSentRequests(sentData);
  }

  // Search for players by username.
  async function handleSearch(event) {
    event.preventDefault();

    const query = username.trim();

    if (!query) {
      setResults([]);
      setHasSearched(false);
      setError('Enter a username to search.');
      return;
    }

    setLoading(true);
    setError('');
    setMessage('');
    setHasSearched(false);

    try {
      const response = await fetch(
        `${API_URL}/api/users/search?username=${encodeURIComponent(query)}`,
        { credentials: 'include' },
      );

      if (!response.ok) {
        throw new Error('Search failed');
      }

      const users = await response.json();

      setResults(
        users.filter((user) => user._id !== currentUserId),
      );

      setHasSearched(true);
    } catch (err) {
      console.error(err);
      setResults([]);
      setError('Could not search for players. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  // Send a friend request.
  async function sendRequest(receiverId) {
    if (!currentUserId) return;

    setBusyId(receiverId);
    setError('');
    setMessage('');

    try {
      const response = await fetch(`${API_URL}/api/friends/request`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          senderId: currentUserId,
          receiverId,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Could not send friend request');
      }

      await refreshFriendData();
      setMessage('Friend request sent successfully!');
    } catch (err) {
      console.error(err);
      setError(err.message);
    } finally {
      setBusyId('');
    }
  }

  // Accept or decline a friend request.
  async function respondToRequest(requestId, action) {
    if (!currentUserId) return;

    setBusyId(requestId);
    setError('');
    setMessage('');

    try {
      const response = await fetch(
        `${API_URL}/api/friends/requests/${currentUserId}/${requestId}`,
        {
          method: 'PATCH',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ action }),
        },
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || 'Could not respond to friend request',
        );
      }

      await refreshFriendData();

      setMessage(
        action === 'accept'
          ? 'Friend request accepted!'
          : 'Friend request declined.',
      );
    } catch (err) {
      console.error(err);
      setError(err.message);
    } finally {
      setBusyId('');
    }
  }

  // Remove an existing friend.
  async function removeFriend(friend) {
    if (!window.confirm(`Remove ${friend.username} from your friends list?`)) {
      return;
    }

    setBusyId(friend._id);
    setError('');
    setMessage('');

    try {
      const response = await fetch(
        `${API_URL}/api/friends/${currentUserId}/${friend._id}`,
        {
          method: 'DELETE',
          credentials: 'include',
        },
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Could not remove friend.');
      }

      await refreshFriendData();
      setMessage(`${friend.username} was removed from your friends list.`);
    } catch (err) {
      console.error(err);
      setError(err.message);
    } finally {
      setBusyId('');
    }
  }

  function openSearch() {
    setShowSearch(true);
    setActiveTab('friends');
    setUsername('');
    setResults([]);
    setError('');
    setMessage('');
    setHasSearched(false);
  }

  function closeSearch() {
    setShowSearch(false);
    setError('');
    setMessage('');
  }

  return (
    <div className="friends-page">
      {/* Left Sidebar */}
      <aside className="friends-sidebar">
        <h2>Friends</h2>

        <button
          type="button"
          className={`friends-sidebar-link ${
            activeTab === 'friends' ? 'active' : ''
          }`}
          onClick={() => {
            setActiveTab('friends');
            setShowSearch(false);
            setError('');
            setMessage('');
          }}
        >
          My Friends
        </button>

        <button
          type="button"
          className={`friends-sidebar-link ${
            activeTab === 'requests' ? 'active' : ''
          }`}
          onClick={() => {
            setActiveTab('requests');
            setShowSearch(false);
            setError('');
            setMessage('');
          }}
        >
          Friend Requests ({requests.length})
        </button>

        <div className="friends-sidebar-ad">
          ADVERTISEMENT
        </div>
      </aside>

      {/* Main Content */}
      <main className="friends-main">
        <div className="friends-header">
          <div>
            <h1>
              {activeTab === 'friends'
                ? 'My Friends'
                : 'Friend Requests'}
            </h1>

            <p>
              {activeTab === 'friends'
                ? 'Find and connect with other players.'
                : 'Review requests from other players.'}
            </p>
          </div>

          {activeTab === 'friends' && currentUserId && (
            <button
              type="button"
              className="friends-add-button"
              onClick={openSearch}
            >
              + Add Friend
            </button>
          )}
        </div>

        {/* Feedback Messages */}
        {error && (
          <p role="alert" className="friends-error">
            {error}
          </p>
        )}

        {message && (
          <p role="status" className="friends-success">
            {message}
          </p>
        )}

        {/* Loading Login */}
        {checkingLogin ? (
          <div className="friends-empty-state">
            <h2>Loading Friends...</h2>
            <p>Checking your account.</p>
          </div>

        ) : !currentUserId ? (
          /* Not Logged In */
          <div className="friends-empty-state">
            <h2>Log In to View Friends</h2>
            <p>
              Please log in to view your friends and friend requests.
            </p>
            <Link
              to="/login"
              state={{ accountView: 'login' }}
              className="friends-add-button"
            >
              Log In
            </Link>
          </div>

        ) : activeTab === 'requests' ? (
          /* Incoming Friend Requests */
          <section className="friends-search-panel">
            <h2>Incoming Requests</h2>

            {requests.length === 0 ? (
              <p className="friends-empty">
                No pending friend requests.
              </p>
            ) : (
              <div className="friends-results">
                {requests.map((request) => (
                  <div
                    className="friends-player"
                    key={request.requestId}
                  >
                    <div className="friends-avatar">♠</div>

                    <span>
                      {request.username || 'Unknown player'}
                    </span>

                    <div className="friends-player-actions">
                      <button
                        type="button"
                        disabled={busyId === request.requestId}
                        onClick={() =>
                          respondToRequest(
                            request.requestId,
                            'accept',
                          )
                        }
                      >
                        Accept
                      </button>

                      <button
                        type="button"
                        className="friends-secondary-button"
                        disabled={busyId === request.requestId}
                        onClick={() =>
                          respondToRequest(
                            request.requestId,
                            'decline',
                          )
                        }
                      >
                        Decline
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

        ) : showSearch ? (
          /* Player Lookup */
          <section className="friends-search-panel">
            <div className="friends-search-header">
              <h2>Find Players</h2>

              <button
                type="button"
                onClick={closeSearch}
                aria-label="Close player search"
                className="friends-close-button"
              >
                ×
              </button>
            </div>

            <form
              onSubmit={handleSearch}
              className="friends-search-form"
            >
              <input
                type="search"
                placeholder="Search by username..."
                value={username}
                onChange={(event) =>
                  setUsername(event.target.value)
                }
                aria-label="Search players by username"
              />

              <button type="submit" disabled={loading}>
                {loading ? 'Searching...' : 'Search'}
              </button>
            </form>

            {hasSearched && results.length === 0 && (
              <p className="friends-empty">
                No players found.
              </p>
            )}

            <div className="friends-results">
              {results.map((user) => {
                const alreadyFriends = friends.some(
                  (friend) => friend._id === user._id,
                );

                const isPending = sentRequests.some(
                  (request) => request._id === user._id,
                );

                const hasIncomingRequest = requests.some(
                  (request) => request.senderId === user._id,
                );

                return (
                  <div
                    className="friends-player"
                    key={user._id}
                  >
                    <div className="friends-avatar">♠</div>

                    <span>{user.username}</span>

                    <div className="friends-player-actions">
                      {alreadyFriends ? (
                        <span className="friends-status">
                          Friends
                        </span>
                      ) : isPending ? (
                        <button
                          type="button"
                          className="friends-pending-button"
                          disabled
                        >
                          Pending
                        </button>
                      ) : hasIncomingRequest ? (
                        <span className="friends-status">
                          Request Received
                        </span>
                      ) : (
                        <button
                          type="button"
                          disabled={busyId === user._id}
                          onClick={() => sendRequest(user._id)}
                        >
                          {busyId === user._id
                            ? 'Sending...'
                            : 'Send Request'}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

        ) : friends.length === 0 ? (
          /* Empty Friends List */
          <div className="friends-empty-state">
            <h2>Your Friends List</h2>
            <p>
              Your friends will appear here once you start
              adding players.
            </p>
          </div>

        ) : (
          /* Accepted Friends */
          <section className="friends-search-panel">
            <h2>Your Friends ({friends.length})</h2>

            <div className="friends-results">
              {friends.map((friend) => (
                <div
                  className="friends-player"
                  key={friend._id}
                >
                  <div className="friends-avatar">♠</div>

                  <span>{friend.username}</span>

                  <div className="friends-player-actions">
                    <Link
                      to="/messages"
                      className="friends-message-button"
                      aria-label={`Message ${friend.username}`}
                      title={`Message ${friend.username}`}
                    >
                      <span aria-hidden="true">✉</span>
                      Message
                    </Link>

                    <button
                      type="button"
                      className="friends-remove-button"
                      disabled={busyId === friend._id}
                      onClick={() => removeFriend(friend)}
                    >
                      {busyId === friend._id
                        ? 'Removing...'
                        : 'Remove'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

export default Friends;
