import { itemCost, purchase, offerOf, PICKAXE } from '../../shared/shop.js';
import { itemUse } from '../../shared/items.js';
import {
  BASE_HP, MOBS, SPELLS, ITEMS, ITEM_SLOTS, ITEM_KEY, ULT_MAX, GOLD_PER_CHAR, GOLDEN_MULT, GOLDEN_TTL, DIAMOND_MULT, DIAMOND_TTL, comboMultiplier,
} from '../../shared/config.js';
import { icon, gem, tileArt } from './icons.js';
import { nugget, orePalette } from './nugget.js';
import { minerSvg } from './pixel.js';

export const $ = (sel) => document.querySelector(sel);

// The console's trays, in key order 1–0. Supplies hold airdrop items rather than purchases.
export const SHOP_GROUPS = [
  { name: 'Barracks: send units', cls: 'barracks', glyph: 'flag', items: ['goblin', 'knight', 'slime', 'giant'] },
  { name: 'Arcane: spells', cls: 'arcane', glyph: 'sparkle', items: ['frost', 'fog'] },
  { name: 'Supplies: airdrop items', cls: 'supplies', glyph: 'crate', slots: ITEM_SLOTS, items: [] },
  { name: 'Upgrades: permanent', cls: 'upgrades', glyph: 'up', items: ['pickaxe', 'luck', 'drill'] },
];

export const SHOP_ITEMS = SHOP_GROUPS.flatMap((g) => g.items).map((id) => {
  const def = MOBS[id] ?? SPELLS[id];
  return { id, key: def.key, name: def.name, desc: def.desc };
});

export function showScreen(id) {
  for (const el of document.querySelectorAll('.screen')) el.classList.toggle('active', el.id === id);
}

/** `onUse` receives a slot index; the caller resolves it against its predicted items. */
export function buildShop(onBuy, onUse) {
  const shop = $('#shop');
  shop.innerHTML = '';
  for (const g of SHOP_GROUPS) {
    const tray = document.createElement('div');
    tray.className = `tray ${g.cls}`;
    tray.setAttribute('role', 'group');
    tray.setAttribute('aria-label', g.name);
    tray.style.setProperty('--n', g.slots ?? g.items.length);
    tray.innerHTML = `<span class="tray-badge" aria-hidden="true">${icon(g.glyph, { size: 16, width: 3 })}</span>`;
    for (let i = 0; i < (g.slots ?? 0); i++) {
      const el = document.createElement('button');
      el.className = 'tile slot empty';
      el.dataset.slot = i;
      el.tabIndex = -1;
      el.innerHTML = '<span class="tile-face">'
        + '<svg class="ring" viewBox="0 0 120 120" aria-hidden="true"><circle cx="60" cy="60" r="45"></circle></svg>'
        + `<span class="slot-art">${tileArt('crate')}</span>`
        + (i === 0 ? `<kbd class="key">${ITEM_KEY}</kbd>` : '')
        + '</span><span class="cost"><span></span></span>';
      el.addEventListener('mousedown', (e) => {
        e.preventDefault();
        onUse(i);
      });
      tray.appendChild(el);
    }
    for (const id of g.items) {
      const it = SHOP_ITEMS.find((x) => x.id === id);
      const el = document.createElement('button');
      el.className = 'tile';
      el.dataset.id = id;
      el.tabIndex = -1;
      el.title = `${it.name}: ${it.desc}`;
      el.innerHTML = '<span class="tile-face">'
        + '<svg class="ring" viewBox="0 0 120 120" aria-hidden="true"><circle cx="60" cy="60" r="45"></circle><g class="arcs"></g></svg>'
        + tileArt(id)
        + `<span class="tile-cd hidden"><span class="cd-chip">${icon('clock', { size: 14, width: 3 })}<span></span></span></span>`
        + `<kbd class="key">${it.key}</kbd>`
        + (MOBS[id] ? `<span class="send-badge" aria-hidden="true">${icon('arrowRight', { size: 14, width: 3.5 })}</span>` : '')
        + `</span><span class="cost">${gem(13)}<span></span></span>`;
      el.addEventListener('mousedown', (e) => {
        e.preventDefault();
        onBuy(id);
      });
      tray.appendChild(el);
    }
    shop.appendChild(tray);
  }
}

