
function PlayingCard({ card, hidden = false }) {
  if (hidden || !card) {
    return (
      <div
        className="stud-card stud-card-back"
        role="img"
        aria-label="Face-down card"
      />
    );
  }

  const suitSymbols = {
    Hearts: '♥',
    Diamonds: '♦',
    Clubs: '♣',
    Spades: '♠',
  };

  const symbol = suitSymbols[card.suit] || card.suit;
  const isRed = ['Hearts', 'Diamonds', '♥', '♦'].includes(card.suit);

  return (
    <div
      className={`stud-card ${isRed ? 'stud-card-red' : ''}`}
      role="img"
      aria-label={`${card.rank} of ${card.suit}`}
    >
      <span className="stud-card-rank">{card.rank}</span>
      <span className="stud-card-suit">{symbol}</span>
    </div>
  );
}

export default PlayingCard;
