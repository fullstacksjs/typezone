import { purchase, applyPurchase } from '../shared/shop.js';
import { canClaim, itemUse, applyItem } from '../shared/items.js';
import {
  LANE_LENGTH, LANES, BASE_HP, START_GOLD, PASSIVE_INCOME, OVERTIME_AT, OVERTIME_INCOME,
  SUDDEN_DEATH_AT, SUDDEN_DEATH_DPS, overtimeSpeed, ORE_COUNT, ORE_LEN, GOLD_PER_CHAR, DIAMOND_MULT, DIAMOND_TTL, BOUNTY_SHARE, PRESSURE_MOBS, PRESSURE_INCOME, GOLDEN_MULT, GOLDEN_TTL,
  ULT_MAX, ULT_PER_KILL, ULT_PER_ARMOR, ULT_PER_ORE, MOBS, SPELLS, AIRDROP, ITEMS, comboMultiplier,
} from '../shared/config.js';
import { pickWord } from '../shared/words.js';

const other = (slot) => (slot === 'p1' ? 'p2' : 'p1');
const between = ([lo, hi]) => lo + Math.random() * (hi - lo);

function pickItem() {
  const entries = Object.entries(ITEMS);
  let r = Math.random() * entries.reduce((s, [, def]) => s + def.weight, 0);
  for (const [type, def] of entries) if ((r -= def.weight) <= 0) return type;
  return entries[0][0];
}

/** A viewer's copy of a snapshot: the opponent's items and claims keep their contents hidden. */
export function redact(snapshot, viewer) {
  const foe = other(viewer);
  const hide = (item) => ({ id: item.id, type: null });
  return {
    ...snapshot,
    players: { ...snapshot.players, [foe]: { ...snapshot.players[foe], items: snapshot.players[foe].items.map(hide) } },
    events: snapshot.events.map((e) => (e.e === 'claim' && e.slot === foe ? { ...e, item: hide(e.item) } : e)),
  };
}

