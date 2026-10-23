import {
  LANE_LENGTH, LANES, BASE_HP, START_GOLD, PASSIVE_INCOME, OVERTIME_AT, OVERTIME_INCOME,
  SUDDEN_DEATH_AT, SUDDEN_DEATH_DPS, overtimeSpeed, ORE_COUNT, ORE_LEN, GOLD_PER_CHAR, GOLDEN_CHANCE, BOUNTY_SHARE, PRESSURE_MOBS, PRESSURE_INCOME, GOLDEN_MULT, GOLDEN_TTL,
  ULT_MAX, ULT_PER_KILL, ULT_PER_ARMOR, ULT_PER_ORE, MOBS, SPELLS, pickaxeCost, comboMultiplier,
} from '../shared/config.js';
import { pickWord } from '../shared/words.js';

const other = (slot) => (slot === 'p1' ? 'p2' : 'p1');

function newPlayer() {
  return {
    hp: BASE_HP,
    gold: START_GOLD,
    combo: 0,
    bestCombo: 0,
    mode: 'gather',
    pickaxe: 0,
    frost: 0,
    fog: 0,
    ult: 0,
    ores: [],
    stats: {
      chars: 0, misses: 0, goldEarned: 0, mobsSent: 0, mobsKilled: 0, damageDealt: 0, spells: 0,
    },
  };
}

/**
 * Authoritative match simulation. Clients report completed words; the game
 * validates them against its own state and advances the world every tick.
 */
export class Game {
  constructor() {
    this.time = 0;
    this.nextId = 1;
    this.players = { p1: newPlayer(), p2: newPlayer() };
    this.mobs = [];
    this.events = [];
    this.winner = null;
    for (const slot of ['p1', 'p2']) {
      for (let i = 0; i < ORE_COUNT; i++) this.addOre(slot, false);
    }
  }

  get overtime() {
    return this.time >= OVERTIME_AT;
  }

  emit(e) {
    this.events.push(e);
  }

  // ---------------------------------------------------------------- ores
  addOre(slot, allowGolden = true) {
    const p = this.players[slot];
    const avoid = new Set(p.ores.map((o) => o.word[0]));
    const exclude = new Set(p.ores.map((o) => o.word));
    const golden = allowGolden && Math.random() < GOLDEN_CHANCE;
    const word = golden ? pickWord(6, 9, avoid, exclude) : pickWord(ORE_LEN[0], ORE_LEN[1], avoid, exclude);
    p.ores.push({ id: this.nextId++, word, golden, ttl: golden ? GOLDEN_TTL : null });
  }

  gather(slot, oreId) {
    const p = this.players[slot];
    if (this.winner || p.mode !== 'gather') return;
    const idx = p.ores.findIndex((o) => o.id === oreId);
    if (idx < 0) return;
    const ore = p.ores[idx];
    p.ores.splice(idx, 1);
    p.combo++;
    p.bestCombo = Math.max(p.bestCombo, p.combo);
    const mult = comboMultiplier(p.combo) * (1 + p.pickaxe * SPELLS.pickaxe.bonus) * (ore.golden ? GOLDEN_MULT : 1);
    const gold = Math.round(ore.word.length * GOLD_PER_CHAR * mult);
    p.gold += gold;
    p.ult = Math.min(ULT_MAX, p.ult + ULT_PER_ORE);
    p.stats.goldEarned += gold;
    p.stats.chars += ore.word.length;
    this.emit({ e: 'gather', slot, gold, golden: ore.golden, oreId });
    this.addOre(slot);
  }

  // ---------------------------------------------------------------- mobs
  spawnMob(owner, type, at = 0, lane = null) {
    const def = MOBS[type];
    const target = other(owner);
    const incoming = this.mobs.filter((m) => m.target === target);
    const avoid = new Set(incoming.map((m) => m.words[m.wi]?.[0]));
    const exclude = new Set(incoming.flatMap((m) => m.words));
    const words = [];
    for (let i = 0; i < def.words; i++) {
      const w = pickWord(def.len[0], def.len[1], i === 0 ? avoid : new Set(), exclude);
      words.push(w);
      exclude.add(w);
    }
    const mob = {
      id: this.nextId++,
      type,
      owner,
      target,
      d: at,
      lane: lane ?? ((Math.random() * LANES) | 0),
      words,
      wi: 0,
      typed: 0,
    };
    this.mobs.push(mob);
    return mob;
  }

