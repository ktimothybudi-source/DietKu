type Listener = (data: any) => void;

const listeners: Record<string, Listener[]> = {};

export const eventEmitter = {
  on(event: string, listener: Listener) {
    if (!listeners[event]) {
      listeners[event] = [];
    }
    listeners[event].push(listener);
  },
  off(event: string, listener: Listener) {
    if (!listeners[event]) return;
    listeners[event] = listeners[event].filter(l => l !== listener);
  },
  emit(event: string, data?: any) {
    if (!listeners[event]) return;
    listeners[event].forEach(listener => listener(data));
  },
};
