// Pixel characters: the wizard on each castle and the miner in each mine. One grid each, recoloured per team.

const TEAM = {
  me: { main: '#2F6FE0', dark: '#1C4398', orb: '#8FD3FF' },
  opp: { main: '#E8681C', dark: '#A8410A', orb: '#FFD08A' },
};

// 24×30, facing right (toward the enemy); staff + orb on the right.
const WIZARD = [
  '.........KKK............',
  '........KHHHK...........',
  '.......KHHSHHK..........',
  '......KHHSSSHK..........',
  '......KHHHSHHHK.........',
  '.....KHHHHHHHHK.........',
  '.....KhHHHHHHHHK........',
  '....KhhHHHHHHHHK........',
  '..KKKKKKKKKKKKKKKKK.....',
  '..KhhhhhhhhhhhhhhhK..KK.',
  '...KKFFFFFFFFFFFKK..KOOK',
  '....KFFEFFFFEFFFK..KOOoK',
  '....KFFFFFFFFFFFK..KOooK',
  '....KWFFFFFFFFFWK...KKK.',
  '...KWWWWWWWWWWWWWK...T..',
  '..KRWWWWWWWWWWWWWRK.KTK.',
  '.KRRKWWWWWWWWWWWKRRKFTK.',
  '.KRRRKWWWWWWWWWKRRRKKTK.',
  '.KRRRRKWWWWWWWKRRRRK.T..',
  '.KrRRRRKWWWWWKRRRRrK.T..',
  '.KrRRRRRKWWWKRRRRRrK.T..',
  '.KrrRRRRRKWKRRRRRrrK.T..',
  '.KrrRRRRRRKRRRRRRrrK.T..',
  '..KrrRRRRRRRRRRRRrK..T..',
  '..KrrRRRRRRRRRRRRrK..T..',
  '..KrrrRRRRRRRRRRrrK..T..',
  '...KrrrRRRRRRRRrrK...T..',
  '...KrrrrrrrrrrrrrK...T..',
  '...KKKKKKKKKKKKKKK..KTK.',
  '....KK.......KK.....KTK.',
];

// 22×21; the pickaxe is its own layer so it can swing.
const MINER = [
  '......KKKKK...........',
  '.....KHHHHHK..........',
  '....KHHHHHLLK.........',
  '....KhHHHHLLK.........',
  '...KKKKKKKKKKK........',
  '....KFFFFFFFK.........',
  '....KFFFFEFFK.........',
  '....KFFFFFFFK.........',
  '....KBBBBBBBK.........',
  '...KRBBBBBBBRK........',
  '..KRRRBBBBBRRRK.......',
  '..KRRRRBBBRRRRK.......',
  '..KrRRRRRRRRRRK.......',
  '..KrRRRRRRRRRRFK......',
  '..KGGGGGYGGGGGK.......',
  '...KPPPPPPPPPK........',
  '...KPPPPKPPPPK........',
  '...KPPPK.KPPPK........',
  '...KSSSK.KSSSK........',
  '..KSSSSK.KSSSSK.......',
  '..KKKKK...KKKKK.......',
];
const px = (list) => list.map(([x, y]) => `M${x} ${y}h1v1h-1z`).join('');
const PICK = [
  { d: px([[15, 13], [16, 12], [16, 11], [17, 10], [17, 9], [18, 8], [18, 7], [18, 6]]), fill: '#8A7348' },
  { d: px([[14, 6], [15, 5], [16, 4], [17, 4], [18, 4], [19, 4], [20, 5], [21, 6]]), fill: '#B8C0CC' },
  { d: px([[15, 6], [16, 5], [17, 5], [19, 5], [20, 6]]), fill: '#7A808A' },
];

/** One `{d, fill}` per colour: pixel paths for a grid in the given palette. */
function layers(rows, pal) {
  const b = {};
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const ch = row[x];
      if (pal[ch]) b[ch] = (b[ch] ?? '') + `M${x} ${y}h1v1h-1z`;
    }
  });
  return Object.keys(b).map((ch) => ({ d: b[ch], fill: pal[ch] }));
}

const wizardPal = (t) => ({
  K: '#1B1420', S: '#F6E7A1', F: '#F1C9A5', E: '#1B1420', W: '#EDEDED', T: '#8A7348',
  H: t.main, h: t.dark, R: t.main, r: t.dark, O: t.orb, o: t.main,
});
const minerPal = (t) => ({
  K: '#1B1420', L: '#FFD34D', F: '#F1C9A5', E: '#1B1420', B: '#C97B3A', G: '#2B2118', Y: '#FFD34D', P: '#4A3828', S: '#2B2118',
  H: t.main, h: t.dark, R: t.main, r: t.dark,
});

/** Wizard sprite for a side ('me' | 'opp'): 24×30 pixel layers, facing right. */
export const WIZARD_ART = { me: layers(WIZARD, wizardPal(TEAM.me)), opp: layers(WIZARD, wizardPal(TEAM.opp)) };
export const WIZARD_SIZE = { w: 24, h: 30 };
/** The staff orb's centre in wizard pixels: where keystroke bolts leave from. */
export const WIZARD_ORB = { x: 22, y: 11 };

const path = ({ d, fill }) => `<path d="${d}" fill="${fill}"></path>`;

/** Inline SVG markup for a wizard on the given side ('me' | 'opp'), facing right. */
export function wizardSvg(side, cls = '') {
  return `<svg class="${cls}" viewBox="0 0 ${WIZARD_SIZE.w} ${WIZARD_SIZE.h}" shape-rendering="crispEdges" aria-hidden="true">`
    + WIZARD_ART[side].map(path).join('')
    + '</svg>';
}

/** Inline SVG markup for a miner on the given side ('me' | 'opp'). */
export function minerSvg(side) {
  return '<svg class="miner" viewBox="0 0 22 22" shape-rendering="crispEdges" aria-hidden="true">'
    + layers(MINER, minerPal(TEAM[side])).map(path).join('')
    + `<g class="swing">${PICK.map(path).join('')}</g>`
    + '</svg>';
}
