// Stroke icon set (24×24 viewBox). Replaces emoji, which render inconsistently across platforms.

export const ICON_PATHS = {
  goblin: 'M5 8l4 3M19 8l-4 3M12 20a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM10 12h.01M14 12h.01',
  knight: 'M6 21V11a6 6 0 0 1 12 0v10zM6 14h12M12 14v7',
  slime: 'M4 19c0-7 3-11 8-11s8 4 8 11zM10 14h.01M14 14h.01',
  giant: 'M5 20l8-8M12 4a4 4 0 1 1 7 4l-4 4-4-4z',
  frost: 'M12 2v20M3.3 7l17.4 10M20.7 7 3.3 17M9 4l3 2 3-2M9 20l3-2 3 2',
  fog: 'M4 10h13M2 14h18M6 18h11M8 6h8',
  repair: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10zM12 8v7M8.5 11.5h7',
  luck: 'M6 3h12l4 6-10 12L2 9zM2 9h20M8 3l4 18 4-18',
  drill: 'M4 7h16M6 11h12M8 15h8M10 19h4',
  pickaxe: 'M4 9c4-5 12-5 16 0M12 6 6 20',
  sword: 'M14.5 17.5 3 6V3h3l11.5 11.5M13 19l6-6M16 16l4 4M19 21l2-2M14.5 6.5 18 3h3v3l-3.5 3.5M5 14l4 4M7 17l-3 3M3 19l2 2',
  bolt: 'M13 2 3 14h9l-1 8 10-12h-9z',
  warn: 'M12 3 2 21h20zM12 10v5M12 18h.01',
  flame: 'M12 22c4 0 7-3 7-7 0-5-5-7-5-12-3 2-4 5-4 7-1-1-2-2-2-4-2 2-3 5-3 9 0 4 3 7 7 7z',
  skull: 'M12 3a8 8 0 0 0-5 14v3h10v-3a8 8 0 0 0-5-14zM9 12h.01M15 12h.01M10 20v-2M14 20v-2',
  soundOn: 'M11 5 6 9H2v6h4l5 4zM15.5 8.5a5 5 0 0 1 0 7',
  soundOff: 'M11 5 6 9H2v6h4l5 4zM22 9l-6 6M16 9l6 6',
  flag: 'M6 21V4M6 4h11l-2.5 4 2.5 4H6',
  sparkle: 'M12 3l2 6 6 2-6 2-2 6-2-6-6-2 6-2z',
  up: 'M12 19V5M6 11l6-6 6 6',
  arrowRight: 'M5 12h13M13 6l6 6-6 6',
  arrowLeft: 'M19 12H6M11 6l-6 6 6 6',
  clock: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 7v5l3 2',
};

/** Inline SVG markup for an icon; colour follows `currentColor` unless overridden. */
export function icon(name, { size = 20, stroke = 'currentColor', fill = 'none', width = 2.4, cls = '' } = {}) {
  return `<svg class="ico ${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="${fill}" stroke="${stroke}"`
    + ` stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">`
    + `<path d="${ICON_PATHS[name]}"></path></svg>`;
}

/** The gold currency gem. */
export function gem(size = 16, color = 'currentColor') {
  return `<svg class="ico gem" width="${size}" height="${size}" viewBox="0 0 24 24" fill="${color}" aria-hidden="true">`
    + '<path d="M6 3h12l4 6-10 12L2 9z"></path></svg>';
}

// Full-colour shop tile art (48×48 viewBox): [path, fill, stroke, strokeWidth].
const INK = '#2B2118';
const circ = (cx, cy, r) => `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0z`;
export const TILE_ART = {
  goblin: [['M13 25 1 11l5 20z', '#7DBA4A'], ['M35 25 47 11l-5 20z', '#7DBA4A'], [circ(24, 28, 13), '#7DBA4A'], ['M12 23a12 10 0 0 1 24 0z', '#2F6FE0'], ['M15 26l7 3M33 26l-7 3', 'none', INK, 3], [circ(19, 31, 2.2), '#FFD34D', INK, 1.5], [circ(29, 31, 2.2), '#FFD34D', INK, 1.5], ['M24 31l-3 6h5z', '#5E9A3F', INK, 2], ['M17 38q7 5 14 0'], ['M27 39l1 3 2-3', '#FFF8E8', INK, 1.5]],
  knight: [['M22 13c0-6 9-10 16-6-6 1-9 4-11 8z', '#2F6FE0'], ['M10 42V26a14 14 0 0 1 28 0v16z', '#D5DBE3'], ['M13 27h22v5H13z', INK, INK, 1], ['M24 32v10M10 37h28']],
  slime: [['M5 41c0-17 8-27 19-27s19 10 19 27z', '#8EE07A'], ['M12 27c2-5 5-8 9-9', 'none', '#E6FFE0', 3.5], [circ(19, 31, 3), INK, INK, 1], [circ(30, 31, 3), INK, INK, 1]],
  giant: [['M6 43V22a18 15 0 0 1 36 0v21z', '#C89B7B'], ['M9 21h30v7H9z', '#8A6248'], ['M14 31h7v3h-7zM27 31h7v3h-7z', INK, INK, 1], ['M15 43l3-8 3 8zM27 43l3-8 3 8z', '#FFF8E8'], ['M20 38h8']],
  frost: [['M24 3 42 13.5v21L24 45 6 34.5v-21z', '#BFE6FF'], ['M24 9v30M11 16.5l26 15M37 16.5l-26 15', 'none', INK, 3], ['M19 12l5 4 5-4M19 36l5-4 5 4']],
  fog: [['M14 30a8 8 0 0 1 1-16 11 11 0 0 1 20 1 7.5 7.5 0 0 1 0 15z', '#CFCBE3'], ['M5 37q4-3 8 0t8 0 8 0 8 0 8 0', 'none', INK, 3], ['M11 43q4-3 8 0t8 0 8 0', 'none', INK, 3]],
  repair: [['M24 43S5 31 5 18a9.5 9.5 0 0 1 19-4 9.5 9.5 0 0 1 19 4c0 13-19 25-19 25z', '#F07A8A'], ['M24 18v13M17.5 24.5h13', 'none', '#FFF8E8', 4.5]],
  pickaxe: [['M25 13 12 44', 'none', INK, 8], ['M25 13 12 44', 'none', '#A0703F', 4.5], ['M5 17C13 6 35 6 43 17c-6-3-12-4-19-4S11 14 5 17z', '#B8C0CC']],
  luck: [['M27 30l9 13', 'none', '#3F7A2A', 4.5], [circ(17.5, 17.5, 7.5), '#6CC04A'], [circ(30.5, 17.5, 7.5), '#6CC04A'], [circ(17.5, 30.5, 7.5), '#6CC04A'], [circ(30.5, 30.5, 7.5), '#6CC04A'], [circ(24, 24, 3), '#3F7A2A', INK, 1.5]],
  drill: [['M7 19h8l20-11v32L15 29H7z', '#F2B705'], ['M10 29l3 11h6l-3-11', '#D9CBB0'], ['M40 16l5-3M41 24h6M40 32l5 3', 'none', INK, 3]],
};

/** Inline SVG markup for a shop tile's full-colour art. */
export function tileArt(name, size = 52) {
  const parts = TILE_ART[name].map(([d, fill = 'none', stroke = INK, width = 2.5]) => `<path d="${d}" fill="${fill}"`
    + ` stroke="${stroke}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"></path>`).join('');
  return `<svg class="art" width="${size}" height="${size}" viewBox="0 0 48 48" aria-hidden="true">${parts}</svg>`;
}
