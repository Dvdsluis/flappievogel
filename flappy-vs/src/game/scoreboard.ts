export type ScoreEntry = { score: number; date: number; name?: string };

const KEY = 'scores:v1';
const NAME_KEY = 'playerName';

function load(): ScoreEntry[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr
      .map((e: any) => ({ score: Number(e.score) || 0, date: Number(e.date) || Date.now(), name: typeof e.name === 'string' ? e.name : undefined }))
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
  addScore(score: number, when: number = Date.now(), name?: string) {
    const list = load();
    const cleanName = (name ?? localStorage.getItem(NAME_KEY) ?? 'Anon').toString().slice(0, 18).trim() || 'Anon';
    list.push({ score: Math.max(0, Math.floor(score)), date: when, name: cleanName });
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
  },
  getPlayerName(): string | null {
    try { return localStorage.getItem(NAME_KEY); } catch { return null; }
  },
  setPlayerName(name: string) {
    try { localStorage.setItem(NAME_KEY, (name || '').toString().slice(0, 18).trim() || 'Anon'); } catch {}
  }
};
