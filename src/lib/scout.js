const KEY = 'dthb.anonymousScoutId.v1';

export function getScoutId() {
  try {
    let id = localStorage.getItem(KEY);
    if (!id) {
      id = `scout_${crypto.randomUUID().slice(0, 8)}`;
      localStorage.setItem(KEY, id);
    }
    return id;
  } catch {
    return `scout_${Math.random().toString(16).slice(2, 10)}`;
  }
}