  progress(slot, mobId, wi, typed) {
    const mob = this.mobs.find((m) => m.id === mobId);
    if (!mob || mob.target !== slot || mob.wi !== wi) return;
    mob.typed = Math.max(0, Math.min(typed | 0, mob.words[wi].length));
  }

  /** Defender finished word `wi` of a mob heading at their base. */
  hitMob(slot, mobId, wi) {
    const p = this.players[slot];
    if (this.winner || p.mode !== 'fight') return;
    const mob = this.mobs.find((m) => m.id === mobId);
    if (!mob || mob.target !== slot || mob.wi !== wi) return;
    p.combo++;
    p.bestCombo = Math.max(p.bestCombo, p.combo);
    p.stats.chars += mob.words[wi].length;
    this.breakWord(slot, mob, 'type');
  }

  breakWord(slot, mob, cause) {
    const p = this.players[slot];
    mob.wi++;
    mob.typed = 0;
    if (mob.wi < mob.words.length) {
      if (cause === 'type') p.ult = Math.min(ULT_MAX, p.ult + ULT_PER_ARMOR);
      this.emit({ e: 'armor', slot, mobId: mob.id, cause });
      return;
    }
    const def = MOBS[mob.type];
    this.mobs.splice(this.mobs.indexOf(mob), 1);
    const bounty = Math.round((def.bountyCost ?? def.cost) * BOUNTY_SHARE
      * comboMultiplier(p.combo) * (1 + p.pickaxe * SPELLS.pickaxe.bonus));
    p.gold += bounty;
    p.stats.goldEarned += bounty;
    p.stats.mobsKilled++;
    if (cause === 'type') p.ult = Math.min(ULT_MAX, p.ult + ULT_PER_KILL);
    this.emit({ e: 'kill', slot, mobId: mob.id, type: mob.type, x: this.absX(mob), lane: mob.lane, bounty, cause });
    if (def.splits) {
      for (let i = 0; i < def.splits.count; i++) {
        const lane = Math.max(0, Math.min(LANES - 1, mob.lane + (i === 0 ? -1 : 1)));
        this.spawnMob(mob.owner, def.splits.into, Math.max(0, mob.d - 20 - i * 25), lane);
      }
    }
  }

  miss(slot) {
    const p = this.players[slot];
    p.combo = 0;
    p.stats.misses++;
  }

  setMode(slot, mode) {
    if (mode !== 'gather' && mode !== 'fight') return;
    this.players[slot].mode = mode;
  }

  // ---------------------------------------------------------------- shop
  buy(slot, item) {
    const p = this.players[slot];
    if (this.winner) return false;
    const foe = this.players[other(slot)];

    if (MOBS[item] && !MOBS[item].hidden) {
      const def = MOBS[item];
      if (p.gold < def.cost) return false;
      p.gold -= def.cost;
      p.stats.mobsSent++;
      const mob = this.spawnMob(slot, item);
      this.emit({ e: 'send', slot, type: item, lane: mob.lane });
      return true;
    }

    const spell = SPELLS[item];
    if (!spell) return false;
    const cost = item === 'pickaxe' ? pickaxeCost(p.pickaxe) : spell.cost;
    if (cost == null || p.gold < cost) return false;
    if (item === 'repair' && (p.hp >= BASE_HP || this.time >= SUDDEN_DEATH_AT)) return false;
    p.gold -= cost;
    p.stats.spells++;
    if (item === 'frost') p.frost = spell.duration;
    if (item === 'fog') foe.fog = spell.duration;
    if (item === 'repair') p.hp = Math.min(BASE_HP, p.hp + spell.amount);
    if (item === 'pickaxe') p.pickaxe++;
    this.emit({ e: 'spell', slot, spell: item });
    return true;
  }

  ultimate(slot) {
    const p = this.players[slot];
    if (this.winner || p.ult < ULT_MAX) return;
    p.ult = 0;
    const struck = this.mobs.filter((m) => m.target === slot);
    this.emit({ e: 'ult', slot, targets: struck.map((m) => ({ x: this.absX(m), lane: m.lane })) });
    for (const mob of struck) this.breakWord(slot, mob, 'ult');
  }

  // ---------------------------------------------------------------- tick
  absX(mob) {
    return mob.owner === 'p1' ? mob.d : LANE_LENGTH - mob.d;
  }

  speedOf(mob) {
    const def = MOBS[mob.type];
    const frosted = this.players[mob.target].frost > 0;
    return def.speed * (frosted ? SPELLS.frost.slow : 1) * overtimeSpeed(this.time);
  }

