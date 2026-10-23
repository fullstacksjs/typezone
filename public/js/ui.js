import {
  BASE_HP, MOBS, SPELLS, ULT_MAX, GOLD_PER_CHAR, GOLDEN_MULT, DIAMOND_MULT, OVERTIME_AT, comboMultiplier,
} from '/shared/config.js';
import { icon, gem } from './icons.js';

export const $ = (sel) => document.querySelector(sel);

// Grid order: Barracks fills the left two columns, Arcane the right two.
export const SHOP_ITEMS = [
  { id: 'goblin' }, { id: 'knight' }, { id: 'frost', spell: true }, { id: 'fog', spell: true },
  { id: 'slime' }, { id: 'giant' }, { id: 'repair', spell: true }, { id: 'pickaxe', spell: true },
  { id: 'luck', spell: true },
].map((it) => {
  const def = MOBS[it.id] ?? SPELLS[it.id];
  return { ...it, key: def.key, name: def.name, desc: def.desc };
});

export function itemCost(id, player) {
  if (MOBS[id]) return MOBS[id].cost;
  if (SPELLS[id].costs) return SPELLS[id].costs[player?.[id] ?? 0] ?? null;
  return SPELLS[id].cost;
}

export function showScreen(id) {
  for (const el of document.querySelectorAll('.screen')) el.classList.toggle('active', el.id === id);
}

export function buildShop(onBuy) {
  const grid = $('#shop');
  grid.innerHTML = '';
  for (const it of SHOP_ITEMS) {
    const el = document.createElement('button');
    el.className = `shop-item${it.spell ? ' spell' : ''}`;
    el.dataset.id = it.id;
    el.tabIndex = -1;
    el.title = `${it.name}: ${it.desc}`;
    el.innerHTML = `<kbd class="key">${it.key}</kbd>${icon(it.id, { size: 34, width: 2.2, cls: 'icon' })}`
      + `<span class="txt"><span class="nm">${it.name}</span><span class="cost"></span><span class="availability"></span><span class="pips"></span></span>`;
    el.addEventListener('mousedown', (e) => {
      e.preventDefault();
      onBuy(it.id);
    });
    grid.appendChild(el);
  }
}

