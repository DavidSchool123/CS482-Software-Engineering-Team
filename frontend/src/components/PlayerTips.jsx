
import { useState } from 'react';
import { getStrategicTip } from '../utils/pokerTipEngine';
import './PlayerTips.css';

const TIPS_STORAGE_KEY = 'pokerface-player-tips-enabled';

function LightbulbIcon() {
  return (
    <svg
      width="19"
      height="19"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M9 18h6M10 22h4M8.1 14.5A7 7 0 1 1 16 14.5c-.8.7-1.2 1.6-1.4 2.5H9.5c-.2-.9-.6-1.8-1.4-2.5Z" />
    </svg>
  );
}

export default function PlayerTips({
  game,
  potSize,
  amountToCall,
  myChips,
  isMyTurn,
  canAct,
  raiseLimitReached
}) {
  const [tipsEnabled, setTipsEnabled] = useState(() => {
    try {
      return localStorage.getItem(TIPS_STORAGE_KEY) !== 'false';
    } catch {
      return true;
    }
  });

  function toggleTips() {
    const nextValue = !tipsEnabled;
    setTipsEnabled(nextValue);

    try {
      localStorage.setItem(TIPS_STORAGE_KEY, String(nextValue));
    } catch {
      // The toggle still works when storage is unavailable.
    }
  }

  const tip = tipsEnabled
    ? getStrategicTip({
        game,
        potSize,
        amountToCall,
        myChips,
        isMyTurn,
        canAct,
        raiseLimitReached
      })
    : null;

  return (
    <section className="player-tips" aria-label="Poker Tips">
      <div className="player-tips-header">
        <div className="player-tips-heading">
          <LightbulbIcon />
          <h3>Poker Tips</h3>
        </div>

        <label className="player-tips-toggle">
          <span>{tipsEnabled ? 'On' : 'Off'}</span>
          <input
            type="checkbox"
            checked={tipsEnabled}
            onChange={toggleTips}
          />
          <span className="player-tips-switch" aria-hidden="true" />
        </label>
      </div>

      {tipsEnabled ? (
        tip ? (
          <div className="player-tips-content">
            <h4>{tip.title}</h4>

            <p className="player-tips-message">
              {tip.message}
            </p>

            {tip.secondary && (
              <p className="player-tips-secondary">
                <strong>Also worth noting:</strong>{' '}
                {tip.secondary}
              </p>
            )}

            {tip.detail && (
              <details
                key={tip.id}
                className="player-tips-details"
              >
                <summary>Why this matters</summary>
                <p>{tip.detail}</p>
              </details>
            )}
          </div>
        ) : (
          <p className="player-tips-empty">
            Strategic tips will appear while you're playing.
          </p>
        )
      ) : (
        <p className="player-tips-empty">
          Tips are turned off.
        </p>
      )}
    </section>
  );
}
