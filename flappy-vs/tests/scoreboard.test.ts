import { Scoreboard } from '../src/game/scoreboard';

describe('Scoreboard', () => {
  const realLocal = global.localStorage;
  const mem: Record<string, string> = {};
  beforeAll(() => {
    // simple in-memory localStorage mock
    // @ts-ignore
    global.localStorage = {
      getItem: (k: string) => mem[k] ?? null,
      setItem: (k: string, v: string) => { mem[k] = v; },
      removeItem: (k: string) => { delete mem[k]; },
      clear: () => { for (const k of Object.keys(mem)) delete mem[k]; },
      key: (i: number) => Object.keys(mem)[i] ?? null,
      length: 0,
    } as any;
  });
  afterAll(() => {
    // @ts-ignore
    global.localStorage = realLocal;
  });
  beforeEach(() => Scoreboard.clear());

  it('keeps top 10 descending and recent first on ties', () => {
    const now = 1000;
    for (let i = 0; i < 12; i++) {
      Scoreboard.addScore(10 + i, now + i);
    }
    const top = Scoreboard.getTop(10);
    expect(top).toHaveLength(10);
    expect(top[0].score).toBe(21);
    expect(top[9].score).toBe(12);
  });

  it('sorts ties by recency', () => {
    Scoreboard.addScore(50, 1);
    Scoreboard.addScore(50, 2);
    const top = Scoreboard.getTop(2);
    expect(top[0].date).toBe(2);
  });
});
