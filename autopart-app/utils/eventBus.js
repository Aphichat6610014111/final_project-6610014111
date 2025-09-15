const listeners = {};

export const on = (event, cb) => {
  listeners[event] = listeners[event] || [];
  listeners[event].push(cb);
  return () => {
    listeners[event] = listeners[event].filter(x => x !== cb);
  };
};

export const emit = (event, payload) => {
  (listeners[event] || []).forEach(cb => cb(payload));
};

export default { on, emit };
