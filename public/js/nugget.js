// Pixel-nugget ore sprite: four shaded lumps on a 30×26 grid, recoloured per ore type.

const PAL = {
  gold: { o: '#5A2A0A', d: '#C26A0E', m: '#F2A516', l: '#FFD84A', h: '#FFFBEA' },
  quartz: { o: '#1E3550', d: '#4C7FA8', m: '#8CC2E0', l: '#C8EBF7', h: '#FFFFFF' },
  stone: { o: '#241B14', d: '#6E655A', m: '#9A9184', l: '#C2BBAE', h: '#EFEBE3' },
  mud: { o: '#2B1608', d: '#5B3B25', m: '#7A4E32', l: '#A0703F', h: '#C99A6B' },
  diamond: { o: '#123A4A', d: '#2E9CC0', m: '#7FDDF5', l: '#C9F6FF', h: '#FFFFFF' },
};
const PLAIN = ['stone', 'quartz', 'mud'];
const W = 30;
const H = 26;
// Front-most first (lower = in front).
const LUMPS = [{ x: 15, y: 17.5, r: 4.8 }, { x: 9.5, y: 14.5, r: 5.2 }, { x: 20.5, y: 14.5, r: 5.2 }, { x: 15, y: 9.5, r: 5.6 }];
const SPARKS = [[2, 5], [27, 4], [26, 21], [3, 20]];

function owner(px, py) {
  if (px < 0 || py < 0 || px >= W || py >= H) return -1;
  for (let k = 0; k < LUMPS.length; k++) {
    const c = LUMPS[k];
    const dx = px + 0.5 - c.x;
    const dy = py + 0.5 - c.y;
    if (dx * dx + dy * dy <= c.r * c.r) return k;
  }
  return -1;
}

// Pixel paths per shade, shared by every palette.
const SHAPE = (() => {
  const b = { o: '', d: '', m: '', l: '', h: '' };
  for (let py = 0; py < H; py++) {
    for (let px = 0; px < W; px++) {
      const k = owner(px, py);
      if (k < 0) continue;
      const c = LUMPS[k];
      const nx = (px + 0.5 - c.x) / c.r;
      const ny = (py + 0.5 - c.y) / c.r;
      const nb = [owner(px - 1, py), owner(px + 1, py), owner(px, py - 1), owner(px, py + 1)];
      let t;
      if (nb.includes(-1) || nb.some((n) => n > k)) t = 'o';
      else if (nx > -0.62 && nx < -0.12 && ny > -0.72 && ny < -0.3) t = 'h';
      else if (nx + ny < -0.3) t = 'l';
      else if (nx + ny > 0.55 || ny > 0.62) t = 'd';
      else t = 'm';
      b[t] += `M${px} ${py}h1v1h-1z`;
    }
  }
  return b;
})();
const SPARK_D = SPARKS.map(([x, y]) => `M${x} ${y - 1}h1v3h-1zM${x - 1} ${y}h3v1h-3z`).join('');

const cache = new Map();

/** Palette name for an ore: golden and diamond have their own, plain ores cycle stone/quartz/mud by id. */
export function orePalette(ore) {
  return ore.diamond ? 'diamond' : ore.golden ? 'gold' : PLAIN[ore.id % PLAIN.length];
}

/** Inline SVG markup for a nugget in the given palette. */
export function nugget(pal) {
  if (!cache.has(pal)) {
    const p = PAL[pal];
    const sparkle = pal === 'gold' || pal === 'diamond';
    cache.set(pal, `<svg class="nugget" viewBox="0 0 ${W} ${H}" shape-rendering="crispEdges" aria-hidden="true">`
      + ['o', 'd', 'm', 'l', 'h'].map((t) => `<path d="${SHAPE[t]}" fill="${p[t]}"></path>`).join('')
      + (sparkle ? `<path d="${SPARK_D}" fill="#FFFBEA"></path>` : '')
      + '</svg>');
  }
  return cache.get(pal);
}
