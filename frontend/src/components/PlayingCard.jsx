
import './PlayingCard.css';

const SUITS = {
  Hearts: { symbol: '♥', color: 'red' },
  Diamonds: { symbol: '♦', color: 'red' },
  Clubs: { symbol: '♣', color: 'black' },
  Spades: { symbol: '♠', color: 'black' },
};

const RANKS = {
  Ace: 'A',
  Jack: 'J',
  Queen: 'Q',
  King: 'K',
  '1': 'A',
  '11': 'J',
  '12': 'Q',
  '13': 'K',
};

function PlayingCard({ card, hidden = false }) {
  if (hidden || !card) {
    return (
      <div
        className="stud-card stud-card-back"
        role="img"
        aria-label="Face-down card"
      >
        <div className="stud-card-back-pattern">
          <span>♠</span>
        </div>
      </div>
    );
  }

  const suit = SUITS[card.suit] || {
    symbol: card.suit,
    color: 'black',
  };

  const rank = RANKS[String(card.rank)] || String(card.rank);

  return (
    <div
      className={`stud-card stud-card-front ${
        suit.color === 'red' ? 'stud-card-red' : ''
      }`}
      role="img"
      aria-label={`${rank} of ${card.suit}`}
    >
      <div className="stud-card-corner stud-card-corner-top">
        <span>{rank}</span>
        <span>{suit.symbol}</span>
      </div>

      <div className="stud-card-center">
        <span className="stud-card-main-suit">
          {suit.symbol}
        </span>
      </div>

      <div className="stud-card-corner stud-card-corner-bottom">
        <span>{rank}</span>
        <span>{suit.symbol}</span>
      </div>
    </div>
  );
}

export default PlayingCard;