/** Puts a pixel miner in each mine. */
export function buildMiners() {
  for (const side of ['me', 'opp']) $(`.mine.${side} .miner-spot`).insertAdjacentHTML('beforeend', minerSvg(side));
}

export function flashShop(id, ok) {
  const el = document.querySelector(typeof id === 'number' ? `.slot[data-slot="${id}"]` : `.tile[data-id="${id}"]`);
  if (!el) return;
  const cls = ok ? 'flash' : 'denied';
  el.classList.remove(cls);
  void el.offsetWidth;
  el.classList.add(cls);
  setTimeout(() => el.classList.remove(cls), 200);
}

let alertTimer = null;
let alertPriority = 0;
/**
 * Toast at the top of the field. `kind`: 'info' (enemy news), 'mine' (good news) or 'danger'.
 * `ico` names an icon from icons.js; `sub` is a quieter trailing note.
 */
export function showAlert(text, kind = 'info', ms = 1800, priority = 1, ico = null, sub = '') {
  const el = $('#alert');
  if (el.classList.contains('show') && priority < alertPriority) return;
  alertPriority = priority;
  el.innerHTML = (ico ? `<span class="alert-icon">${icon(ico, { size: 18, width: 3 })}</span>` : '')
    + `<span>${escapeHtml(text)}</span>`
    + (sub ? `<span class="alert-sub">${escapeHtml(sub)}</span>` : '');
  el.className = `alert show ${kind}`;
  clearTimeout(alertTimer);
  alertTimer = setTimeout(() => {
    el.classList.remove('show');
    alertPriority = 0;
  }, ms);
}

/** A typo while mining shakes the ore you're on. */
export function flashMiss() {
  const el = document.querySelector('#ores .ore.locked');
  if (!el) return;
  el.classList.remove('err');
  void el.offsetWidth;
  el.classList.add('err');
}

const fmtTime = (t) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;

function statusTags(p) {
  let s = '';
  if (p.frost > 0) s += `<span class="status-tag frost" aria-label="Frost, ${Math.ceil(p.frost)} seconds">${icon('frost', { size: 18, width: 2.6 })}${Math.ceil(p.frost)}</span>`;
  if (p.fog > 0) s += `<span class="status-tag fog" aria-label="Fogged, ${Math.ceil(p.fog)} seconds">${icon('fog', { size: 18, width: 2.6 })}${Math.ceil(p.fog)}</span>`;
  return s;
}

const lastHp = { me: BASE_HP, opp: BASE_HP };
let lastCombo = 0;
let lastOreSig = '';
let lastRockSig = '';
let lastStatusSig = '';
const lastTileSig = new Map();

export function resetHud() {
  lastHp.me = BASE_HP;
  lastHp.opp = BASE_HP;
  lastCombo = 0;
  lastOreSig = '';
  lastRockSig = '';
  lastStatusSig = '';
  lastTileSig.clear();
}

// Tile rings: one arc per charge (mobs) or level (upgrades); spells get a plain ring.
const ringPt = (deg, r) => {
  const a = ((deg - 90) * Math.PI) / 180;
  return `${(60 + r * Math.cos(a)).toFixed(1)} ${(60 + r * Math.sin(a)).toFixed(1)}`;
};
const ringArc = (a0, a1) => `M${ringPt(a0, 53)} A53 53 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${ringPt(a1, 53)}`;
const arcPath = (d, c) => `<path d="${d}" fill="none" stroke="${c}" stroke-width="11"></path>`;

/** `fills` holds 0–1 per segment. */
function ringArcs(fills, color) {
  if (!fills.length) return arcPath(ringArc(0, 359.9), '#C9B48E');
  const span = 360 / fills.length;
  const gap = fills.length > 1 ? 9 : 0;
  return fills.map((f, i) => {
    const a0 = i * span + gap / 2;
    const a1 = (i + 1) * span - gap / 2;
    return arcPath(ringArc(a0, a1), '#E9D9B8') + (f > 0 ? arcPath(ringArc(a0, a0 + (a1 - a0) * Math.min(f, 0.999)), color) : '');
  }).join('');
}

