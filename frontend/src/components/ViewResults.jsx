
import './ViewResults.css';

const SUITS = {
  Hearts: '♥',
  Diamonds: '♦',
  Clubs: '♣',
  Spades: '♠'
};

const RANKS = {
  Ace: 'A',
  King: 'K',
  Queen: 'Q',
  Jack: 'J',
  '1': 'A',
  '11': 'J',
  '12': 'Q',
  '13': 'K'
};

function ResultCards({ cards = [] }) {
  return (
    <div
      className="view-results-cards"
      aria-label="Revealed cards"
    >
      {cards.map((card, index) => {
        const visible =
          card?.rank != null && card?.suit != null;

        const symbol = SUITS[card?.suit] || card?.suit || '';

        const rank = visible
          ? RANKS[String(card.rank)] || String(card.rank)
          : '';

        const red =
          card?.suit === 'Hearts' ||
          card?.suit === 'Diamonds';

        return (
          <span
            key={index}
            className={`view-results-card ${
              visible
                ? red
                  ? 'is-red'
                  : ''
                : 'is-hidden'
            }`}
            aria-label={
              visible
                ? `${rank} of ${card.suit}`
                : 'Face-down card'
            }
          >
            {visible ? (
              <>
                {rank}
                <span>{symbol}</span>
              </>
            ) : (
              '♠'
            )}
          </span>
        );
      })}
    </div>
  );
}

export default function ViewResults({
  game,
  nextHandSeconds,
  getPlayerName,
  onClose
}) {
  if (game?.status !== 'Completed') {
    return null;
  }

  const results = game.handResults || [];
  const players = game.players || [];

  const showdownPlayers = game.isShowdown
    ? players.filter(player => !player.hasFolded)
    : [];

  const multipleWinners = results.length > 1;

  // Use correct grammar for the current player.
  const getWinnerMessage = (playerId) => {
    const name = getPlayerName(playerId);

    if (name === 'You') {
      return 'You Win!';
    }

    return `${name} Wins!`;
  };

  return (
    <div
      className="view-results-backdrop"
      role="presentation"
    >
      <section
        className="view-results-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="view-results-title"
      >
        <button
          className="view-results-close"
          type="button"
          onClick={onClose}
          aria-label="Close results and view table"
        >
          ×
        </button>

        <div className="view-results-eyebrow">
          HAND COMPLETE
        </div>

        <h2 id="view-results-title">
          {multipleWinners
            ? '🏆 Split Pot!'
            : '🏆 Hand Results'}
        </h2>

        {results.length > 0 ? (
          <div className="view-results-winners">
            {results.map((result, index) => (
              <div
                className="view-results-winner"
                key={`${String(result.playerId)}-${index}`}
              >
                <strong>
                  {getWinnerMessage(result.playerId)}
                </strong>

                <span className="view-results-payout">
                  +{result.amountWon} chips
                </span>

                {result.handName && (
                  <span className="view-results-hand">
                    {result.handName}
                  </span>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p>The hand is complete.</p>
        )}

        {game.isShowdown && showdownPlayers.length > 0 ? (
          <div className="view-results-showdown">
            <h3>Showdown</h3>

            <p>
              All players who reached showdown
              revealed their cards.
            </p>

            {showdownPlayers.map(player => (
              <div
                className="view-results-player"
                key={String(player.playerId)}
              >
                <strong>
                  {getPlayerName(player.playerId)}
                </strong>

                <ResultCards cards={player.cards} />
              </div>
            ))}
          </div>
        ) : (
          <p className="view-results-no-showdown">
            Everyone else folded. No showdown required.
          </p>
        )}

        <div
          className="view-results-countdown"
          role="timer"
        >
          {nextHandSeconds == null
            ? 'Waiting for next hand...'
            : nextHandSeconds > 0
              ? `Next hand in ${nextHandSeconds}s`
              : 'Starting next hand...'}
        </div>

        <button
          type="button"
          className="view-results-view-table"
          onClick={onClose}
        >
          View Table
        </button>
      </section>
    </div>
  );
}