export function flashShop(id, ok) {
  const el = document.querySelector(`.shop-item[data-id="${id}"]`);
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

/** Typing readout. `tag` names the target, e.g. "KNIGHT · TOP". */
export function setTypingLine(word, typed, err = false, tag = '') {
  const el = $('#typing');
  if (!word) {
    el.innerHTML = '<span class="idle">start typing…</span>';
  } else {
    el.innerHTML = `<span class="tag">${escapeHtml(tag)}</span>`
      + `<span class="word"><span class="done">${word.slice(0, typed)}</span>`
      + `<span class="next">${word.charAt(typed)}</span><span class="rest">${word.slice(typed + 1)}</span></span>`
      + '<span class="hint">Esc to drop</span>';
    el.querySelector('.done').classList.toggle('hidden', typed === 0);
  }
  if (err) {
    el.classList.remove('err');
    void el.offsetWidth;
    el.classList.add('err');
    clearTimeout(typingErrTimer);
    typingErrTimer = setTimeout(() => el.classList.remove('err'), 300);
  }
}
let typingErrTimer = null;

const fmtTime = (t) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;

function statusTags(p) {
  let s = '';
  if (p.frost > 0) s += `<span class="status-tag frost">${icon('frost', { size: 16, width: 2.5 })}FROST ${Math.ceil(p.frost)}s</span>`;
  if (p.fog > 0) s += `<span class="status-tag fog">${icon('fog', { size: 16, width: 2.5 })}FOGGED ${Math.ceil(p.fog)}s</span>`;
  return s;
}

const lastHp = { me: BASE_HP, opp: BASE_HP };
let lastCombo = 0;
let lastOreSig = '';
let lastStatusSig = '';
let lastOppSig = '';

export function resetHud() {
  lastHp.me = BASE_HP;
  lastHp.opp = BASE_HP;
  lastCombo = 0;
  lastOreSig = '';
  lastStatusSig = '';
  lastOppSig = '';
}

export function updateHud({ snap, you, mode, lock, hiddenOres, danger }) {
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
  const statusSig = `${Math.ceil(me.frost)}|${Math.ceil(me.fog)}|${Math.ceil(op.frost)}|${Math.ceil(op.fog)}`;
  if (statusSig !== lastStatusSig) {
    lastStatusSig = statusSig;
    $('#me-status').innerHTML = statusTags(me);
    $('#opp-status').innerHTML = statusTags(op);
  }

  // Opponent stance: "mining" is the cue to attack.
  const oppUlt = Math.floor((op.ult / ULT_MAX) * 100);
  const oppSig = `${op.mode}|${oppUlt}`;
  if (oppSig !== lastOppSig) {
    lastOppSig = oppSig;
    const oppMode = $('#opp-mode');
    oppMode.className = `opp-mode ${op.mode}`;
    oppMode.innerHTML = op.mode === 'fight'
      ? `${icon('sword', { size: 18 })}DEFENDING`
      : `${icon('pickaxe', { size: 18, width: 2.6 })}MINING · open to attack`;
    const ult = $('#opp-ult');
    ult.classList.toggle('ready', oppUlt >= 100);
    ult.innerHTML = `${icon('bolt', { size: 16, fill: '#F2B705', stroke: '#2B2118', width: 2 })}${oppUlt >= 100 ? 'READY' : `${oppUlt}%`}`;
    ult.title = 'Opponent Lightning charge';
  }

  $('#timer').textContent = fmtTime(snap.time);
  const phase = $('#overtime');
  phase.classList.toggle('ot', snap.overtime);
  phase.textContent = snap.suddenDeath ? 'SUDDEN DEATH'
    : snap.overtime ? 'OVERTIME · INCOME ×2' : `Overtime in ${fmtTime(Math.max(0, OVERTIME_AT - snap.time))}`;
  $('#vignette').classList.toggle('hidden', !snap.overtime);
  $('#fog-mist').classList.toggle('hidden', !(me.fog > 0));

  // Stance
  const warn = mode !== 'fight' && danger > 0;
  for (const el of document.querySelectorAll('.mode-btn')) {
    const m = el.dataset.mode;
    el.classList.toggle('active', m === mode);
    el.classList.toggle('warn', m === 'fight' && warn);
    el.querySelector('.mode-label').textContent = m === 'fight' && warn
      ? `${danger} mob${danger > 1 ? 's' : ''} at your gate`
      : m === 'fight' ? 'Fight' : 'Gather';
  }
  $('#gate-alert').classList.toggle('hidden', !warn);
  $('#mine').classList.toggle('inactive', mode !== 'gather');
  $('#mine-hint').textContent = me.pressured ? 'under pressure · +50% passive income'
    : mode === 'gather' ? 'type a word to mine it' : 'paused while you fight';

  // Combo
  const comboEl = $('#combo');
  comboEl.textContent = `×${comboMultiplier(me.combo).toFixed(1)}`;
  $('#combo-n').textContent = me.combo;
  if (me.combo > lastCombo) {
    comboEl.classList.add('bump');
    setTimeout(() => comboEl.classList.remove('bump'), 100);
  }
  lastCombo = me.combo;

  // Ultimate
  const pct = Math.min(100, Math.floor((me.ult / ULT_MAX) * 100));
  $('#ult-ring').style.setProperty('--pct', `${pct}%`);
  $('#ult-pct').textContent = pct >= 100 ? 'READY' : `${pct}%`;
  $('#ult').classList.toggle('ready', me.ult >= ULT_MAX);

  // Shop affordability
  for (const el of document.querySelectorAll('.shop-item')) {
    const id = el.dataset.id;
    const cost = itemCost(id, me);
    const charge = me.charges[id];
    const cooldown = id === 'frost' ? me.frostCd : 0;
    const disabled = (id === 'repair' && (snap.suddenDeath || me.hp >= BASE_HP)) || charge?.n === 0 || cooldown > 0;
    const pick = SPELLS[id]?.costs && cost != null ? `Lv${me[id] + 1} · ` : '';
    el.disabled = cost == null || me.gold < cost || disabled;
    el.querySelector('.availability').textContent = charge
      ? `${charge.n}/${MOBS[id].charges}${charge.n < MOBS[id].charges ? ` · ${Math.ceil((1 - charge.progress) * charge.recharge)}s` : ''}`
      : cooldown > 0 ? `${Math.ceil(cooldown)}s cooldown` : '';
    el.style.setProperty('--recharge', `${charge && charge.n < MOBS[id].charges ? charge.progress * 100 : 0}%`);
    el.querySelector('.pips').textContent = SPELLS[id]?.costs
      ? SPELLS[id].costs.map((_, i) => i < me[id] ? '●' : '○').join(' ') : '';
    el.querySelector('.cost').textContent = cost == null ? 'MAX' : `${pick}${cost} ◆`;
    el.classList.toggle('maxed', cost == null);
    el.classList.toggle('poor', cost == null || me.gold < cost || disabled);
  }

  renderOres(me, lock, hiddenOres);
}

function renderOres(me, lock, hiddenOres) {
  const fog = me.fog > 0;
  const ores = me.ores.filter((o) => !hiddenOres.has(o.id));
  const lockOre = lock?.kind === 'ore' ? lock : null;
  const sig = ores.map((o) => `${o.id}:${o.ttl == null ? '' : Math.ceil(o.ttl)}`).join(',')
    + `|${lockOre?.id}:${lockOre?.typed}|${fog}|${me.combo}|${me.pickaxe}`;
  if (sig === lastOreSig) return;
  lastOreSig = sig;

  const mult = comboMultiplier(me.combo + 1) * (1 + me.pickaxe * SPELLS.pickaxe.bonus);
  const box = $('#ores');
  const existing = new Map([...box.children].map((el) => [Number(el.dataset.id), el]));
  const keep = new Set();
  for (const ore of ores) {
    let el = existing.get(ore.id);
    if (!el) {
      el = document.createElement('div');
      el.dataset.id = ore.id;
      el.className = `ore pop${ore.id % 2 ? ' blue' : ''}`;
      box.appendChild(el);
    }
    keep.add(ore.id);
    const typed = lockOre?.id === ore.id ? lockOre.typed : 0;
    el.classList.toggle('golden', ore.golden);
    el.classList.toggle('diamond', ore.diamond);
    el.classList.toggle('locked', lockOre?.id === ore.id);
    const done = ore.word.slice(0, typed);
    const gain = Math.round(ore.word.length * GOLD_PER_CHAR * mult * (ore.diamond ? DIAMOND_MULT : ore.golden ? GOLDEN_MULT : 1));
    el.innerHTML = '<div class="ore-face"><span class="w">'
      + (done ? `<span class="t-done">${done}</span>` : '')
      + `<span>${ore.word.charAt(typed)}</span><span class="far">${ore.word.slice(typed + 1)}</span></span>`
      + `<span class="gain">+${gain}${gem(15)}`
      + (ore.ttl != null ? `<span class="ttl">×${ore.diamond ? DIAMOND_MULT : GOLDEN_MULT} · ${Math.ceil(ore.ttl)}s</span>` : '')
      + '</span></div>';
  }
  for (const [id, el] of existing) if (!keep.has(id)) el.remove();
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
