// Stroke icon set (24×24 viewBox). Replaces emoji, which render inconsistently across platforms.

export const ICON_PATHS = {
  goblin: 'M5 8l4 3M19 8l-4 3M12 20a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM10 12h.01M14 12h.01',
  knight: 'M6 21V11a6 6 0 0 1 12 0v10zM6 14h12M12 14v7',
  slime: 'M4 19c0-7 3-11 8-11s8 4 8 11zM10 14h.01M14 14h.01',
  giant: 'M5 20l8-8M12 4a4 4 0 1 1 7 4l-4 4-4-4z',
  frost: 'M12 2v20M3.3 7l17.4 10M20.7 7 3.3 17M9 4l3 2 3-2M9 20l3-2 3 2',
  fog: 'M4 10h13M2 14h18M6 18h11M8 6h8',
  repair: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10zM12 8v7M8.5 11.5h7',
  pickaxe: 'M4 9c4-5 12-5 16 0M12 6 6 20',
  sword: 'M14.5 17.5 3 6V3h3l11.5 11.5M13 19l6-6M16 16l4 4M19 21l2-2M14.5 6.5 18 3h3v3l-3.5 3.5M5 14l4 4M7 17l-3 3M3 19l2 2',
  bolt: 'M13 2 3 14h9l-1 8 10-12h-9z',
  warn: 'M12 3 2 21h20zM12 10v5M12 18h.01',
  flame: 'M12 22c4 0 7-3 7-7 0-5-5-7-5-12-3 2-4 5-4 7-1-1-2-2-2-4-2 2-3 5-3 9 0 4 3 7 7 7z',
  skull: 'M12 3a8 8 0 0 0-5 14v3h10v-3a8 8 0 0 0-5-14zM9 12h.01M15 12h.01M10 20v-2M14 20v-2',
  soundOn: 'M11 5 6 9H2v6h4l5 4zM15.5 8.5a5 5 0 0 1 0 7',
  soundOff: 'M11 5 6 9H2v6h4l5 4zM22 9l-6 6M16 9l6 6',
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
