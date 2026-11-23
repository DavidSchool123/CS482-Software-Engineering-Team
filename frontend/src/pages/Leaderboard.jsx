import React, { useEffect, useState } from 'react';
import './Leaderboard.css';


const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
const PAGE_SIZE = 50;

function formatWinRate(winRate) {
    return `${(winRate * 100).toFixed(2)}%`;
}

function formatWinnings(winnings) {
    if (winnings > 0) return `+$${winnings.toLocaleString()}`;
    return `$${winnings.toLocaleString()}`;
}

function Leaderboard() {
    const [sortBy, setSortBy] = useState('winRate');
    const [players, setPlayers] = useState([]);
    const [myRank, setMyRank] = useState(null);
    const [friends, setFriends] = useState([]);
    const [totalPlayers, setTotalPlayers] = useState(0);
    const [offset, setOffset] = useState(0);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [error, setError] = useState('');

    async function loadLeaderboard(selectedSort, selectedOffset, append = false) {
        try {
            if (append) setLoadingMore(true);
            else setLoading(true);

            const response = await fetch(
                `${API_URL}/api/leaderboard?sortBy=${selectedSort}&offset=${selectedOffset}`,
                { credentials: 'include' }
            );

            if (!response.ok) {
                throw new Error('Failed to load leaderboard.');
            }

            const data = await response.json();

            setPlayers(previous =>
                append ? [...previous, ...data.leaderboard] : data.leaderboard
            );

            setMyRank(data.myRank);
            setFriends(data.friends);
            setTotalPlayers(data.totalPlayers);
            setOffset(selectedOffset + data.leaderboard.length);
            setError('');
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
            setLoadingMore(false);
        }
    }

    useEffect(() => {
        setPlayers([]);
        setOffset(0);
        loadLeaderboard(sortBy, 0);
    }, [sortBy]);

    function renderPlayer(player) {
        return (
            <div
                className={`leaderboard-row ${
                    myRank?._id === player._id ? 'current-player' : ''
                }`}
                key={player._id}
            >
                <span className="leaderboard-rank">#{player.rank}</span>
                <span className="leaderboard-username">{player.username}</span>
                <span className="leaderboard-winrate">
                    {formatWinRate(player.winRate)}
                </span>
                <span className="leaderboard-winnings">
                    {formatWinnings(player.netWinnings)}
                </span>
            </div>
        );
    }

    if (loading) {
        return <div className="leaderboard-page">Loading leaderboard...</div>;
    }

    return (
        <main className="leaderboard-page">
            <h1>Leaderboard</h1>

            {error && <p className="leaderboard-error">{error}</p>}

            {/* Current player's global rank */}
            {myRank && (
                <section className="leaderboard-card">
                    <h2>Your Global Rank</h2>
                    {renderPlayer(myRank)}
                </section>
            )}

            {/* Friends' global ranks */}
            <section className="leaderboard-card">
                <h2>Friends Rankings</h2>
                {friends.length === 0 ? (
                    <p>No friends currently ranked.</p>
                ) : (
                    friends.map(renderPlayer)
                )}
            </section>

            {/* Main leaderboard */}
            <section className="leaderboard-card">
                <div className="leaderboard-header">
                    <h2>Top Players</h2>

                    <select
                        value={sortBy}
                        onChange={event => setSortBy(event.target.value)}
                    >
                        <option value="winRate">Win Rate</option>
                        <option value="netWinnings">Net Winnings</option>
                    </select>
                </div>

                <div className="leaderboard-row leaderboard-column-header">
                    <span>Rank</span>
                    <span>Player</span>
                    <span>Win Rate</span>
                    <span>Net Winnings</span>
                </div>

                {players.map(renderPlayer)}

                {players.length < totalPlayers && (
                    <button
                        className="leaderboard-show-more"
                        onClick={() => loadLeaderboard(sortBy, offset, true)}
                        disabled={loadingMore}
                    >
                        {loadingMore ? 'Loading...' : 'Show More'}
                    </button>
                )}
            </section>
        </main>
    );
}

export default Leaderboard;