function updateTile(el, me, snap) {
  const id = el.dataset.id;
  const cost = itemCost(id, me);
  const charge = me.charges[id];
  let fills = [];
  let color = '#2F6FE0';
  let cd = 0;
  if (charge) {
    const max = MOBS[id].charges;
    fills = Array.from({ length: max }, (_, i) => (i < charge.n ? 1 : i === charge.n ? Math.floor(charge.progress * 50) / 50 : 0));
    if (charge.n === 0) cd = Math.ceil((1 - charge.progress) * charge.recharge);
  } else if (SPELLS[id].costs) {
    fills = SPELLS[id].costs.map((_, i) => (i < me[id] ? 1 : 0));
    color = '#F2B705';
  } else {
    cd = Math.ceil(offerOf(id).cooldown(me));
  }
  const afford = cost != null && me.gold >= cost;
  const usable = purchase(me, id, { ended: !!snap.winner, tutorial: snap.tutorial }).available;
  el.disabled = !usable;

  const sig = `${fills.join(',')}|${cost}|${afford}|${cd}|${usable}`;
  if (lastTileSig.get(id) === sig) return;
  lastTileSig.set(id, sig);
  el.querySelector('.arcs').innerHTML = ringArcs(fills, color);
  el.classList.toggle('poor', !afford);
  el.classList.toggle('unusable', !usable);
  el.classList.toggle('maxed', cost == null);
  el.querySelector('.tile-cd').classList.toggle('hidden', cd === 0);
  el.querySelector('.cd-chip span').textContent = `${cd}s`;
  el.querySelector('.cost span').textContent = cost == null ? 'MAX' : cost;
  const name = SHOP_ITEMS.find((x) => x.id === id).name;
  el.setAttribute('aria-label', `${name}, ${cost == null ? 'maxed' : `${cost} gold`}`
    + `${cost != null && !afford ? ', not enough gold' : ''}${cd ? ', recharging' : ''}`);
}

export function updateHud({ snap, you, mode, lock, danger }) {
  const opp = you === 'p1' ? 'p2' : 'p1';
  const me = snap.players[you];
  const op = snap.players[opp];

  const game = $('#game');
  game.classList.toggle('gather', mode === 'gather');
  game.classList.toggle('fight', mode === 'fight');
  game.classList.toggle('fog', me.fog > 0);

  for (const [side, p] of [['me', me], ['opp', op]]) {
    const bar = $(`#${side}-hp`).parentElement;
    $(`#${side}-hp`).style.width = `${(p.hp / BASE_HP) * 100}%`;
    $(`#${side}-hp-text`).textContent = Math.ceil(p.hp);
    $(`#${side}-gold`).textContent = p.gold;
    bar.classList.toggle('low', p.hp <= BASE_HP * 0.3);
    if (p.hp < lastHp[side]) {
      bar.classList.remove('hit');
      void bar.offsetWidth;
      bar.classList.add('hit');
    }
    lastHp[side] = p.hp;
  }
  $('#opp-gold-pill').setAttribute('aria-label', `Opponent's gold: ${op.gold}`);
  const statusSig = `${Math.ceil(me.frost)}|${Math.ceil(me.fog)}|${Math.ceil(op.frost)}|${Math.ceil(op.fog)}`;
  if (statusSig !== lastStatusSig) {
    lastStatusSig = statusSig;
    $('#me-status').innerHTML = statusTags(me);
    $('#opp-status').innerHTML = statusTags(op);
  }

  // Lightning: a gold line tucked under each HP bar.
  for (const [sel, p] of [['#ult', me], ['#opp-ult', op]]) {
    const pct = Math.min(100, Math.floor((p.ult / ULT_MAX) * 100));
    $(`${sel}-fill`).style.width = `${pct}%`;
    $(sel).classList.toggle('ready', pct >= 100);
  }
  $('#ult').setAttribute('aria-label', `Your Lightning ${Math.min(100, Math.floor((me.ult / ULT_MAX) * 100))}%, press Enter when full`);

  // Opponent stance: their miner swings and their lamps glow while they mine. That's the cue to attack.
  $('#opp-mine').classList.toggle('active', op.mode === 'gather');
  $('#opp-mine').setAttribute('aria-label', op.mode === 'gather' ? 'Opponent is mining right now' : 'Opponent is defending');

  $('#timer').textContent = snap.tutorial ? 'Tutorial' : fmtTime(snap.time);
  $('.timer-tab').classList.toggle('ot', snap.overtime || snap.suddenDeath);
  $('#vignette').classList.toggle('hidden', !snap.overtime);
  $('#fog-mist').classList.toggle('hidden', !(me.fog > 0));

  $('#gate-alert').classList.toggle('hidden', !(mode !== 'fight' && danger > 0));
  $('#mine-hint').textContent = me.pressured ? 'Under pressure · +50% income' : '';

  // Combo
  const comboEl = $('#combo');
  comboEl.textContent = `×${comboMultiplier(me.combo).toFixed(1)}`;
  comboEl.classList.toggle('hidden', me.combo === 0);
  if (me.combo > lastCombo) {
    comboEl.classList.add('bump');
    setTimeout(() => comboEl.classList.remove('bump'), 100);
  }
  lastCombo = me.combo;

  for (const el of document.querySelectorAll('.tile[data-id]')) updateTile(el, me, snap);
  for (const el of document.querySelectorAll('.slot')) updateSlot(el, me, snap);

  renderOres(me, lock);
  renderOppRocks(op);
}

