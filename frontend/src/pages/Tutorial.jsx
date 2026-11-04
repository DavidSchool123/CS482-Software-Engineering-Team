import { useState } from 'react';
import { Link } from 'react-router-dom';
import './Tutorial.css';

const STREETS = [
  {
    label: 'Third Street',
    cards: [
      { rank: '?', suit: '', hidden: true },
      { rank: '?', suit: '', hidden: true },
      { rank: '4', suit: '♠' },
    ],
    title: 'The first deal: two down, one up',
    description:
      'Everyone antes. Each player gets two private cards and one face-up card. The lowest exposed card posts the bring-in; betting starts with that player.',
    betting: 'Small-bet round',
  },
  {
    label: 'Fourth Street',
    cards: [
      { rank: '?', suit: '', hidden: true },
      { rank: '?', suit: '', hidden: true },
      { rank: '4', suit: '♠' },
      { rank: '9', suit: '♥' },
    ],
    title: 'Fourth Street: another card up',
    description:
      'Every player still in the hand receives a face-up card. From here, the best visible hand acts first. A player may check if nobody has bet.',
    betting: 'Small-bet round',
  },
  {
    label: 'Fifth Street',
    cards: [
      { rank: '?', suit: '', hidden: true },
      { rank: '?', suit: '', hidden: true },
      { rank: '4', suit: '♠' },
      { rank: '9', suit: '♥' },
      { rank: '2', suit: '♣' },
    ],
    title: 'Fifth Street: the bets get bigger',
    description:
      'A third face-up card is dealt to each active player. Betting now uses the big limit. Keep comparing the exposed cards, but remember that opponents still have hidden cards.',
    betting: 'Big-bet round',
  },
  {
    label: 'Sixth Street',
    cards: [
      { rank: '?', suit: '', hidden: true },
      { rank: '?', suit: '', hidden: true },
      { rank: '4', suit: '♠' },
      { rank: '9', suit: '♥' },
      { rank: '2', suit: '♣' },
      { rank: 'K', suit: '♥' },
    ],
    title: 'Sixth Street: one more card up',
    description:
      'Each player still in gets a fourth face-up card. Use the exposed cards to estimate what hands are possible and decide whether the pot is worth pursuing.',
    betting: 'Big-bet round',
  },
  {
    label: 'Seventh Street',
    cards: [
      { rank: '?', suit: '', hidden: true },
      { rank: '?', suit: '', hidden: true },
      { rank: '4', suit: '♠' },
      { rank: '9', suit: '♥' },
      { rank: '2', suit: '♣' },
      { rank: 'K', suit: '♥' },
      { rank: '?', suit: '', hidden: true },
    ],
    title: 'Seventh Street: the final card stays private',
    description:
      'The last card is dealt face down. After the final betting round, players who remain reveal their cards at showdown. The best five-card hand from your seven wins the pot.',
    betting: 'Big-bet round, then showdown',
  },
];

const HANDS = [
  ['1', 'Royal Flush', 'A, K, Q, J, 10 of the same suit.'],
  ['2', 'Straight Flush', 'Five consecutive ranks, all in the same suit.'],
  ['3', 'Four of a Kind', 'Four cards of the same rank.'],
  ['4', 'Full House', 'Three of a kind plus a pair.'],
  ['5', 'Flush', 'Five cards of the same suit, not consecutive.'],
  ['6', 'Straight', 'Five consecutive ranks in mixed suits.'],
  ['7', 'Three of a Kind', 'Three cards of the same rank.'],
  ['8', 'Two Pair', 'Two different pairs.'],
  ['9', 'One Pair', 'Two cards of the same rank.'],
  ['10', 'High Card', 'None of the above; compare your highest cards.'],
];

