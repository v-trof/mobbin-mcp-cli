import { readFile } from 'node:fs/promises';
import { randomInt } from 'node:crypto';
import { MobbinError } from './mcp-client.js';

const AXES = ['structure', 'interaction', 'world', 'density', 'color', 'type'];
// Directions in one draw never share these axes; the rest repeat only once their pool runs out.
const DISTINCT_AXES = ['structure', 'world'];
const MAX_COUNT = 8;

// FNV-1a string hash feeding mulberry32, so `--seed` reproduces a draw on every platform.
function seededRandom(seed) {
  let hash = 2166136261;
  for (const char of String(seed)) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  let state = hash >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), state | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle(items, random) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

async function drawSeeds({ count = 4, seed = String(randomInt(1, 1_000_000)), avoid = [] } = {}) {
  if (!Number.isSafeInteger(count) || count < 1 || count > MAX_COUNT) throw new MobbinError(`--count must be an integer from 1 to ${MAX_COUNT}.`);
  const deck = JSON.parse(await readFile(new URL('../seeds/deck.json', import.meta.url), 'utf8'));
  const unknown = avoid.filter((id) => ![...AXES, 'wild'].some((axis) => deck[axis].some((option) => option.id === id)));
  if (unknown.length) throw new MobbinError(`Unknown --avoid id: ${unknown.join(', ')}.`);
  const random = seededRandom(seed);
  const excluded = new Set(avoid);
  const pools = Object.fromEntries([...AXES, 'wild'].map((axis) => {
    const pool = shuffle(deck[axis].filter(({ id }) => !excluded.has(id)), random);
    if (!pool.length) throw new MobbinError(`--avoid excludes every ${axis} option.`);
    if (DISTINCT_AXES.includes(axis) && pool.length < count) throw new MobbinError(`Only ${pool.length} ${axis} options remain; lower --count or --avoid fewer.`);
    return [axis, pool];
  }));
  const directions = Array.from({ length: count }, (_, i) => ({
    id: String.fromCharCode(65 + i),
    ...Object.fromEntries(AXES.map((axis) => [axis, pools[axis][i % pools[axis].length]]))
  }));
  if (count >= 3) directions[count - 1].wild = pools.wild[0];
  return { seed: String(seed), count, avoid, directions };
}

function formatSeeds({ seed, count, avoid, directions }) {
  const line = (label, { id, label: name, prompt }) => `  ${label.padEnd(12)} ${name} (${id}): ${prompt}`;
  const blocks = directions.map((direction) => [
    `${direction.id}${direction.wild ? ' (wild)' : ''}`,
    ...AXES.map((axis) => line(axis[0].toUpperCase() + axis.slice(1), direction[axis])),
    ...(direction.wild ? [line('Twist', direction.wild)] : [])
  ].join('\n'));
  const reproduce = `mobbin seeds --count ${count} --seed ${seed}${avoid.length ? ` --avoid ${avoid.join(',')}` : ''}`;
  return [`Seed ${seed}. Reproduce with: ${reproduce}`, ...blocks].join('\n\n');
}

export { AXES, drawSeeds, formatSeeds };
