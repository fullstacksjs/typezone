// Game tuning shared by server (simulation) and client (UI / rendering).

export const TICK_MS = 50;
export const LANE_LENGTH = 1000;
export const LANES = 3;
export const BASE_HP = 100;
export const START_GOLD = 30;
export const PASSIVE_INCOME = 0.6; // gold per second
export const COUNTDOWN_SECONDS = 3;

export const OVERTIME_AT = 150; // seconds; mobs speed up over time, income doubles
export const OVERTIME_SPEED = 1.25; // speed multiplier when overtime begins
export const OVERTIME_RAMP = 0.15; // extra speed multiplier per 30s of overtime
export const OVERTIME_INCOME = 2;
export const SUDDEN_DEATH_AT = 300; // both bases crumble from here on; no airdrops or healing
export const SUDDEN_DEATH_DPS = 1;

// Gathering
export const ORE_COUNT = 4;
export const ORE_LEN = [3, 8];
export const GOLD_PER_CHAR = 1.6;
export const COMBO_STEP = 0.1; // +10% gold per combo level
export const COMBO_CAP = 15; // max multiplier = 1 + 15 * 0.1 = 2.5x
export const GOLDEN_CHANCE = 0.12;
export const GOLDEN_MULT = 3;
export const DIAMOND_MULT = 5;
export const DIAMOND_TTL = 7;
export const BOUNTY_SHARE = 0.5;
export const PRESSURE_MOBS = 3;
export const PRESSURE_INCOME = 1.5;
export const GOLDEN_TTL = 7; // seconds before a golden ore crumbles

// Ultimate: Lightning strips the current word off every incoming mob
export const ULT_MAX = 100;
export const ULT_PER_KILL = 12;
export const ULT_PER_ARMOR = 4;
export const ULT_PER_ORE = 2;

export const MOBS = {
  goblin: {
    key: '1', name: 'Goblin', cost: 20, speed: 78, damage: 5, words: 1, len: [4, 6], charges: 3, recharge: 4,
    desc: 'Fast & cheap',
  },
  knight: {
    key: '2', name: 'Knight', cost: 45, speed: 50, damage: 10, words: 2, len: [5, 8], charges: 2, recharge: 8,
    desc: 'Armored: 2 words',
  },
  slime: {
    key: '3', name: 'Slime', cost: 35, speed: 56, damage: 6, words: 1, len: [6, 8], charges: 2, recharge: 12,
    desc: 'Splits into 2 slimelets', splits: { into: 'slimelet', count: 2 },
  },
  giant: {
    key: '4', name: 'Giant', cost: 90, speed: 30, damage: 25, words: 3, len: [7, 11], charges: 1, recharge: 20,
    desc: 'Slow, 3 long words, huge damage',
  },
  slimelet: {
    hidden: true, name: 'Slimelet', cost: 0, speed: 72, damage: 3, words: 1, len: [3, 4], bountyCost: 6,
  },
};

export const SPELLS = {
  luck: { key: '9', name: 'Luck', costs: [50, 90, 140], golden: [GOLDEN_CHANCE, 0.20, 0.28, 0.36], diamond: [0, 0, 0, 0.04], desc: 'Better ores; diamond at level 3' },
  drill: { key: '0', name: 'Drill Sergeant', costs: [60, 100, 150], reduction: 0.15, desc: 'Recharge mobs 15% faster' },
  frost: { key: '5', name: 'Frost', cost: 40, duration: 6, cooldown: 15, slow: 0.4, desc: 'Slow incoming mobs 60%' },
  fog: { key: '6', name: 'Fog', cost: 45, duration: 7, desc: "Blur the opponent's words" },
  pickaxe: { key: '8', name: 'Pickaxe', costs: [40, 70, 110, 160], bonus: 0.25, desc: '+25% gather gold' },
};

// Airdrops: a crate with a hidden item falls over the field. The first player to type its word in Fight mode claims it.
export const AIRDROP = {
  first: 30, // seconds into the match
  interval: [35, 45], // seconds between one crate resolving and the next appearing
  fall: 12, // seconds before an unclaimed crate is lost
  len: [6, 9],
};
export const ITEM_SLOTS = 2;
export const ITEM_KEY = '7'; // uses the oldest held item
export const ITEMS = {
  heal: { name: 'Heal', amount: 20, weight: 1, desc: '+20 base HP' },
};

export const BOT_LEVELS = {
  easy: { cps: 2.6, accuracy: 0.9, reaction: 1.4 },
  normal: { cps: 4.0, accuracy: 0.94, reaction: 0.9 },
  hard: { cps: 5.8, accuracy: 0.97, reaction: 0.5 },
};

export function overtimeSpeed(time) {
  if (time < OVERTIME_AT) return 1;
  return OVERTIME_SPEED + Math.floor((time - OVERTIME_AT) / 30) * OVERTIME_RAMP;
}

export function pickaxeCost(level) {
  return SPELLS.pickaxe.costs[level] ?? null;
}

export function comboMultiplier(combo) {
  return 1 + Math.min(combo, COMBO_CAP) * COMBO_STEP;
}
