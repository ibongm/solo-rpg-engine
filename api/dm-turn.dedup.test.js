import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';

// Auth: the bearer token is the uid. Storyteller: the mock, counted.
vi.mock('./_lib/auth.js', async (orig) => ({
  ...(await orig()),
  verifyRequest: async (req) => String(req.headers.authorization).replace(/^Bearer\s+/i, ''),
}));
const calls = { n: 0 };
vi.mock('./_lib/mock.js', async (orig) => {
  const real = await orig();
  return {
    ...real,
    mockDmTurn: (...args) => {
      calls.n += 1;
      return real.mockDmTurn(...args);
    },
  };
});

const { default: handler } = await import('./dm-turn.js');

function call(uid, body) {
  return new Promise((resolve) => {
    const res = {
      statusCode: 200,
      setHeader() {},
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(obj) {
        resolve({ status: this.statusCode, body: obj });
        return this;
      },
    };
    handler({ method: 'POST', headers: { authorization: `Bearer ${uid}` }, body }, res);
  });
}

const body = (turnId) => ({
  turnId,
  context: { static: { rules: {}, character: { name: 'Mara' } }, dynamic: { events: [] } },
  action: { kind: 'action', text: 'I look around.' },
});

describe('dm-turn turnId dedup', () => {
  let prev;
  beforeAll(() => {
    prev = process.env.VERTEX_MOCK;
    process.env.VERTEX_MOCK = '1';
  });
  afterAll(() => {
    process.env.VERTEX_MOCK = prev;
  });

  it('returns the first generation for a repeated turnId from the same player', async () => {
    const before = calls.n;
    const first = await call('u1', body('turn_a'));
    const again = await call('u1', body('turn_a'));
    expect(first.status).toBe(200);
    expect(again.body.deduplicated).toBe(true);
    expect(again.body.result).toEqual(first.body.result);
    expect(calls.n - before).toBe(1);
  });

  it('never shares a turn between players, and generates normally without a turnId', async () => {
    const before = calls.n;
    await call('u1', body('turn_b'));
    const other = await call('u2', body('turn_b'));
    expect(other.body.deduplicated).toBeUndefined();
    await call('u1', body(undefined));
    await call('u1', body(undefined));
    expect(calls.n - before).toBe(4);
  });
});