function newPlayer() {
  return {
    hp: BASE_HP,
    gold: START_GOLD,
    combo: 0,
    bestCombo: 0,
    mode: 'gather',
    pickaxe: 0,
    luck: 0,
    drill: 0,
    frostCd: 0,
    items: [],
    charges: Object.fromEntries(Object.entries(MOBS).filter(([, def]) => !def.hidden).map(([type, def]) => [type, { n: def.charges, t: 0 }])),
    frost: 0,
    fog: 0,
    ult: 0,
    ores: [],
    stats: {
      chars: 0, misses: 0, goldEarned: 0, mobsSent: 0, mobsKilled: 0, damageDealt: 0, spells: 0, airdrops: 0,
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
    this.airdrop = null;
    this.nextDrop = AIRDROP.first;
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
    const roll = allowGolden ? Math.random() : 1;
    const diamond = roll < SPELLS.luck.diamond[p.luck];
    const golden = !diamond && roll < SPELLS.luck.diamond[p.luck] + SPELLS.luck.golden[p.luck];
    const word = diamond ? pickWord(8, 11, avoid, exclude)
      : golden ? pickWord(6, 9, avoid, exclude) : pickWord(ORE_LEN[0], ORE_LEN[1], avoid, exclude);
    p.ores.push({ id: this.nextId++, word, golden, diamond, ttl: diamond ? DIAMOND_TTL : golden ? GOLDEN_TTL : null });
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
    const mult = comboMultiplier(p.combo) * (1 + p.pickaxe * SPELLS.pickaxe.bonus) * (ore.diamond ? DIAMOND_MULT : ore.golden ? GOLDEN_MULT : 1);
    const gold = Math.round(ore.word.length * GOLD_PER_CHAR * mult);
    p.gold += gold;
    p.ult = Math.min(ULT_MAX, p.ult + ULT_PER_ORE);
    p.stats.goldEarned += gold;
    p.stats.chars += ore.word.length;
    this.emit({ e: 'gather', slot, gold, golden: ore.golden, diamond: ore.diamond, oreId });
    this.addOre(slot);
  }

  // ---------------------------------------------------------------- mobs
  spawnMob(owner, type, at = 0, lane = null) {
    const def = MOBS[type];
    const target = other(owner);
    const incoming = this.mobs.filter((m) => m.target === target);
    const avoid = new Set(incoming.map((m) => m.words[m.wi]?.[0]));
    const exclude = new Set(incoming.flatMap((m) => m.words));
    if (this.airdrop) {
      avoid.add(this.airdrop.word[0]);
      exclude.add(this.airdrop.word);
    }
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
    if (this.airdrop && mode !== 'fight') this.airdrop.typed[slot] = 0;
  }

  // ---------------------------------------------------------------- airdrops
  spawnAirdrop() {
    // Both players race from Fight mode, so avoid every word either of them could be typing there.
    const avoid = new Set(this.mobs.map((m) => m.words[m.wi]?.[0]));
    const exclude = new Set(this.mobs.flatMap((m) => m.words));
    const word = pickWord(AIRDROP.len[0], AIRDROP.len[1], avoid, exclude);
    this.airdrop = { id: this.nextId++, word, item: pickItem(), ttl: AIRDROP.fall, typed: { p1: 0, p2: 0 } };
    this.emit({ e: 'airdrop', id: this.airdrop.id });
  }

  endAirdrop() {
    this.airdrop = null;
    this.nextDrop = between(AIRDROP.interval);
  }

  claimProgress(slot, id, typed) {
    const drop = this.airdrop;
    if (!drop || drop.id !== id || !canClaim(this.players[slot])) return;
    drop.typed[slot] = Math.max(0, Math.min(typed | 0, drop.word.length));
  }

  /** First valid claim wins; later claims find no crate. */
  claim(slot, id) {
    const p = this.players[slot];
    const drop = this.airdrop;
    if (this.winner || !drop || drop.id !== id || !canClaim(p)) return false;
    p.combo++;
    p.bestCombo = Math.max(p.bestCombo, p.combo);
    p.stats.chars += drop.word.length;
    p.stats.airdrops++;
    const item = { id: this.nextId++, type: drop.item };
    p.items.push(item);
    this.endAirdrop();
    this.emit({ e: 'claim', slot, dropId: id, item });
    return true;
  }

  useItem(slot, id) {
    const p = this.players[slot];
    if (!itemUse(p, id, { ended: !!this.winner, suddenDeath: this.time >= SUDDEN_DEATH_AT }).available) return false;
    const item = applyItem(p, id);
    this.emit({ e: 'item', slot, type: item.type });
    return true;
  }

  // ---------------------------------------------------------------- shop
  buy(slot, item) {
    const p = this.players[slot];
    if (!purchase(p, item, { ended: !!this.winner }).available) return false;
    const foe = this.players[other(slot)];
    applyPurchase(p, item);
    if (MOBS[item]) {
      p.stats.mobsSent++;
      const mob = this.spawnMob(slot, item);
      this.emit({ e: 'send', slot, type: item, lane: mob.lane });
      return true;
    }
    p.stats.spells++;
    if (item === 'fog') foe.fog = SPELLS.fog.duration;
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
      p.frostCd = Math.max(0, p.frostCd - dt);
      for (const [type, charge] of Object.entries(p.charges)) {
        const def = MOBS[type];
        if (charge.n >= def.charges) continue;
        // Store elapsed base recharge seconds so upgrades preserve percentage progress.
        charge.t += dt / (1 - p.drill * SPELLS.drill.reduction);
        while (charge.t >= def.recharge && charge.n < def.charges) {
          charge.t -= def.recharge;
          charge.n++;
        }
        if (charge.n === def.charges) charge.t = 0;
      }
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

    if (this.airdrop) {
      this.airdrop.ttl -= dt;
      if (this.airdrop.ttl <= 0) {
        this.emit({ e: 'airdropLost', id: this.airdrop.id });
        this.endAirdrop();
      }
    } else if (!suddenDeath) {
      // Healing is disabled in sudden death, so crates stop falling.
      this.nextDrop -= dt;
      if (this.nextDrop <= 0) this.spawnAirdrop();
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
        luck: p.luck,
        drill: p.drill,
        frostCd: +p.frostCd.toFixed(2),
        items: p.items.map((it) => ({ ...it })),
        pressured: this.mobs.filter((m) => m.target === slot).length >= PRESSURE_MOBS,
        charges: Object.fromEntries(Object.entries(p.charges).map(([type, charge]) => [type, {
          n: charge.n,
          progress: charge.t / MOBS[type].recharge,
          recharge: MOBS[type].recharge * (1 - p.drill * SPELLS.drill.reduction),
        }])),
        frost: +p.frost.toFixed(2),
        fog: +p.fog.toFixed(2),
        ult: p.ult,
        ores: p.ores.map((o) => ({ id: o.id, word: o.word, golden: o.golden, diamond: o.diamond, ttl: o.ttl == null ? null : +o.ttl.toFixed(2) })),
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
    // The crate's contents never leave the server.
    const drop = this.airdrop;
    const airdrop = drop && { id: drop.id, word: drop.word, ttl: +drop.ttl.toFixed(2), typed: { ...drop.typed } };
    const events = this.events;
    this.events = [];
    return {
      winner: this.winner, time: +this.time.toFixed(2), overtime: this.overtime, suddenDeath: this.time >= SUDDEN_DEATH_AT, players, mobs, airdrop, events,
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
