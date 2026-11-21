import { bestFiveIndices } from '../utils/BestFiveCards';


import { useEffect, useRef, useState } from 'react';

import {

  Link,

  useParams,
  useNavigate,

  useSearchParams,

} from 'react-router-dom';

import PlayingCard from '../components/PlayingCard';

import ViewResults from '../components/ViewResults';
import { playPokerSound } from '../utils/PokerSounds';

import './PokerTable.css';

import './PokerChips.css';

import './PokerTableLayout.css';



const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';



// All six possible seats around a Seven-Card Stud table.

const seatPositions = [

  'top',

  'left',

  'left-lower',

  'right',

  'right-upper',

  'bottom',

];



// Consistent avatars for humans and one shared avatar for bots.

const BOT_AVATAR = '/bot-avatar.svg';



function getPlayerAvatar(playerId) {

  const id = String(playerId ?? '');

  if (id.startsWith('bot-')) return BOT_AVATAR;

  return `https://api.dicebear.com/9.x/adventurer/svg?seed=${encodeURIComponent(id)}`;

}



const TABLE_BETS = {

  Low: 5,

  Medium: 10,

  High: 25,

};



function EmptySeat({ position }) {

  return (

    <div className={`stud-seat stud-seat-empty seat-${position}`} aria-label="Open seat">

      <div className="stud-empty-avatar" aria-hidden="true">+</div>

      <span className="stud-empty-label">Open seat</span>

    </div>

  );

}



// Decorative casino-style chips. The amount shown is always from the API.



const POT_DENOMINATIONS = [

  { value: 25, tone: "green" },

  { value: 10, tone: "blue" },

  { value: 5, tone: "red" },

  { value: 1, tone: "white" },

];



function PotChipStacks({ amount = 0 }) {
  let remaining = Math.max(0, Math.floor(Number(amount) || 0));
  if (!remaining) return null;

  const stacks = POT_DENOMINATIONS.flatMap(({ value, tone }) => {
    const count = Math.floor(remaining / value);
    remaining %= value;
    return count ? [{ value, tone, count }] : [];
  });

  return (
    <div className="poker-pot-chips casino-pot-chips" aria-label={`Pot worth ${amount} chips`}>
      {stacks.map(({ value, tone, count }) => {
        const visibleCount = Math.min(count, 5);
        return (
          <div
            className={`casino-chip-stack casino-chip-${tone}`}
            key={value}
            title={`${count} chips of denomination ${value}`}
          >
            {Array.from({ length: visibleCount }, (_, index) => (
              <span
                className="casino-chip"
                key={index}
                style={{ '--layer': index }}
                aria-hidden="true"
              >
                {index === visibleCount - 1 && (
                  <span className="casino-chip-value">{value}</span>
                )}
              </span>
            ))}
          </div>
        );
      })}
    </div>
  );
}

// Floating player identity and cards; game state remains backend-driven.

function PokerSeat({

  playerId,

  name,

  position,

  cards = [],

  chips,

  isBringIn = false,

  isTurn = false,

  hasFolded = false,

  contribution = 0,

  isYou = false,

  turnSeconds = null,
  playerAction = null,
  isWinner = false,
  highlightWinningFive = false,
  newlyDealt = false,
  dealStartIndex = 0,
  dealBatch = null,

}) {

  const bestIndices = highlightWinningFive ? bestFiveIndices(cards) : null;

  return (

    <div data-player-id={String(playerId)} className={[

      'stud-seat',

      'stud-seat-floating',

      `seat-${position}`,

      isYou ? 'stud-seat-you' : '',

      isTurn ? 'stud-seat-active' : '',

      hasFolded ? 'stud-seat-folded' : '',
      isWinner ? 'stud-seat-winner' : '',
      newlyDealt ? 'stud-seat-new-deal' : '',

    ].filter(Boolean).join(' ')}>

      {playerAction && (
        <div key={playerAction.id} className={`stud-action-popup action-${playerAction.action}`}>
          {playerAction.action.toUpperCase()}
          {playerAction.amount > 0 ? ` +${playerAction.amount}` : ''}
        </div>
      )}
      {isWinner && <span className="stud-winner-crown">🏆 WINNER</span>}
      <div className="stud-floating-identity">

          <div className="stud-avatar-frame">
            {isTurn && turnSeconds !== null && (
              <span
                className="stud-avatar-timer-ring"
                style={{
                  '--timer-progress': `${Math.min(100, Math.max(0, (turnSeconds / 30) * 100))}%`,
                  '--timer-color': turnSeconds <= 10
                    ? '#ef4444'
                    : turnSeconds <= 15
                      ? '#f59e0b'
                      : '#b77aff',
                }}
                aria-hidden="true"
              />
            )}
            <img
              className="stud-avatar-image"
              src={getPlayerAvatar(playerId)}
              alt=""
              draggable="false"
            />
          </div>

        <div className="stud-floating-player-info">

          <strong className="stud-seat-name">{name}</strong>

          {chips != null && (

            <span className="stud-seat-balance">🪙 {chips}</span>

          )}

        </div>

      </div>



      {(hasFolded || isTurn || isBringIn || contribution > 0) && (

        <div className="stud-floating-status">

          {hasFolded ? (

            <span className="stud-action-badge folded">Folded</span>

          ) : (

            <>

              {isTurn && (

                <span className="stud-action-badge active">

                  {isYou ? 'Your turn' : 'Playing'}

                </span>

              )}

              {isTurn && turnSeconds !== null && (

                <span className="stud-action-badge stud-seat-countdown">{turnSeconds}s</span>

              )}

              {isBringIn && (

                <span className="stud-action-badge">Bring-in</span>

              )}

            </>

          )}

          {contribution > 0 && (

            <span className="stud-action-badge bet">Bet: {contribution}</span>

          )}

        </div>

      )}



      {cards.length > 0 && (

        <div className="stud-hole-cards" style={{ '--card-count': cards.length }}>

          {cards.map((card, index) => (

            <PlayingCard

              key={index}
              className={[newlyDealt && index >= dealStartIndex ? 'stud-card-dealing' : '', bestIndices ? (bestIndices.includes(index) ? 'stud-winning-five-card' : 'stud-other-card') : ''].filter(Boolean).join(' ')}
              style={newlyDealt && index >= dealStartIndex ? {
                '--deal-order': index - dealStartIndex,
                '--deal-batch': dealBatch,
                '--deal-x': position.includes('left') ? '170px' : position.includes('right') ? '-170px' : '0px',
                '--deal-y': position === 'top' ? '130px' : position === 'bottom' ? '-130px' : position.includes('lower') ? '-55px' : '55px',
              } : undefined}
              card={card}

              hidden={!card || card.rank == null || card.suit == null}

            />

          ))}

        </div>

      )}

    </div>

  );

}



