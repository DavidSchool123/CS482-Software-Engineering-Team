// Small original synthesized UI cues. No external audio files or libraries.
let context;
function getContext() {
  if (typeof window === 'undefined') return null;
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return null;
  context ||= new AudioContext();
  if (context.state === 'suspended') context.resume().catch(() => {});
  return context;
}
function tone(ctx, frequency, duration, type = 'sine', volume = 0.025, offset = 0) {
  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();
  const start = ctx.currentTime + offset;
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, start);
  oscillator.frequency.exponentialRampToValueAtTime(Math.max(80, frequency * .72), start + duration);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(volume, start + .012);
  gain.gain.exponentialRampToValueAtTime(.0001, start + duration);
  oscillator.connect(gain).connect(ctx.destination);
  oscillator.start(start);
  oscillator.stop(start + duration + .02);
}
export function playPokerSound(kind) {
  try {
    const ctx = getContext();
    if (!ctx) return;
    switch (kind) {
      case 'timer-warning':
        tone(ctx, 880, .12, 'sine', .018);
        tone(ctx, 660, .15, 'sine', .015, .16);
        break;
      case 'deal': tone(ctx, 560, .065, 'triangle', .018); break;
      case 'chip': tone(ctx, 740, .09, 'sine', .024); tone(ctx, 1020, .09, 'sine', .014, .055); break;
      case 'fold': tone(ctx, 250, .12, 'triangle', .016); break;
      case 'check': tone(ctx, 440, .07, 'sine', .012); break;
      case 'win':
        tone(ctx, 523, .17, 'sine', .025);
        tone(ctx, 659, .17, 'sine', .025, .13);
        tone(ctx, 784, .25, 'sine', .025, .26);
        break;
      default: break;
    }
  } catch (error) { console.debug('Sound unavailable:', error); }
}
