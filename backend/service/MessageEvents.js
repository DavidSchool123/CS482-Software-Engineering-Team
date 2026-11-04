const listeners = new Set();

function publish(event) {
  for (const listener of listeners) {
    listener(event);
  }
}

function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

module.exports = { publish, subscribe };