  update(dt) {
    if (this.winner) return;
    const before = this.time;
    this.time += dt;
    if (before < OVERTIME_AT && this.time >= OVERTIME_AT) this.emit({ e: 'overtime' });
    if (before < SUDDEN_DEATH_AT && this.time >= SUDDEN_DEATH_AT) this.emit({ e: 'suddenDeath' });
    const suddenDeath = this.time >= SUDDEN_DEATH_AT;

    for (const slot of ['p1', 'p2']) {
      const p = this.players[slot];
      const pressured = this.mobs.filter((m) => m.target === slot).length >= PRESSURE_MOBS;
      const income = PASSIVE_INCOME * dt * (this.overtime ? OVERTIME_INCOME : 1) * (pressured ? PRESSURE_INCOME : 1);
      p.gold += income;
      p.frost = Math.max(0, p.frost - dt);
      p.fog = Math.max(0, p.fog - dt);
      if (suddenDeath) p.hp = Math.max(0, p.hp - SUDDEN_DEATH_DPS * dt);
      for (const ore of [...p.ores]) {
        if (ore.ttl == null) continue;
        ore.ttl -= dt;
        if (ore.ttl <= 0) {
          p.ores.splice(p.ores.indexOf(ore), 1);
          this.addOre(slot, false);
        }
      }
    }

    for (const mob of [...this.mobs]) {
      mob.d += this.speedOf(mob) * dt;
      if (mob.d >= LANE_LENGTH) {
        const dmg = MOBS[mob.type].damage;
        const target = this.players[mob.target];
        target.hp = Math.max(0, target.hp - dmg);
        target.combo = 0;
        this.players[mob.owner].stats.damageDealt += dmg;
        this.mobs.splice(this.mobs.indexOf(mob), 1);
        this.emit({ e: 'baseHit', slot: mob.target, dmg, mobId: mob.id, lane: mob.lane });
      }
    }

    const { p1, p2 } = this.players;
    if (p1.hp <= 0 && p2.hp <= 0) this.winner = p1.hp === p2.hp ? (Math.random() < 0.5 ? 'p1' : 'p2') : p1.hp > p2.hp ? 'p1' : 'p2';
    else if (p1.hp <= 0) this.winner = 'p2';
    else if (p2.hp <= 0) this.winner = 'p1';
  }

  forfeit(slot) {
    if (!this.winner) this.winner = other(slot);
  }

  // ---------------------------------------------------------------- output
  snapshot() {
    const players = {};
    for (const slot of ['p1', 'p2']) {
      const p = this.players[slot];
      players[slot] = {
        hp: Math.ceil(p.hp),
        gold: Math.floor(p.gold),
        combo: p.combo,
        mode: p.mode,
        pickaxe: p.pickaxe,
        pressured: this.mobs.filter((m) => m.target === slot).length >= PRESSURE_MOBS,
        frost: +p.frost.toFixed(2),
        fog: +p.fog.toFixed(2),
        ult: p.ult,
        ores: p.ores.map((o) => ({ id: o.id, word: o.word, golden: o.golden, ttl: o.ttl == null ? null : +o.ttl.toFixed(2) })),
      };
    }
    const mobs = this.mobs.map((m) => ({
      id: m.id,
      type: m.type,
      owner: m.owner,
      target: m.target,
      x: +this.absX(m).toFixed(1),
      vx: +((m.owner === 'p1' ? 1 : -1) * this.speedOf(m)).toFixed(1),
      lane: m.lane,
      words: m.words,
      wi: m.wi,
      typed: m.typed,
    }));
    const events = this.events;
    this.events = [];
    return {
      time: +this.time.toFixed(2), overtime: this.overtime, suddenDeath: this.time >= SUDDEN_DEATH_AT, players, mobs, events,
    };
  }

  summary() {
    const out = {};
    for (const slot of ['p1', 'p2']) {
      const p = this.players[slot];
      const minutes = Math.max(this.time / 60, 1 / 60);
      out[slot] = {
        ...p.stats,
        bestCombo: p.bestCombo,
        hp: p.hp,
        wpm: Math.round(p.stats.chars / 5 / minutes),
        accuracy: p.stats.chars + p.stats.misses === 0
          ? 100
          : Math.round((p.stats.chars / (p.stats.chars + p.stats.misses)) * 100),
      };
    }
    return { winner: this.winner, time: Math.round(this.time), stats: out };
  }
}
