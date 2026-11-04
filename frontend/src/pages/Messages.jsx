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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

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

  const selectedFriend = friends.find(
    (friend) => friend._id === selectedFriendId,
  );

  function chooseFriend(friendId) {
    setSearchParams({ friend: friendId });
    setError('');
    setEditingId('');
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
      setMessages((existing) => [...existing, data]);
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
          <h2>Friends</h2>
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
                {friend.username}
              </button>
            ))
          )}
        </aside>

        <section className="messages-conversation" aria-label="Conversation">
          {selectedFriend ? (
            <>
              <h2>{selectedFriend.username}</h2>
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
                                  onClick={() => deleteMessage(message._id)}
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
                <button type="submit" disabled={!content.trim()}>
                  Send
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
    </main>
  );
}

export default Messages;
