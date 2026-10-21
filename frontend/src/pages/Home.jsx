
function Home() {
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

          <h2>Play. Connect. Compete.</h2>

          <p>
            Play online poker, meet new people,
            and test your skills.
          </p>

          <div className="hero-actions">
            <a href="/lobby" className="play-button">
              Play Now
            </a>

            <div className="hero-secondary-links">
              <a href="/account">Create an Account</a>
              <span>or</span>
              <a href="/lobby?guest=true">Play as Guest</a>
            </div>
          </div>
        </div>

        <aside className="hero-ad">
          <span>ADVERTISEMENT</span>
        </aside>
      </section>
      
<section className="features-section">
  <h2>Why Play Poker Face?</h2>

  <div className="features-grid">
    <div className="feature-card">
      <div className="feature-icon">♠</div>
      <h3>Play with Friends or Bots</h3>
      <p>
        Challenge your friends or practice your skills
        against computer opponents.
      </p>
    </div>

    <div className="feature-card">
      <div className="feature-icon">♣</div>
      <h3>2–6 Players per Table</h3>
      <p>
        Join a table and enjoy a game of
        Seven-Card Stud poker.
      </p>
    </div>

    <div className="feature-card">
      <div className="feature-icon">★</div>
      <h3>Track Your Stats</h3>
      <p>
        Keep track of your performance
        and see how your skills improve.
      </p>
    </div>

    <div className="feature-card">
      <div className="feature-icon">♥</div>
      <h3>Chat and Make Friends</h3>
      <p>
        Connect with other players and
        build your poker community.
      </p>
    </div>
  </div>
</section>

<section className="home-bottom-section">
  <aside className="bottom-ad">
    <span>ADVERTISEMENT</span>
  </aside>

  <div className="getting-started">
    <h2>Getting Started</h2>

    <ol>
      <li>Create an account or play as a guest.</li>
      <li>Join an existing table or create your own.</li>
      <li>Start playing and have fun!</li>
    </ol>
  </div>
</section>

    </div>
  );
}

export default Home;