const QUESTIONS = [
  {
    prompt: 'You want to stay in, and another player has bet. What do you do to match their bet?',
    options: ['Check', 'Call', 'Fold'],
    answer: 'Call',
    explanation: 'A call matches the current bet. Checking is only possible when there is no bet to match.',
  },
  {
    prompt: 'How many of your seven cards count when making your final poker hand?',
    options: ['All seven', 'Your best five', 'Your four face-up cards'],
    answer: 'Your best five',
    explanation: 'At showdown, make the strongest five-card hand you can from all seven cards.',
  },
  {
    prompt: 'On Third Street, which player posts the bring-in?',
    options: ['The player with the lowest exposed card', 'The player with the most chips', 'The dealer'],
    answer: 'The player with the lowest exposed card',
    explanation: 'The lowest door card posts the forced bring-in to start betting.',
  },
];

const SUIT_COLORS = {
  '♥': 'red',
  '♦': 'red',
};

function TutorialCard({ card }) {
  if (card.hidden) {
    return (
      <div className="tutorial-playing-card tutorial-card-back" aria-label="Face-down card">
        <span aria-hidden="true">♛</span>
      </div>
    );
  }

  const suitColor = SUIT_COLORS[card.suit] || 'black';

  return (
    <div className={`tutorial-playing-card ${suitColor}`} aria-label={`${card.rank} ${card.suit}`}>
      <strong>{card.rank}</strong>
      <span>{card.suit}</span>
    </div>
  );
}