/** Item slots show held items' contents; airdrop contents are only revealed to the winner. */
function updateSlot(el, me, snap) {
  const i = Number(el.dataset.slot);
  const item = me.items[i];
  const usable = !!item && itemUse(me, item.id, { ended: !!snap.winner, suddenDeath: snap.suddenDeath, tutorial: snap.tutorial }).available;
  const sig = `${item?.id}|${usable}`;
  if (lastTileSig.get(`slot${i}`) === sig) return;
  lastTileSig.set(`slot${i}`, sig);
  const def = item && ITEMS[item.type];
  el.disabled = !usable;
  el.classList.toggle('empty', !item);
  el.classList.toggle('unusable', !!item && !usable);
  if (item) {
    el.classList.remove('got');
    void el.offsetWidth;
    el.classList.add('got');
  }
  el.querySelector('.slot-art').innerHTML = tileArt(def ? item.type : 'crate');
  el.querySelector('.cost span').textContent = def ? def.name : 'Empty';
  el.title = def ? `${def.name}: ${def.desc}` : 'Empty slot: win airdrops in Fight mode';
  el.setAttribute('aria-label', def ? `${def.name}, ${def.desc}${usable ? '' : ', cannot use now'}` : 'Empty item slot');
}

function renderOres(me, lock) {
  const fog = me.fog > 0;
  const ores = me.ores;
  const lockOre = lock?.kind === 'ore' ? lock : null;
  const sig = ores.map((o) => `${o.id}:${o.ttl == null ? '' : Math.ceil(o.ttl)}`).join(',')
    + `|${lockOre?.id}:${lockOre?.typed}|${fog}|${me.combo}|${me.pickaxe}`;
  if (sig === lastOreSig) return;
  lastOreSig = sig;

  const mult = comboMultiplier(me.combo + 1) * PICKAXE.multiplier(me);
  const box = $('#ores');
  const existing = new Map([...box.children].map((el) => [Number(el.dataset.id), el]));
  const keep = new Set();
  for (const ore of ores) {
    let el = existing.get(ore.id);
    if (!el) {
      el = document.createElement('div');
      el.dataset.id = ore.id;
      el.className = 'ore pop';
      box.appendChild(el);
    }
    keep.add(ore.id);
    const typed = lockOre?.id === ore.id ? lockOre.typed : 0;
    el.classList.toggle('golden', ore.golden);
    el.classList.toggle('diamond', ore.diamond);
    el.classList.toggle('locked', lockOre?.id === ore.id);
    const done = ore.word.slice(0, typed);
    const gain = Math.round(ore.word.length * GOLD_PER_CHAR * mult * (ore.diamond ? DIAMOND_MULT : ore.golden ? GOLDEN_MULT : 1));
    const left = ore.ttl == null ? 0 : Math.round((ore.ttl / (ore.diamond ? DIAMOND_TTL : GOLDEN_TTL)) * 100);
    el.innerHTML = nugget(orePalette(ore))
      + '<div class="ore-info"><span class="w">'
      + (done ? `<span class="t-done">${done}</span>` : '')
      + `<span class="nx">${ore.word.charAt(typed)}</span><span class="far">${ore.word.slice(typed + 1)}</span></span>`
      + `<span class="gain">${gem(11)}+${gain}`
      + (ore.ttl != null ? `<span class="ttl" style="--left:${left}%" aria-label="crumbles in ${Math.ceil(ore.ttl)} seconds"></span>` : '')
      + '</span></div>';
  }
  for (const [id, el] of existing) if (!keep.has(id)) el.remove();
}

