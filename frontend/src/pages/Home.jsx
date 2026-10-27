
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

function Home() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [checkingLogin, setCheckingLogin] = useState(true);

  // Check whether the user is already logged in.
  useEffect(() => {
    let cancelled = false;

    async function checkLogin() {
      try {
        const response = await fetch(`${API_URL}/api/accounts/me`, {
          credentials: 'include',
        });

        if (!cancelled) {
          setIsLoggedIn(response.ok);
        }
      } catch (error) {
        console.error('Could not check login:', error);

        if (!cancelled) {
          setIsLoggedIn(false);
        }
      } finally {
        if (!cancelled) {
          setCheckingLogin(false);
        }
      }
    }

    checkLogin();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="home-page">
      <section className="hero-section">
        <div className="poker-decorations" aria-hidden="true">
          <div className="card-group card-group-left">
            <div className="playing-card card-back">♛</div>
            <div className="playing-card card-front red-card">
              A <span>♥</span>
            </div>
          </div>

          <div className="card-group card-group-right">
            <div className="playing-card card-front">
              K <span>♠</span>
            </div>
            <div className="playing-card card-back">♛</div>
          </div>

          <div className="poker-chip chip-left">♠</div>
          <div className="poker-chip chip-right">♣</div>
        </div>

        <div className="hero-content">
          <div className="hero-crown">♛</div>

          <h1>POKER FACE</h1>

          <h2>Your Table Awaits.</h2>

          <p>
            Play online poker, meet new people,
            and test your skills.
          </p>

          <div className="hero-actions">
            {/* Play Now: Lobby if logged in, Account page otherwise */}
            <Link
              to={isLoggedIn ? '/lobby' : '/account'}
              state={
                isLoggedIn
                  ? undefined
                  : { accountView: 'login' }
              }
              className="play-button"
              aria-disabled={checkingLogin}
              onClick={(event) => {
                if (checkingLogin) {
                  event.preventDefault();
                }
              }}
            >
              {checkingLogin ? 'Loading...' : 'Play Now'}
            </Link>

            <div className="hero-secondary-links">
              <Link
                to="/account"
                state={{ accountView: 'register' }}
              >
                Create an Account
              </Link>

              <span>or</span>

              <Link to="/lobby?guest=true">
                Play as Guest
              </Link>
            </div>
          </div>
        </div>

        <aside className="hero-ad">
          <span>ADVERTISEMENT</span>
        </aside>
      </section>

      {/* About Seven-Card Stud */}
      <section className="game-intro-section">
        <div className="game-intro-content">
          <div className="game-intro-text">
            <span className="section-eyebrow">
              ABOUT THE GAME
            </span>

            <h2>Get to Know Seven-Card Stud</h2>

            <p>
              A classic poker game where each player is dealt seven
              cards throughout the round. Some cards are face up,
              others stay hidden, and the best five-card hand wins.
            </p>

            <Link to="/tutorial" className="game-intro-link">
              Learn How to Play <span aria-hidden="true">→</span>
            </Link>
          </div>

          <div className="game-intro-art" aria-hidden="true">
            <div className="intro-card intro-card-back">
              ♛
            </div>

            <div className="intro-card intro-card-front">
              <span className="intro-card-rank">A ♥</span>
              <span className="intro-card-suit">♥</span>
            </div>

            <div className="intro-chip intro-chip-one">♠</div>
            <div className="intro-chip intro-chip-two">♣</div>
          </div>
        </div>
      </section>

      {/* Poker Face Features */}
      <section className="experience-section">
        <div className="experience-container">
          <span className="section-eyebrow">
            WHAT YOU CAN DO
          </span>

          <h2>More Than Just a Game of Poker</h2>

          <p className="experience-description">
            Play a few hands, challenge your friends,
            or meet someone new at the table.
          </p>

          <div className="experience-grid">
            {/* Feature 1: Play with Friends or Bots */}
            <div className="experience-item">
              <div
                className="experience-art"
                aria-hidden="true"
              >
                <div className="experience-playing-card experience-card-one">
                  ♥
                </div>

                <div className="experience-playing-card experience-card-two">
                  ♠
                </div>

                <div className="experience-chip">♣</div>
              </div>

              <h3>Play with Friends or Bots</h3>

              <p>
                Join your friends at a table or play against
                computer opponents.
              </p>
            </div>

            {/* Feature 2: Meet Other Players */}
            <div className="experience-item">
              <div
                className="experience-art social-art"
                aria-hidden="true"
              >
                <div className="social-avatar social-avatar-one">
                  <span className="avatar-head"></span>
                  <span className="avatar-body"></span>
                </div>

                <div className="social-avatar social-avatar-two">
                  <span className="avatar-head"></span>
                  <span className="avatar-body"></span>
                </div>

                <div className="social-chat">•••</div>
              </div>

              <h3>Meet Other Players</h3>

              <p>
                Chat, add friends, and find people to play with again.
              </p>
            </div>
          </div>

          <div className="experience-highlights">
            <span>♠ 2–6 players per table</span>
            <span>★ Player stats and leaderboard</span>
            <span>♣ Public and private tables</span>
          </div>
        </div>
      </section>

      {/* Bottom Advertisement */}
      <section className="home-ad-section">
        <aside className="bottom-ad">
          <span>ADVERTISEMENT</span>
        </aside>
      </section>
    </div>
  );
}

export default Home;
