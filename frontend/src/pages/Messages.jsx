import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import './Messages.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

function Messages() {
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedFriendId = searchParams.get('friend') || '';
  const [currentUserId, setCurrentUserId] = useState('');
  const [friends, setFriends] = useState([]);
  const [messages, setMessages] = useState([]);
  const [content, setContent] = useState('');
  const [editingId, setEditingId] = useState('');
  const [editingContent, setEditingContent] = useState('');
  const [pendingDeleteId, setPendingDeleteId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [liveFriendId, setLiveFriendId] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function loadMessagesPage() {
      try {
        const userResponse = await fetch(`${API_URL}/api/accounts/me`, {
          credentials: 'include',
        });
        if (!userResponse.ok) {
          throw new Error('Log in to view your private messages.');
        }

        const user = await userResponse.json();
        const friendsResponse = await fetch(
          `${API_URL}/api/friends/${user._id}`,
          { credentials: 'include' },
        );
        if (!friendsResponse.ok) {
          throw new Error('Could not load your friends.');
        }

        const friendsData = await friendsResponse.json();
        if (!cancelled) {
          setCurrentUserId(user._id);
          setFriends(friendsData);
        }
      } catch (loadError) {
        console.error('Could not load messages page:', loadError);
        if (!cancelled) {
          setError(loadError.message);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadMessagesPage();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadConversation() {
      if (!currentUserId || !selectedFriendId) {
        setMessages([]);
        return;
      }

      setError('');
      try {
        const response = await fetch(
          `${API_URL}/api/messages/${selectedFriendId}`,
          { credentials: 'include' },
        );
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.message || 'Could not load conversation.');
        }
        if (!cancelled) {
          setMessages(data);
        }
      } catch (loadError) {
        console.error('Could not load conversation:', loadError);
        if (!cancelled) {
          setMessages([]);
          setError(loadError.message);
        }
      }
    }

    loadConversation();
    return () => {
      cancelled = true;
    };
  }, [currentUserId, selectedFriendId]);

  useEffect(() => {
    if (
      !currentUserId ||
      !selectedFriendId ||
      !friends.some((friend) => friend._id === selectedFriendId)
    ) {
      return undefined;
    }

    const socketUrl = new URL(API_URL);
    socketUrl.protocol = socketUrl.protocol === 'https:' ? 'wss:' : 'ws:';
    socketUrl.pathname = '/ws/messages';
    socketUrl.search = new URLSearchParams({
      friendId: selectedFriendId,
    }).toString();

    let socket;
    let retryTimer;
    let retryDelay = 1000;
    let stopped = false;

    function connect() {
      if (stopped) return;

      const connection = new WebSocket(socketUrl);
      socket = connection;
      connection.addEventListener('open', async () => {
        if (stopped) {
          connection.close();
          return;
        }

        retryDelay = 1000;
        setLiveFriendId(selectedFriendId);

        try {
          const response = await fetch(
            `${API_URL}/api/messages/${selectedFriendId}`,
            { credentials: 'include' },
          );
          if (stopped || !response.ok) return;
          const latestMessages = await response.json();
          setMessages((existing) => {
            const byId = new Map(
              existing.map((message) => [message._id, message]),
            );
            latestMessages.forEach((message) => byId.set(message._id, message));
            return [...byId.values()].sort(
              (a, b) => new Date(a.createdAt) - new Date(b.createdAt),
            );
          });
        } catch (syncError) {
          console.error('Could not sync messages after reconnect:', syncError);
        }
      });

      connection.addEventListener('message', (event) => {
        if (stopped) return;
        const update = JSON.parse(event.data);
        if (update.type === 'message-created') {
          setMessages((existing) =>
            existing.some((message) => message._id === update.message._id)
              ? existing
              : [...existing, update.message],
          );
        } else if (update.type === 'message-updated') {
          setMessages((existing) =>
            existing.map((message) =>
              message._id === update.message._id ? update.message : message,
            ),
          );
        } else if (update.type === 'message-deleted') {
          setMessages((existing) =>
            existing.filter((message) => message._id !== update.messageId),
          );
        } else if (update.type === 'conversation-deleted') {
          stopped = true;
          setMessages([]);
          setFriends((existing) =>
            existing.filter((friend) => friend._id !== selectedFriendId),
          );
          setSearchParams({});
          setError('This conversation ended because you are no longer friends.');
        }
      });

      connection.addEventListener('close', (event) => {
        if (event.code === 4002) {
          stopped = true;
          setLiveFriendId('');
          setError('Your session ended. Log in again to continue messaging.');
          return;
        }

        if (!stopped) {
          setLiveFriendId('');
        }
        if (!stopped) {
          retryTimer = window.setTimeout(connect, retryDelay);
          retryDelay = Math.min(retryDelay * 2, 10000);
        }
      });

      connection.addEventListener('error', () => {
        connection.close();
      });
    }

    connect();
    return () => {
      stopped = true;
      window.clearTimeout(retryTimer);
      socket?.close();
    };
  }, [currentUserId, friends, selectedFriendId, setSearchParams]);

  const selectedFriend = friends.find(
    (friend) => friend._id === selectedFriendId,
  );

  function chooseFriend(friendId) {
    setSearchParams({ friend: friendId });
    setError('');
    setEditingId('');
    setPendingDeleteId('');
  }

  async function sendMessage(event) {
    event.preventDefault();
    if (!selectedFriendId || !content.trim()) return;

    try {
      const response = await fetch(`${API_URL}/api/messages`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipientId: selectedFriendId,
          content: content.trim(),
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || 'Could not send message.');
      }
      setMessages((existing) =>
        existing.some((message) => message._id === data._id)
          ? existing
          : [...existing, data],
      );
      setContent('');
      setError('');
    } catch (sendError) {
      console.error('Could not send message:', sendError);
      setError(sendError.message);
    }
  }

  async function saveEdit(messageId) {
    try {
      const response = await fetch(`${API_URL}/api/messages/${messageId}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: editingContent }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || 'Could not update message.');
      }
      setMessages((existing) =>
        existing.map((message) => (message._id === messageId ? data : message)),
      );
      setEditingId('');
      setError('');
    } catch (saveError) {
      console.error('Could not update message:', saveError);
      setError(saveError.message);
    }
  }

  async function deleteMessage(messageId) {
    try {
      const response = await fetch(`${API_URL}/api/messages/${messageId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || 'Could not delete message.');
      }
      setMessages((existing) =>
        existing.filter((message) => message._id !== messageId),
      );
      setPendingDeleteId('');
      setError('');
    } catch (deleteError) {
      console.error('Could not delete message:', deleteError);
      setError(deleteError.message);
    }
  }

  if (loading) {
    return <main className="messages-page"><p>Loading messages...</p></main>;
  }

  return (
    <main className="messages-page">
      <header className="messages-header">
        <h1>Private Messages</h1>
        <p>Message your friends privately.</p>
      </header>

      {error && <p className="messages-error" role="alert">{error}</p>}

      <div className="messages-layout">
        <aside className="messages-friends">
          <div className="messages-friends-heading">
            <div>
              <span className="messages-eyebrow">YOUR PEOPLE</span>
              <h2>Conversations</h2>
            </div>
            <span className="messages-friend-count">{friends.length}</span>
          </div>
          {friends.length === 0 ? (
            <p className="messages-empty">Add friends to start a conversation.</p>
          ) : (
            friends.map((friend) => (
              <button
                type="button"
                key={friend._id}
                className={`messages-friend ${
                  friend._id === selectedFriendId ? 'active' : ''
                }`}
                onClick={() => chooseFriend(friend._id)}
              >
                <span className="messages-avatar" aria-hidden="true">
                  {friend.avatar ? (
                    <img src={friend.avatar} alt="" />
                  ) : (
                    friend.username.charAt(0).toUpperCase()
                  )}
                </span>
                <span className="messages-friend-name">{friend.username}</span>
                <span className="messages-friend-arrow" aria-hidden="true">›</span>
              </button>
            ))
          )}
        </aside>

        <section className="messages-conversation" aria-label="Conversation">
          {selectedFriend ? (
            <>
              <header className="messages-conversation-header">
                <div className="messages-contact">
                  <span className="messages-avatar messages-avatar-large" aria-hidden="true">
                    {selectedFriend.avatar ? (
                      <img src={selectedFriend.avatar} alt="" />
                    ) : (
                      selectedFriend.username.charAt(0).toUpperCase()
                    )}
                  </span>
                  <div>
                    <h2>{selectedFriend.username}</h2>
                    <span className="messages-contact-caption">Private conversation</span>
                  </div>
                </div>
                <span
                  className={`messages-live-status ${
                    liveFriendId === selectedFriendId ? 'connected' : ''
                  }`}
                  aria-live="polite"
                >
                  <span className="messages-live-dot" aria-hidden="true" />
                  {liveFriendId === selectedFriendId ? 'Live' : 'Connecting'}
                </span>
              </header>
              <div className="messages-list" aria-live="polite">
                {messages.length === 0 ? (
                  <p className="messages-empty">No messages yet. Say hello!</p>
                ) : (
                  messages.map((message) => {
                    const isOwnMessage = message.sender === currentUserId;
                    return (
                      <article
                        key={message._id}
                        className={`private-message ${
                          isOwnMessage ? 'own-message' : ''
                        }`}
                      >
                        {editingId === message._id ? (
                          <div className="message-edit">
                            <textarea
                              value={editingContent}
                              maxLength={2000}
                              onChange={(event) =>
                                setEditingContent(event.target.value)
                              }
                              aria-label="Edit message"
                            />
                            <button
                              type="button"
                              onClick={() => saveEdit(message._id)}
                            >
                              Save
                            </button>
                            <button
                              type="button"
                              className="message-secondary"
                              onClick={() => setEditingId('')}
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <>
                            <p>{message.content}</p>
                            <time dateTime={message.createdAt}>
                              {new Date(message.createdAt).toLocaleString()}
                            </time>
                            {isOwnMessage && (
                              <div className="message-actions">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingId(message._id);
                                    setEditingContent(message.content);
                                  }}
                                >
                                  Edit
                                </button>
                                <button
                                  type="button"
                                  className="message-delete"
                                  onClick={() => setPendingDeleteId(message._id)}
                                >
                                  Delete
                                </button>
                              </div>
                            )}
                          </>
                        )}
                      </article>
                    );
                  })
                )}
              </div>
              <form className="message-compose" onSubmit={sendMessage}>
                <textarea
                  value={content}
                  maxLength={2000}
                  placeholder={`Message ${selectedFriend.username}...`}
                  aria-label="New message"
                  onChange={(event) => setContent(event.target.value)}
                />
                <button
                  type="submit"
                  disabled={!content.trim()}
                  aria-label="Send message"
                >
                  <span aria-hidden="true">↑</span>
                  <span>Send</span>
                </button>
              </form>
            </>
          ) : (
            <p className="messages-empty">
              {friends.length
                ? 'Choose a friend to view your conversation.'
                : 'Your conversations will appear here when you add friends.'}
            </p>
          )}
        </section>
      </div>

      {pendingDeleteId && (
        <div className="message-dialog-backdrop">
          <section
            className="message-delete-dialog"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="delete-message-title"
            aria-describedby="delete-message-description"
          >
            <span className="message-dialog-icon" aria-hidden="true">×</span>
            <h2 id="delete-message-title">Delete this message?</h2>
            <p id="delete-message-description">
              This message will be removed from the conversation for both of you.
              This action can’t be undone.
            </p>
            <div className="message-dialog-actions">
              <button
                type="button"
                className="message-dialog-cancel"
                onClick={() => setPendingDeleteId('')}
              >
                Keep message
              </button>
              <button
                type="button"
                className="message-dialog-confirm"
                onClick={() => deleteMessage(pendingDeleteId)}
              >
                Delete message
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}

export default Messages;