/** The opponent's ores, mirrored: same nuggets, blank plates (dots = word length). You see what they're digging, not the words. */
function renderOppRocks(op) {
  const sig = op.ores.map((o) => `${o.id}${o.golden ? 'g' : ''}${o.diamond ? 'd' : ''}`).join(',');
  if (sig === lastRockSig) return;
  lastRockSig = sig;
  $('#opp-rocks').innerHTML = op.ores.map((o) => `<div class="ore">${nugget(orePalette(o))}`
    + `<div class="ore-info"><span class="w">${'•'.repeat(o.word.length)}</span></div></div>`).join('');
}

/** Floating "+N◆" over the mine panel. */
export function floatGold(text, big = false) {
  const mine = $('#mine');
  const el = document.createElement('div');
  el.className = `gold-float${big ? ' big' : ''}`;
  el.textContent = text;
  mine.appendChild(el);
  requestAnimationFrame(() => {
    el.style.transform = 'translateY(-40px)';
    el.style.opacity = '0';
  });
  setTimeout(() => el.remove(), 950);
}

const STAT_ROWS = [
  ['WPM', 'wpm'],
  ['Accuracy', 'accuracy', '%'],
  ['Best combo', 'bestCombo'],
  ['Gold earned', 'goldEarned'],
  ['Mobs sent', 'mobsSent'],
  ['Mobs killed', 'mobsKilled'],
  ['Damage dealt', 'damageDealt'],
  ['Spells cast', 'spells'],
  ['Airdrops won', 'airdrops'],
];

export function showEnd({ winner, reason, time, stats }, you, names) {
  const opp = you === 'p1' ? 'p2' : 'p1';
  const won = winner === you;
  const title = $('#end-title');
  title.textContent = won ? 'Victory!' : 'Defeat';
  title.className = `disp ${won ? 'win' : 'lose'}`;
  $('#end-reason').textContent = reason === 'forfeit'
    ? (won ? 'Your opponent fled the battlefield.' : 'You left the match.')
    : `${won ? 'You razed the enemy base' : 'Your base has fallen'} in ${fmtTime(time)}.`;
  const rows = STAT_ROWS.map(([label, key, suffix = '']) => `<tr><th>${label}</th>`
    + `<td class="me-col">${stats[you][key]}${suffix}</td><td class="opp-col">${stats[opp][key]}${suffix}</td></tr>`).join('');
  $('#end-stats').innerHTML = `<thead><tr><th></th><td class="me-col">${escapeHtml(names[you])}</td>`
    + `<td class="opp-col">${escapeHtml(names[opp])}</td></tr></thead><tbody>${rows}</tbody>`;
  $('#rematch-status').textContent = '';
  $('#btn-rematch').disabled = false;
  $('#end').classList.remove('hidden');
}

export function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}
