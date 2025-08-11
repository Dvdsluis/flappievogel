export type ScoreEntry = { score: number; date: number };

const KEY = 'scores:v1';

function load(): ScoreEntry[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr
      .map((e: any) => ({ score: Number(e.score) || 0, date: Number(e.date) || Date.now() }))
      .filter((e: ScoreEntry) => e.score >= 0 && Number.isFinite(e.date));
  } catch {
    return [];
  }
}

function save(list: ScoreEntry[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {}
}

export const Scoreboard = {
  addScore(score: number, when: number = Date.now()) {
    const list = load();
    list.push({ score: Math.max(0, Math.floor(score)), date: when });
    // sort desc by score, then recent first
    list.sort((a, b) => (b.score - a.score) || (b.date - a.date));
    // cap
    const capped = list.slice(0, 10);
    save(capped);
  },
  getTop(n: number = 5): ScoreEntry[] {
    const list = load();
    list.sort((a, b) => (b.score - a.score) || (b.date - a.date));
    return list.slice(0, n);
  },
  clear() {
    save([]);
  }
};
