let listeners = [];

export const toast = {
  show(msg, kind = 'info') {
    const t = { id: `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`, msg, kind };
    listeners.forEach((l) => l(t));
  },
  error(msg) {
    this.show(msg, 'error');
  },
  success(msg) {
    this.show(msg, 'success');
  },
};

export function onToast(fn) {
  listeners.push(fn);
  return () => {
    listeners = listeners.filter((l) => l !== fn);
  };
}