function Table() {

  const { tableId: joinCode } = useParams();
  const navigate = useNavigate();



  // The lobby adds this query parameter when someone chooses Observe.

  const [searchParams] = useSearchParams();



  const requestedSpectatorMode =

    searchParams.get('spectate') === 'true';



  const [chatMessage, setChatMessage] = useState('');

  const [chatMessages, setChatMessages] = useState([]);



  const [table, setTable] = useState(null);
  const [leavingTable, setLeavingTable] = useState(false);

  // Keep the player's seat reserved while their table page is open.
  useEffect(() => {
    if (!table?.id || !table?.isPlayer) return undefined;

    let stopped = false;
    let sending = false;

    async function sendHeartbeat() {
      if (stopped || sending) return;

      sending = true;

      try {
        const response = await fetch(
          `${API_URL}/api/tables/${table.id}/heartbeat`,
          { method: 'POST', credentials: 'include' }
        );

        if (!response.ok && !stopped) {
          console.warn('Table Heartbeat failed:', response.status);
        }
      } catch (error) {
        if(!stopped) {
          console.error('Unable to send heartbeat:', error);
        }
      } finally {
        sending = false;
      }
    }

    // Send immediately, then every 10 seconds.
    sendHeartbeat();

    const intervalId = window.setInterval(sendHeartbeat, 10000);

    return () => {
      stopped = true;
      window.clearInterval(intervalId);
    };
  }, [table?.id, table?.isPlayer]);

    
  const [game, setGame] = useState(null);



  // Also recognize non-players who open a table directly by join code.

  const isSpectator =

    requestedSpectatorMode || table?.isPlayer === false;



  const [startingGame, setStartingGame] = useState(false);

  const [submittingAction, setSubmittingAction] = useState(false);



  const [remainingSeconds, setRemainingSeconds] = useState(null);

  const [playerActions, setPlayerActions] = useState({});
  const [streetAnnouncement, setStreetAnnouncement] = useState(null);
  const [payoutEffect, setPayoutEffect] = useState(null);
  const [newlyDealtPlayers, setNewlyDealtPlayers] = useState([]);
  const [dealStartIndices, setDealStartIndices] = useState({});
  const [dealBatch, setDealBatch] = useState(0);
  const [chipFlights, setChipFlights] = useState([]);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const soundEnabledRef = useRef(false);
  const feltRef = useRef(null);
  const chipFlightSequence = useRef(0);
  const animationTimers = useRef([]);
  const animateFirstDeal = useRef(false);
  const warnedTurnDeadline = useRef(null);

  function toggleSound() {
    const next = !soundEnabledRef.current;
    soundEnabledRef.current = next;
    setSoundEnabled(next);
    if (next) playPokerSound('chip');
  }

  function launchChipFlights(actions, isPayout = false) {
    const felt = feltRef.current;
    if (!felt || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const bounds = felt.getBoundingClientRect();
    const center = { x: bounds.width / 2, y: bounds.height / 2 };
    const flights = [];
    for (const action of actions) {
      const id = String(action.playerId);
      const seat = [...felt.querySelectorAll('[data-player-id]')].find(el => el.dataset.playerId === id);
      if (!seat) continue;
      const rect = seat.getBoundingClientRect();
      const point = { x: rect.left - bounds.left + rect.width / 2, y: rect.top - bounds.top + rect.height / 2 };
      for (let i = 0; i < (isPayout ? 4 : 2); i++) {
        const start = isPayout ? center : point;
        const end = isPayout ? point : center;
        flights.push({ id: ++chipFlightSequence.current, x: start.x, y: start.y,
          dx: end.x - start.x, dy: end.y - start.y, delay: i * 90 });
      }
    }
    if (!flights.length) return;
    setChipFlights(previous => [...previous, ...flights]);
    const ids = new Set(flights.map(f => f.id));
    const timer = window.setTimeout(() => setChipFlights(previous => previous.filter(f => !ids.has(f.id))), 1100);
    animationTimers.current.push(timer);
  }

  useEffect(() => () => animationTimers.current.forEach(window.clearTimeout), []);
  const previousVisualGame = useRef(null);
  const seenActionIds = useRef(new Set());
  const initializedEventGameId = useRef(null);

  const [nextHandSeconds, setNextHandSeconds] = useState(null);

  const [showResultsOverlay, setShowResultsOverlay] = useState(true);

  const [revealDelayElapsed, setRevealDelayElapsed] = useState(false);



  const [loading, setLoading] = useState(true);

  const [error, setError] = useState(null);



  const [gameNotice, setGameNotice] = useState(

    'Waiting for players to start the game.'

  );



  useEffect(() => {

    let cancelled = false;



    async function fetchTable() {

      try {

        setLoading(true);

        setError(null);



        // Spectators navigate using the public table ID.

        // Regular players continue using the existing join-code lookup.

        const tableEndpoint = requestedSpectatorMode

          ? `${API_URL}/api/tables/id/${encodeURIComponent(joinCode)}`

          : `${API_URL}/api/tables/${encodeURIComponent(joinCode)}`;



        const response = await fetch(tableEndpoint, {

          credentials: 'include',

          cache: 'no-store',

        });



        const data = await response.json();



        if (!response.ok) {

          throw new Error(

            data.error ||

              (response.status === 404

                ? 'Table not found. Check the join code.'

                : 'Unable to load table information.')

          );

        }



        if (cancelled) return;



        setTable(data);



        // Load an existing game if one is already running.

        if (data.currentGameId) {

          const gameResponse = await fetch(

            `${API_URL}/api/games/${data.currentGameId}`,

            {

              credentials: 'include',

              cache: 'no-store',

            }

          );



          const gameData = await gameResponse.json();



          if (!gameResponse.ok) {

            throw new Error(

              gameData.error ||

                gameData.message ||

                'Unable to load existing game.'

            );

          }



          if (!cancelled) {

            setGame(gameData);

            setGameNotice('Game in progress. Cards loaded.');

          }

        }

      } catch (err) {

        if (!cancelled) {

          setError(err.message);

        }

      } finally {

        if (!cancelled) {

          setLoading(false);

        }

      }

    }



    fetchTable();



    return () => {

      cancelled = true;

    };

  }, [joinCode, requestedSpectatorMode]);



  async function handleLeaveTable() {
    if (!table?.id || leavingTable || !table.isPlayer) return;

    setLeavingTable(true);

    try {
      const response = await fetch(`${API_URL}/api/tables/${table.id}/leave`, {
        method: 'POST',
        credentials: 'include',
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || data.error || 'Unable to leave table.');
      }

      // The server has removed our seat and refunded remaining table chips.
      navigate('/lobby', { replace: true });
    } catch (error) {
      console.error('Unable to leave table:', error);
      setGameNotice(error.message || 'Unable to leave table.');
      setLeavingTable(false);
    }
  }



  function sendChat(event) {

    event.preventDefault();



    const message = chatMessage.trim();

    if (!message) return;



    setChatMessages((current) => [

      ...current,

      { name: 'You', message },

    ]);



    setChatMessage('');



    setGameNotice(

      'Chat is a local preview only; messages are not sent to other players.'

    );

  }



  // Retrieve the latest game state after betting actions.

  async function refreshGame(gameId) {

    const response = await fetch(

      `${API_URL}/api/games/${gameId}`,

      {

        credentials: 'include',

        cache: 'no-store',

      }

    );



    const data = await response.json();



    if (!response.ok) {

      throw new Error(

        data.error || data.message || 'Unable to refresh game.'

      );

    }



    setGame(data);



    return data;

  }



  useEffect(() => {

    if (!game?.turnDeadline) {

      setRemainingSeconds(null);

      return;

    }



    const deadline = new Date(game.turnDeadline).getTime();



    const updateCountdown = () => {

      const remaining = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));

      setRemainingSeconds(remaining);

    };



    updateCountdown();



    const interval = setInterval(updateCountdown, 250);

    return () => clearInterval(interval);

  }, [game?.turnDeadline]);



  // Warn only the seated player whose turn is expiring. The deadline
  // identifies the turn so polling/re-renders cannot repeat the cue.
  useEffect(() => {
    if (!soundEnabled || game?.status !== 'In Progress' || !game?.turnDeadline ||
        remainingSeconds === null || remainingSeconds > 5 || remainingSeconds <= 0 ||
        isSpectator) return;
    const currentPlayer = (game.players || []).find(p => p.isCurrentPlayer);
    if (!currentPlayer || String(currentPlayer.playerId) !== String(game.currentTurnPlayerId)) return;
    const turnKey = `${game.gameId}:${game.turnDeadline}:${game.currentTurnPlayerId}`;
    if (warnedTurnDeadline.current === turnKey) return;
    warnedTurnDeadline.current = turnKey;
    playPokerSound('timer-warning');
  }, [remainingSeconds, soundEnabled, game?.gameId, game?.status,
      game?.turnDeadline, game?.currentTurnPlayerId, game?.players, isSpectator]);

  // P53: Refresh for both seated players and spectators.

  // The backend scheduler advances hands; this only observes changes.

  useEffect(() => {

    let cancelled = false;

    let refreshing = false;



    async function refreshTableAndGame() {

      if (refreshing) return;

      refreshing = true;



      try {

        const tableEndpoint = requestedSpectatorMode

          ? `${API_URL}/api/tables/id/${encodeURIComponent(joinCode)}`

          : `${API_URL}/api/tables/${encodeURIComponent(joinCode)}`;



        const tableResponse = await fetch(tableEndpoint, {

          credentials: 'include',

          cache: 'no-store'

        });

        const tableData = await tableResponse.json();

        if (!tableResponse.ok) {

          throw new Error(tableData.error || 'Unable to refresh table.');

        }

        if (cancelled) return;



        setTable(tableData);



        if (!tableData.currentGameId) {

          setGame(null);

          return;

        }



        const gameResponse = await fetch(

          `${API_URL}/api/games/${tableData.currentGameId}`,

          { credentials: 'include', cache: 'no-store' }

        );

        const gameData = await gameResponse.json();

        if (!gameResponse.ok) {

          throw new Error(gameData.error || 'Unable to refresh game.');

        }

        if (!cancelled) setGame(gameData);

      } catch (err) {

        if (!cancelled) console.error('Live game refresh failed:', err);

      } finally {

        refreshing = false;

      }

    }



    const intervalId = window.setInterval(refreshTableAndGame, 2000);

    return () => {

      cancelled = true;

      window.clearInterval(intervalId);

    };

  }, [requestedSpectatorMode, joinCode]);



  // Compare server snapshots; the 2-second poll must not replay effects.
  useEffect(() => {
    if (!game?.gameId) {
      previousVisualGame.current = null;
      initializedEventGameId.current = null;
      seenActionIds.current = new Set();
      setPlayerActions({});
      return;
    }
    const id = String(game.gameId);
    const events = game.actionEvents || [];
    const counts = Object.fromEntries((game.players || []).map(p => [String(p.playerId), (p.cards || []).length]));
    const previous = previousVisualGame.current;
    const firstObservation = !previous;
    const explicitFirstDeal = firstObservation && animateFirstDeal.current;
    if (explicitFirstDeal) animateFirstDeal.current = false;
    const newHand = Boolean(previous && previous.id !== id);

    // On a reload, skip effects for events already in progress/history.
    if (initializedEventGameId.current !== id) {
      initializedEventGameId.current = id;
      seenActionIds.current = new Set(events.map(event => String(event.id)));
    } else {
      const unseen = events.filter(event => !seenActionIds.current.has(String(event.id)));
      for (const event of unseen) seenActionIds.current.add(String(event.id));
      if (seenActionIds.current.size > 200) seenActionIds.current = new Set(events.map(event => String(event.id)));
      if (unseen.length) {
        const latest = {};
        unseen.forEach(event => { latest[String(event.playerId)] = event; });
        setPlayerActions(old => ({ ...old, ...latest }));
        const wagers = unseen.filter(event => Number(event.amount) > 0);
        if (wagers.length) launchChipFlights(wagers);
        if (soundEnabledRef.current) unseen.forEach(event => playPokerSound(event.action === 'fold' ? 'fold' : Number(event.amount) > 0 ? 'chip' : 'check'));
      }
    }

    // A newly observed hand is dealt from the center. Existing hands loaded
    // on page refresh are intentionally not replayed.
    const dealt = firstObservation && !explicitFirstDeal ? [] : (game.players || []).filter(p =>
      (p.cards || []).length > (newHand || explicitFirstDeal ? 0 : previous?.counts[String(p.playerId)] || 0)
    );
    if (dealt.length) {
      setDealStartIndices(Object.fromEntries(dealt.map(p => [String(p.playerId), newHand || explicitFirstDeal ? 0 : previous?.counts[String(p.playerId)] || 0])));
      setNewlyDealtPlayers(dealt.map(p => String(p.playerId)));
      setDealBatch(n => n + 1);
      if (soundEnabledRef.current) {
        // A short sequence rather than one loud sound for every card/player.
        const numberOfCards = Math.min(5, Math.max(...dealt.map(p => (p.cards || []).length - (newHand || explicitFirstDeal ? 0 : previous?.counts[String(p.playerId)] || 0))));
        for (let i = 0; i < numberOfCards; i++) {
          const timer = window.setTimeout(() => playPokerSound('deal'), i * 115);
          animationTimers.current.push(timer);
        }
      }
    }
    if (!firstObservation && !newHand && game.street > previous.street) {
      setStreetAnnouncement({ id: `${id}-${game.street}`, street: game.street });
    }
    if (!firstObservation && !newHand && previous.status !== 'Completed' && game.status === 'Completed') {
      setPayoutEffect({ id, winners: game.handResults || [] });
      const winners = (game.handResults || []).filter(r => Number(r.amountWon) > 0);
      launchChipFlights(winners, true);
      if (soundEnabledRef.current) playPokerSound('win');
    }
    previousVisualGame.current = { id, street: game.street, status: game.status, counts };
  }, [game]);

  useEffect(() => {
    if (!Object.keys(playerActions).length) return undefined;
    const timer = setTimeout(() => setPlayerActions({}), 1700);
    return () => clearTimeout(timer);
  }, [playerActions]);

  useEffect(() => {
    if (!streetAnnouncement) return undefined;
    const timer = setTimeout(() => setStreetAnnouncement(null), 1500);
    return () => clearTimeout(timer);
  }, [streetAnnouncement]);

  useEffect(() => {
    if (!newlyDealtPlayers.length) return undefined;
    const timer = setTimeout(() => setNewlyDealtPlayers([]), 1300);
    return () => clearTimeout(timer);
  }, [newlyDealtPlayers, dealBatch]);

  useEffect(() => {
    if (!payoutEffect) return undefined;
    const timer = setTimeout(() => setPayoutEffect(null), 2500);
    return () => clearTimeout(timer);
  }, [payoutEffect]);

  // P53: The countdown is based on the server's persisted deadline.

  useEffect(() => {

    if (game?.status !== 'Completed' || !game?.nextHandAt) {

      setNextHandSeconds(null);

      return undefined;

    }



    const deadline = new Date(game.nextHandAt).getTime();

    const update = () => {

      setNextHandSeconds(

        Math.max(0, Math.ceil((deadline - Date.now()) / 1000))

      );

    };

    update();

    const intervalId = window.setInterval(update, 250);

    return () => window.clearInterval(intervalId);

  }, [game?.status, game?.nextHandAt]);



  // The first 3 seconds of a completed showdown reveal cards at the seats.

  // Based on the server timestamp, so refreshes do not restart the animation.

  useEffect(() => {

    if (game?.status !== 'Completed') {

      setShowResultsOverlay(true);

      setRevealDelayElapsed(false);

      return undefined;

    }



    const revealDelayMs = game.isShowdown ? 3000 : 0;

    const completedAtMs = game.completedAt

      ? new Date(game.completedAt).getTime()

      : 0;



    const update = () => {

      setRevealDelayElapsed(

        !Number.isFinite(completedAtMs) ||

        Date.now() >= completedAtMs + revealDelayMs

      );

    };



    update();

    const intervalId = window.setInterval(update, 250);

    return () => window.clearInterval(intervalId);

  }, [game?.gameId, game?.status, game?.completedAt, game?.isShowdown]);



  async function handleStartGame() {

    if (

      isSpectator ||

      !table?.id ||

      startingGame ||

      game ||

      table.currentGameId

    ) {

      return;

    }



    setStartingGame(true);



    try {

      const response = await fetch(

        `${API_URL}/api/tables/${table.id}/start`,

        {

          method: 'POST',

          credentials: 'include',

        }

      );



      const data = await response.json();



      if (!response.ok) {

        setGameNotice(

          data.error || data.message || 'Unable to start the game.'

        );

        return;

      }



      // Prevent starting the same game twice.

      setTable((previous) => ({

        ...previous,

        currentGameId: data.gameId,

        status: 'In Progress',

      }));



      animateFirstDeal.current = true;
      await refreshGame(data.gameId);



      setGameNotice('Initial cards have been dealt.');

    } catch (err) {

      console.error('Error starting game:', err);



      setGameNotice(

        err.message || 'Unable to start the game.'

      );

    } finally {

      setStartingGame(false);

    }

  }



  
  // P16: Perform fold, check, call, bet, or raise.

  async function handleBettingAction(action) {

    if (isSpectator || !game?.gameId || submittingAction) return;



    setSubmittingAction(true);



    try {

      const response = await fetch(

        `${API_URL}/api/games/${game.gameId}/action`,

        {

          method: 'POST',

          credentials: 'include',

          headers: {

            'Content-Type': 'application/json',

          },

          body: JSON.stringify({

            action: action.toLowerCase(),

          }),

        }

      );



      const data = await response.json();



      if (!response.ok) {

        throw new Error(

          data.error || 'Unable to perform betting action.'

        );

      }



      await refreshGame(game.gameId);



      const botActivity = (data.botActions || [])

        .map(({ playerId, action: botAction }) => {

          const botNumber = playerId.split('-').pop();

          return `Bot ${botNumber} ${botAction}`;

        })

        .join(', ');



      setGameNotice(

        botActivity

          ? `${action} completed. ${botActivity}.`

          : `${action} completed successfully.`

      );

    } catch (err) {

      console.error('Betting action failed:', err);



      setGameNotice(

        err.message || 'Unable to perform betting action.'

      );

    } finally {

      setSubmittingAction(false);

    }

  }



  const players = game?.players || [];



  const me = players.find(

    (player) => player.isCurrentPlayer

  );



  const opponents = players.filter(

    (player) => !player.isCurrentPlayer

  );



  // Names supplied by the backend for human players and bots.

  const playerNamesById = new Map(

    (game?.playerNames || []).map(({ playerId, username }) => [

      String(playerId),

      username,

    ])

  );



  const displayPlayerName = (playerId) => {

    const id = String(playerId);

    if (me && id === String(me.playerId) && !isSpectator) return 'You';

    if (playerNamesById.has(id)) return playerNamesById.get(id);

    if (id.startsWith('bot-')) return `Bot ${id.split('-').pop()}`;

    return 'Unknown player';

  };



  const handResults = game?.handResults || [];

  const completionMessage = handResults.length > 0

    ? handResults.map((result) => {

        const hand = result.handName ? ` with ${result.handName}` : '';

        return `${displayPlayerName(result.playerId)} won ${result.amountWon} chips${hand}`;

      }).join(' · ')

    : 'The hand is complete.';



  // A seated player absent from the new hand is sitting out.

  // The backend excludes players who cannot cover ante + bring-in.

  const isSittingOut = Boolean(

    game && !isSpectator && table?.isPlayer && !me

  );



  const getPlayerChips = (playerId) => {

    return game?.playerStacks?.find(

      (stack) => String(stack.playerId) === String(playerId)

    )?.chips;

  };



  const isMyTurn =

    Boolean(game && me) &&

    String(game.currentTurnPlayerId) === String(me.playerId);



  const amountToCall = Math.max(

    0,

    (game?.currentBet ?? 0) -

      (me?.roundContribution ?? 0)

  );



  const canAct =

    !isSpectator &&

    game?.status === 'In Progress' &&

    !game?.bettingRoundComplete &&

    !me?.hasFolded &&

    isMyTurn &&

    !submittingAction;



  const smallBet = TABLE_BETS[table?.level] ?? 5;



  const isBringInCompletion =

    game?.street === 3 &&

    (game?.currentBet ?? 0) > 0 &&

    (game?.currentBet ?? 0) < smallBet;



  const raiseLimitReached =

    (game?.raiseCount ?? 0) >= 3 &&

    !isBringInCompletion;



  const myChips = getPlayerChips(me?.playerId);



  const requiredRaise =

    isBringInCompletion

      ? smallBet - (me?.roundContribution ?? 0)

      : amountToCall +

        (game?.street <= 4

          ? smallBet

          : smallBet * 2);



  const canAfford = (amount) =>

    myChips != null && myChips >= amount;



  // Tooltip amounts for fixed-limit betting.

  const betAmount =

    game?.street <= 4 ? smallBet : smallBet * 2;



  const raiseToAmount = isBringInCompletion

    ? smallBet

    : (game?.currentBet ?? 0) + betAmount;



  function getActionTooltip(action) {

    switch (action) {

      case 'Fold':

        return 'Give up this hand. You cannot win the pot.';



      case 'Check':

        return 'Stay in the hand without betting any additional chips.';



      case 'Call':

        return `Match the current bet by adding ${amountToCall} chips.`;



      case 'Bet':

        return `Place a bet of ${betAmount} chips.`;



      case 'Raise':

        return `Increase the current bet to ${raiseToAmount} chips.`;



      default:

        return '';

    }

  }



  if (loading) {

    return (

      <main className="stud-page">

        <p role="status">Loading table...</p>

      </main>

    );

  }



  if (error || !table) {

    return (

      <main className="stud-page">

        <p role="alert">

          {error || 'Table not found.'}

        </p>



        <Link to="/lobby" className="stud-back-link">

          ← Back to Lobby

        </Link>

      </main>

    );

  }



  return (

    <main className="stud-page">

      <div className="stud-page-heading">

        <div>

          <p className="stud-eyebrow">

            POKER FACE · IN-GAME PLAY

          </p>



          <h1>Seven-Card Stud</h1>



          <p className="stud-subtitle">

            {isSpectator

              ? 'You are observing this Seven-Card Stud table'

              : 'Your seven-card stud table'}

          </p>

        </div>



        <div className="stud-header-actions">

          {!isSpectator && (

            <button

              type="button"

              className="stud-start-button"

              onClick={handleStartGame}

              disabled={

                startingGame ||

                Boolean(game) ||

                Boolean(table.currentGameId)

              }

            >

              {startingGame

                ? 'Starting Game...'

                : game || table.currentGameId

                  ? 'Game Started'

                  : 'Start Game'}

            </button>

          )}





          <button type="button" className="stud-sound-toggle" onClick={toggleSound}
            aria-pressed={soundEnabled} aria-label={soundEnabled ? 'Mute game sounds' : 'Enable game sounds'}>
            {soundEnabled ? '🔊 Sound on' : '🔇 Sound off'}
          </button>

          <Link to="/lobby" className="stud-back-link">

            ← Back to Lobby

          </Link>

        </div>

      </div>



      <div className="stud-notice" role="status">

        <span

          className="stud-notice-icon"

          aria-hidden="true"

        >

          !

        </span>



        <div>

          <strong>

            {game?.status === 'Completed'

              ? 'Hand complete'

              : game

                ? 'Game status'

                : 'Waiting for game'}

          </strong>



          <p>

            {game?.status === 'Completed'

              ? completionMessage

              : gameNotice}

          </p>

          {game?.status === 'Completed' && (

            <p role="timer" style={{ marginTop: 8, fontWeight: 700 }}>

              {nextHandSeconds > 0

                ? `Next hand in ${nextHandSeconds}s`

                : 'Waiting for the next hand to start...'}

            </p>

          )}

          {isSittingOut && (

            <p role="status" style={{ marginTop: 8 }}>

              You are sitting out this hand. If you do not have enough

              chips, you can watch ads to earn more chips once that

              feature becomes available.

            </p>

          )}

        </div>

      </div>



      <div className="stud-layout stud-layout-focused stud-layout-sidebar">

        <div className="stud-play-row">

        <section

          className="stud-game-area"

          aria-label="Seven-Card Stud table"

        >

          <div className="stud-round-label stud-round-summary">

            <strong>{game ? `Street ${game.street}` : 'Waiting for players'}</strong>

            {game && (

              <>

                <span>{game.bettingRoundComplete ? 'Betting complete' : 'Betting in progress'}</span>

                <span>Ante {game.ante}</span>

                <span>Bring-in {game.bringIn}</span>

                <span>Bet {game.currentBet ?? 0}</span>

              </>

            )}

          </div>



          <div className="stud-felt" ref={feltRef}>
            {streetAnnouncement && (
              <div key={streetAnnouncement.id} className="stud-street-announcement" role="status">
                {({ 3: 'Third', 4: 'Fourth', 5: 'Fifth', 6: 'Sixth', 7: 'Seventh' })[streetAnnouncement.street] || `Street ${streetAnnouncement.street}`} Street
              </div>
            )}
            {payoutEffect && <div className="stud-payout-flash" aria-hidden="true">POT AWARDED</div>}
            <div className="stud-chip-flight-layer" aria-hidden="true">
              {chipFlights.map(flight => <span key={flight.id} className="stud-flying-chip" style={{
                '--chip-x': `${flight.x}px`, '--chip-y': `${flight.y}px`,
                '--chip-dx': `${flight.dx}px`, '--chip-dy': `${flight.dy}px`,
                '--chip-delay': `${flight.delay}ms`
              }} />)}
            </div>

            {/* Render all six seats.

                Players see themselves at the bottom.

                Spectators see every seated player around the table. */}

            {seatPositions.map((position, index) => {

              const player = isSpectator

                ? players[index]

                : position === 'bottom'

                  ? me

                  : opponents[index];



              // Show an empty seat when nobody occupies this position.

              if (!player) {

                return (

                  <EmptySeat

                    key={position}

                    position={position}

                  />

                );

              }



              const playerName = displayPlayerName(player.playerId);



              return (

                <PokerSeat

                  key={player.playerId}

                  playerId={player.playerId}
                  name={playerName}

                  position={position}

                  isYou={!isSpectator && player.isCurrentPlayer}

                  cards={player.cards}

                  chips={getPlayerChips(player.playerId)}

                  isBringIn={

                    String(game?.bringInPlayerId) ===

                    String(player.playerId)

                  }

                  isTurn={

                    String(game?.currentTurnPlayerId) ===

                    String(player.playerId)

                  }

                  hasFolded={player.hasFolded}

                  contribution={player.roundContribution}

                  turnSeconds={remainingSeconds}
                  playerAction={playerActions[String(player.playerId)]}
                  isWinner={game?.status === 'Completed' && (game?.winnerIds || []).some(id => String(id) === String(player.playerId))}
                  highlightWinningFive={game?.status === 'Completed' && game?.isShowdown && (game?.winnerIds || []).some(id => String(id) === String(player.playerId))}
                  newlyDealt={newlyDealtPlayers.includes(String(player.playerId))}
                  dealStartIndex={dealStartIndices[String(player.playerId)] ?? 0}
                  dealBatch={dealBatch}

                />

              );

            })}



            <div className="stud-board stud-board-waiting poker-pot-area">

              {game && <PotChipStacks amount={game.pot} />}



              <div className="stud-pot">

                <span> Pot: {game?.pot ?? 0} chips</span>

              </div>



              {!game && (

                <p className="stud-board-caption">Waiting for the first deal</p>

              )}

            </div>

          </div>



          {/* P16: Betting actions with hover tooltips */}

          {!isSpectator && (<div className="stud-actions">

            {[

              'Fold',

              'Check',

              'Call',

              'Bet',

              'Raise',

            ].map((action) => {

              const disabledByRules =

                (action === 'Check' &&

                  amountToCall > 0) ||

                (action === 'Call' &&

                  (amountToCall === 0 ||

                    !canAfford(amountToCall))) ||

                (action === 'Bet' &&

                  ((game?.currentBet ?? 0) > 0 ||

                    !canAfford(betAmount))) ||

                (action === 'Raise' &&

                  ((game?.currentBet ?? 0) === 0 ||

                    raiseLimitReached ||

                    !canAfford(requiredRaise)));



              return (

                <button

                  key={action}

                  type="button"

                  title={getActionTooltip(action)}

                  onClick={() =>

                    handleBettingAction(action)

                  }

                  disabled={

                    !canAct || disabledByRules

                  }

                >

                  {action}

                </button>

              );

            })}

          </div>)}



          <p className="stud-action-help">

            {game?.status === 'Completed'

              ? 'Hand complete. Your chips remain at this table for the next hand.'

              : game

                ? 'Use the betting controls when it is your turn.'

                : 'Cards will appear after the game starts.'}

          </p>

        </section>

          <aside className="stud-game-sidebar" aria-label="Table details and chat">

          <section className="stud-panel stud-table-info">

            <h2>Table: {table.name}</h2>



            <dl>

              <div>

                <dt>Join Code</dt>

                <dd className="stud-table-id">

                  {isSpectator

                    ? 'Public table'

                    : table.joinCode || 'Private tables only'}

                </dd>

              </div>



              <div>

                <dt>Level</dt>

                <dd>{table.level}</dd>

              </div>



              <div>

                <dt>Players</dt>

                <dd>

                  {table.filledSeats}/{table.capacity}

                </dd>

              </div>



              <div>

                <dt>Bots</dt>

                <dd>{table.botCount}</dd>

              </div>

            </dl>

            <p className="stud-sidebar-status">

              {game

                ? 'Table stays open between hands.'

                : 'Waiting for the game to start.'}

            </p>



          {!isSpectator && (

            <button

              type="button"

              className="stud-secondary-button stud-table-leave"

              onClick={handleLeaveTable}
              disabled={leavingTable}

            >

              {leavingTable ? 'Leaving...' : 'Leave Table'}

            </button>

          )}



          </section>



          <section className="stud-panel stud-players-panel">

            <h2>

              Players (

              {game

                ? players.length

                : `${table.filledSeats}/${table.capacity}`}

              )

            </h2>



            <ul>

              {game && players.length > 0 ? (

                players.map((player) => {

                  const playerId = String(player.playerId);

                  const isBot = playerId.startsWith('bot-');

                  const isYou = !isSpectator && me && playerId === String(me.playerId);

                  const isCurrentTurn = playerId === String(game.currentTurnPlayerId);

                  const chips = getPlayerChips(player.playerId);

                  return (

                    <li key={playerId}>

                      <span className="stud-player-icon" aria-hidden="true">

                        {isBot ? '🤖' : '♙'}

                      </span>

                      <span className="stud-player-name">

                        {displayPlayerName(player.playerId)}{isBot ? ' (Bot)' : ''}

                        {chips != null && ` · 🪙 ${chips}`}

                      </span>

                      <strong>

                        {player.hasFolded

                          ? 'Folded'

                          : isCurrentTurn

                            ? isYou ? 'Your turn' : 'Current turn'

                            : 'Playing'}

                      </strong>

                    </li>

                  );

                })

              ) : (

                <li>

                  <span className="stud-player-icon" aria-hidden="true">♙</span>

                  <span className="stud-player-name">Waiting for players</span>

                  <strong>Waiting</strong>

                </li>

              )}

            </ul>



            {isSpectator && (

              <div className="stud-spectators">

                <h3>Spectator View</h3>



                <p>

                  You are watching this table. Your account is not

                  seated and cannot place bets.

                </p>

              </div>

            )}

          </section>

          <div className="stud-chat-column">

          <section className="stud-panel stud-chat-panel">

            <h2>Chat</h2>



            <div

              className="stud-chat-messages"

              aria-live="polite"

            >

              {chatMessages.length === 0 ? (

                <p className="stud-chat-empty">

                  No messages yet. Say hello when others arrive.

                </p>

              ) : (

                chatMessages.map((item, index) => (

                  <p key={`${item.name}-${index}`}>

                    <strong>{item.name}:</strong>{' '}

                    {item.message}

                  </p>

                ))

              )}

            </div>



            <form

              className="stud-chat-form"

              onSubmit={sendChat}

            >

              <label

                className="stud-visually-hidden"

                htmlFor="stud-chat-input"

              >

                Type a message

              </label>



              <input

                id="stud-chat-input"

                value={chatMessage}

                onChange={(event) =>

                  setChatMessage(event.target.value)

                }

                placeholder="Type a message..."

                maxLength={200}

              />



              <button

                type="submit"

                aria-label="Add chat message"

                title="Add local preview message"

              >

                ➤

              </button>

            </form>



            <p className="stud-chat-note">

              Preview only — chat is not connected.

            </p>

          </section>

          </div>



          </aside>

        </div>

      </div>

      {game?.status === 'Completed' && revealDelayElapsed && showResultsOverlay && (

        <ViewResults

          game={game}

          nextHandSeconds={nextHandSeconds}

          getPlayerName={displayPlayerName}

          onClose={() => setShowResultsOverlay(false)}

        />

      )}

    </main>

  );

}



export default Table;