function Tutorial() {
  const [streetIndex, setStreetIndex] = useState(0);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [answer, setAnswer] = useState('');
  const [showFeedback, setShowFeedback] = useState(false);

  const street = STREETS[streetIndex];
  const question = QUESTIONS[questionIndex];

  function submitAnswer() {
    if (!answer) return;
    setShowFeedback(true);
  }

  function nextQuestion() {
    setQuestionIndex((index) => (index + 1) % QUESTIONS.length);
    setAnswer('');
    setShowFeedback(false);
  }

  return (
    <main className="tutorial-page">
      <section className="tutorial-hero">
        <div className="tutorial-hero-content">
          <span className="tutorial-eyebrow">THE TABLE GUIDE</span>
          <h1>Learn Seven-Card Stud</h1>
          <p>
            New to the table? Follow a hand from the first deal to showdown,
            learn what each betting choice means, and see which hands win.
          </p>
          <a className="tutorial-primary-link" href="#deal">
            Start the lesson <span aria-hidden="true">↓</span>
          </a>
        </div>
        <div className="tutorial-hero-art" aria-hidden="true">
          <div className="tutorial-hero-card tutorial-hero-card-back">♛</div>
          <div className="tutorial-hero-card tutorial-hero-card-front">
            <span>A</span><strong>♠</strong>
          </div>
          <div className="tutorial-hero-chip">♣</div>
        </div>
        <div className="tutorial-hero-facts">
          <span><strong>2–6</strong> players</span>
          <span><strong>7</strong> cards each</span>
          <span><strong>5</strong> cards make your hand</span>
        </div>
      </section>

      <nav className="tutorial-jump-links" aria-label="Tutorial sections">
        <a href="#deal">How a hand works</a>
        <a href="#betting">Betting actions</a>
        <a href="#hands">Hand rankings</a>
        <a href="#quiz">Quick check</a>
      </nav>

      <section className="tutorial-section tutorial-deal-section" id="deal">
        <div className="tutorial-section-heading">
          <span className="tutorial-step-label">01 / THE HAND</span>
          <h2>Follow the deal, street by street</h2>
          <p>
            In Seven-Card Stud there are no community cards. Your own cards
            arrive over five streets: some face up, some face down.
          </p>
        </div>

        <div className="tutorial-deal-layout">
          <div className="tutorial-street-picker" role="tablist" aria-label="Deal streets">
            {STREETS.map((item, index) => (
              <button
                type="button"
                role="tab"
                aria-selected={streetIndex === index}
                className={streetIndex === index ? 'active' : ''}
                key={item.label}
                onClick={() => setStreetIndex(index)}
              >
                <span className="tutorial-street-number">{index + 1}</span>
                <span>{item.label}</span>
              </button>
            ))}
          </div>

          <article className="tutorial-street-card" role="tabpanel">
            <div className="tutorial-street-card-header">
              <span className="tutorial-street-kicker">{street.label}</span>
              <span className="tutorial-bet-badge">{street.betting}</span>
            </div>
            <h3>{street.title}</h3>
            <p>{street.description}</p>
            <div className="tutorial-example-table">
              <span className="tutorial-example-label">YOUR CARDS SO FAR</span>
              <div className="tutorial-example-cards">
                {street.cards.map((card, index) => (
                  <TutorialCard key={`${streetIndex}-${index}`} card={card} />
                ))}
              </div>
              <span className="tutorial-hidden-note">
                Face-down cards are private. Only you can see them.
              </span>
            </div>
            <div className="tutorial-step-controls">
              <button
                type="button"
                className="tutorial-previous"
                disabled={streetIndex === 0}
                onClick={() => setStreetIndex((index) => Math.max(0, index - 1))}
              >
                Previous
              </button>
              <span>{streetIndex + 1} of {STREETS.length}</span>
              <button
                type="button"
                className="tutorial-next"
                disabled={streetIndex === STREETS.length - 1}
                onClick={() =>
                  setStreetIndex((index) => Math.min(STREETS.length - 1, index + 1))
                }
              >
                Next street <span aria-hidden="true">→</span>
              </button>
            </div>
          </article>
        </div>

        <div className="tutorial-key-rule">
          <span className="tutorial-key-rule-icon" aria-hidden="true">!</span>
          <p>
            <strong>Remember:</strong> you get seven cards, but you only use
            your best five-card poker hand. Your face-up cards are visible to
            everyone; your face-down cards are yours alone.
          </p>
        </div>
      </section>

      <section className="tutorial-section tutorial-betting-section" id="betting">
        <div className="tutorial-section-heading">
          <span className="tutorial-step-label">02 / YOUR TURN</span>
          <h2>Know your options</h2>
          <p>
            On your turn, choose based on whether there is already a bet and
            whether you want to keep playing.
          </p>
        </div>

        <div className="tutorial-action-grid">
          <article className="tutorial-action-card">
            <span className="tutorial-action-icon">↘</span>
            <h3>Fold</h3>
            <p>Give up this hand. You won’t put in more chips, but you can’t win the pot.</p>
          </article>
          <article className="tutorial-action-card">
            <span className="tutorial-action-icon">—</span>
            <h3>Check</h3>
            <p>Pass the action without betting. You can check only when there’s no bet to match.</p>
          </article>
          <article className="tutorial-action-card">
            <span className="tutorial-action-icon">=</span>
            <h3>Call</h3>
            <p>Put in enough chips to match the current bet and stay in the hand.</p>
          </article>
          <article className="tutorial-action-card">
            <span className="tutorial-action-icon">＋</span>
            <h3>Bet</h3>
            <p>Make the first wager in a round when no one has bet yet.</p>
          </article>
          <article className="tutorial-action-card">
            <span className="tutorial-action-icon">↑</span>
            <h3>Raise</h3>
            <p>Match the current bet, then increase it. Other players must respond to the higher amount.</p>
          </article>
        </div>

        <div className="tutorial-limit-panel">
          <div>
            <span className="tutorial-step-label">FIXED-LIMIT BETTING</span>
            <h3>Bet sizes depend on the table</h3>
            <p>
              The game uses a small fixed bet on Third and Fourth Street, then
              a larger fixed bet on Fifth, Sixth, and Seventh Street.
            </p>
          </div>
          <div className="tutorial-limit-table-wrap">
            <table className="tutorial-limit-table">
              <thead>
                <tr><th>Table</th><th>Small bet</th><th>Big bet</th></tr>
              </thead>
              <tbody>
                <tr><th>Low</th><td>5</td><td>10</td></tr>
                <tr><th>Medium</th><td>10</td><td>20</td></tr>
                <tr><th>High</th><td>25</td><td>50</td></tr>
              </tbody>
            </table>
            <span className="tutorial-chip-note">Amounts are in chips</span>
          </div>
        </div>
      </section>

      <section className="tutorial-section tutorial-hands-section" id="hands">
        <div className="tutorial-section-heading">
          <span className="tutorial-step-label">03 / SHOWDOWN</span>
          <h2>Which hand wins?</h2>
          <p>
            At showdown, compare each player’s best five-card hand. The
            strongest hand wins the pot. Rankings go from strongest to weakest:
          </p>
        </div>

        <div className="tutorial-hands-list">
          {HANDS.map(([rank, name, description]) => (
            <article className="tutorial-hand-row" key={name}>
              <span className="tutorial-hand-rank">{rank.padStart(2, '0')}</span>
              <div>
                <h3>{name}</h3>
                <p>{description}</p>
              </div>
            </article>
          ))}
        </div>
        <p className="tutorial-tie-note">
          If players have the same hand type, compare the card ranks that make
          the hand, then the remaining high cards. Suits do not break ties at showdown.
        </p>
      </section>

      <section className="tutorial-quiz-section" id="quiz">
        <div className="tutorial-quiz-heading">
          <span className="tutorial-step-label">04 / QUICK CHECK</span>
          <h2>Ready for the table?</h2>
          <p>Try a few quick questions to check what you’ve learned.</p>
        </div>
        <div className="tutorial-quiz-card">
          <span className="tutorial-quiz-count">
            QUESTION {questionIndex + 1} <span>/ {QUESTIONS.length}</span>
          </span>
          <h3>{question.prompt}</h3>
          <div className="tutorial-quiz-options">
            {question.options.map((option) => (
              <button
                type="button"
                key={option}
                className={[
                  'tutorial-quiz-option',
                  answer === option ? 'selected' : '',
                  showFeedback && option === question.answer ? 'correct' : '',
                  showFeedback && answer === option && answer !== question.answer
                    ? 'incorrect'
                    : '',
                ].filter(Boolean).join(' ')}
                aria-pressed={answer === option}
                disabled={showFeedback}
                onClick={() => setAnswer(option)}
              >
                <span>{option}</span>
                {showFeedback && option === question.answer && <span aria-hidden="true">✓</span>}
              </button>
            ))}
          </div>
          {showFeedback && (
            <p className={`tutorial-quiz-feedback ${answer === question.answer ? 'correct' : ''}`} role="status">
              <strong>{answer === question.answer ? 'That’s right!' : 'Not quite.'}</strong>{' '}
              {question.explanation}
            </p>
          )}
          <div className="tutorial-quiz-footer">
            <span>{questionIndex + 1} / {QUESTIONS.length}</span>
            {!showFeedback ? (
              <button
                type="button"
                className="tutorial-quiz-submit"
                disabled={!answer}
                onClick={submitAnswer}
              >
                Check answer
              </button>
            ) : (
              <button
                type="button"
                className="tutorial-quiz-submit"
                onClick={nextQuestion}
              >
                {questionIndex === QUESTIONS.length - 1 ? 'Start again' : 'Next question'}
                <span aria-hidden="true">→</span>
              </button>
            )}
          </div>
        </div>
      </section>

      <section className="tutorial-play-cta">
        <div>
          <span className="tutorial-step-label">YOU’RE READY</span>
          <h2>Take a seat and put it into practice.</h2>
          <p>You can always come back to this guide between hands.</p>
        </div>
        <Link to="/lobby" className="tutorial-primary-link">
          Go to the lobby <span aria-hidden="true">→</span>
        </Link>
      </section>

      <aside className="tutorial-availability-note">
        <strong>About the current game:</strong> the table currently deals
        Third Street and supports betting on that street. Later streets are
        part of the rules explained above but are not yet playable in the app.
      </aside>
    </main>
  );
}

export default Tutorial;
