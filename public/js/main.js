import { BASE_HP, LANE_LENGTH, MOBS, SPELLS, ULT_MAX } from '/shared/config.js';
import { Renderer } from './render.js';
import { sfx, unlockAudio, toggleMute, isMuted } from './audio.js';
import { icon } from './icons.js';
import {
  $, SHOP_ITEMS, itemCost, showScreen, buildShop, flashShop, showAlert, setTypingLine, updateHud, resetHud,
  floatGold, showEnd,
} from './ui.js';

// ------------------------------------------------------------ state
const S = {
  ws: null,
  you: null,
  code: null,
  names: { p1: 'Player 1', p2: 'Player 2' },
  playing: false,
  snap: null,
  snapAt: 0,
  mode: 'gather',
  lock: null, // { kind: 'mob'|'ore', id, wi, typed, word }
  killed: new Map(), // mobId -> time we killed it locally (hide until server agrees)
  hiddenOres: new Set(),
  display: new Map(), // mobId -> displayed x
  oppTyped: new Map(), // mobId -> last seen opponent progress on our mobs
};

const opp = () => (S.you === 'p1' ? 'p2' : 'p1');
const me = () => S.snap?.players[S.you];

const renderer = new Renderer($('#field'));

// ------------------------------------------------------------ network
function connect() {
  return new Promise((resolve, reject) => {
    if (S.ws && S.ws.readyState === WebSocket.OPEN) return resolve(S.ws);
    const ws = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}`);
    ws.onopen = () => resolve(ws);
    ws.onerror = () => reject(new Error('Could not reach the server.'));
    ws.onmessage = (ev) => onMessage(JSON.parse(ev.data));
    ws.onclose = () => {
      if (S.ws !== ws) return;
      S.ws = null;
      if (S.you) {
        S.playing = false;
        S.you = null;
        showScreen('lobby');
        $('#lobby-error').textContent = 'Disconnected from server.';
      }
    };
    S.ws = ws;
  });
}

function send(msg) {
  if (S.ws?.readyState === WebSocket.OPEN) S.ws.send(JSON.stringify(msg));
}

function onMessage(msg) {
  switch (msg.t) {
    case 'error':
      $('#lobby-error').textContent = msg.msg;
      showScreen('lobby');
      break;
    case 'joined':
      S.you = msg.you;
      S.code = msg.code;
      renderer.setPerspective(S.you);
      break;
    case 'lobby':
      for (const s of ['p1', 'p2']) if (msg.players[s]) S.names[s] = msg.players[s].name;
      if (msg.state === 'waiting' && !S.playing) {
        if (msg.practice) break;
        $('#room-code').textContent = msg.code;
        $('#share-link').value = `${location.origin}/?room=${msg.code}`;
        if ($('#end').classList.contains('hidden')) showScreen('waiting');
      }
      break;
    case 'countdown':
      enterGameScreen();
      $('#end').classList.add('hidden');
      $('#countdown').classList.remove('hidden');
      $('#count-n').textContent = msg.n;
      $('#count-n').style.animation = 'none';
      void $('#count-n').offsetWidth;
      $('#count-n').style.animation = '';
      sfx.count(false);
      break;
    case 'start':
      S.names = msg.names;
      startMatch();
      break;
    case 'state':
      onSnapshot(msg);
      break;
    case 'end':
      S.playing = false;
      S.lock = null;
      setTypingLine(null);
      showEnd(msg, S.you, S.names);
      if (msg.winner === S.you) sfx.win();
      else sfx.lose();
      break;
    case 'rematch': {
      const mine = msg.votes.includes(S.you);
      const theirs = msg.votes.includes(opp());
      $('#rematch-status').textContent = mine && !theirs
        ? 'Waiting for opponent…'
        : theirs && !mine ? `${S.names[opp()]} wants a rematch!` : '';
      break;
    }
    case 'opponentLeft':
      if (!$('#end').classList.contains('hidden')) {
        $('#rematch-status').textContent = 'Your opponent left. Waiting for a new challenger…';
        $('#btn-rematch').disabled = true;
      } else if (!S.playing) {
        $('#countdown').classList.add('hidden');
        showScreen('waiting');
      }
      break;
    default:
  }
}

function enterGameScreen() {
  showScreen('game');
  renderer.resize();
  $('#me-name').textContent = S.names[S.you];
  $('#opp-name').textContent = S.names[opp()];
}

function startMatch() {
  enterGameScreen();
  $('#countdown').classList.add('hidden');
  $('#end').classList.add('hidden');
  S.playing = true;
  S.snap = null;
  S.mode = 'gather';
  S.lock = null;
  S.killed.clear();
  S.hiddenOres.clear();
  S.display.clear();
  S.oppTyped.clear();
  resetHud();
  setTypingLine(null);
  sfx.count(true);
  showAlert('FIGHT! Mine gold and send your army', 'mine', 1600, 1, 'sword');
}

// ------------------------------------------------------------ snapshots
function onSnapshot(snap) {
  S.snap = snap;
  S.snapAt = performance.now();

  const ids = new Set(snap.mobs.map((m) => m.id));
  for (const id of S.killed.keys()) if (!ids.has(id)) S.killed.delete(id);
  for (const id of S.display.keys()) if (!ids.has(id)) S.display.delete(id);
  const oreIds = new Set(me().ores.map((o) => o.id));
  for (const id of S.hiddenOres) if (!oreIds.has(id)) S.hiddenOres.delete(id);

  // The server's mode wins if we drifted (e.g. a lost message).
  if (snap.players[S.you].mode !== S.mode && performance.now() - (S.modeAt ?? 0) > 500) {
    S.mode = snap.players[S.you].mode;
  }

  validateLock();

  // Opponent chipping away at our mobs: fire their bolts.
  for (const m of snap.mobs) {
    if (m.owner !== S.you) continue;
    const prev = S.oppTyped.get(m.id) ?? 0;
    if (m.typed > prev) renderer.bolt(opp(), m.id);
    S.oppTyped.set(m.id, m.typed);
  }
  for (const id of S.oppTyped.keys()) if (!ids.has(id)) S.oppTyped.delete(id);

  for (const e of snap.events) handleEvent(e);
}

function validateLock() {
  const lock = S.lock;
  if (!lock) return;
  if (lock.kind === 'mob') {
    const m = S.snap.mobs.find((x) => x.id === lock.id);
    if (!m || m.wi > lock.wi || S.killed.has(lock.id)) dropLock();
  } else if (!me().ores.some((o) => o.id === lock.id)) {
    dropLock();
  }
}

const LANE_NAMES = ['top', 'middle', 'bottom'];

/** Refresh the typing readout for the current lock. */
function showLock(err = false) {
  const lock = S.lock;
  if (!lock) return setTypingLine(null, 0, err);
  let tag;
  if (lock.kind === 'ore') {
    const ore = me()?.ores.find((o) => o.id === lock.id);
    tag = ore?.diamond ? 'DIAMOND ORE' : ore?.golden ? 'GOLDEN ORE' : 'ORE';
  } else {
    const m = S.snap?.mobs.find((x) => x.id === lock.id);
    tag = m ? `${MOBS[m.type].name} · ${LANE_NAMES[m.lane]}`.toUpperCase() : '';
  }
  setTypingLine(lock.word, lock.typed, err, tag);
}

function dropLock() {
  S.lock = null;
  setTypingLine(null);
}

function handleEvent(e) {
  const mine = e.slot === S.you;
  switch (e.e) {
    case 'gather':
      if (mine) {
        floatGold(`+${e.gold}◆`, e.golden || e.diamond);
        sfx.coin(e.golden, e.diamond);
      }
      break;
    case 'kill': {
      const color = mine ? '#2F6FE0' : '#E8681C';
      if (!(mine && S.killed.has(e.mobId))) renderer.burstAtWorld(e.x, e.lane, color, 16);
      if (e.type === 'slime') renderer.burstAtWorld(e.x, e.lane, '#8EE07A', 24, 220);
      if (mine) renderer.killAtWorld(e.x, e.lane, `+${e.bounty}◆`);
      if (!mine) sfx.enemyHit();
      break;
    }
    case 'armor':
      if (!mine) sfx.enemyHit();
      break;
    case 'send':
      if (mine) sfx.send();
      else showAlert(`${S.names[opp()]} sent a ${MOBS[e.type].name}!`, 'info', 1400, 1, e.type, e.lane == null ? '' : `${LANE_NAMES[e.lane]} lane`);
      break;
    case 'baseHit':
      if (mine) {
        renderer.shake(14);
        renderer.flashBase(S.you);
        renderer.float(renderer.baseX('me') + 60, renderer.h * 0.4, `−${e.dmg}`, '#C2183A', 40);
        sfx.baseHit();
      } else {
        renderer.shake(4);
        renderer.flashBase(opp());
        renderer.float(renderer.baseX('opp') - 60, renderer.h * 0.4, `−${e.dmg}`, '#C2183A', 40);
        sfx.enemyHit();
      }
      break;
    case 'spell': {
      sfx.spell();
      const name = SPELLS[e.spell].name;
      if (e.spell === 'fog' && !mine) showAlert('You have been FOGGED!', 'danger', 1600, 3, 'fog');
      else if (e.spell === 'frost') {
        showAlert(mine ? 'Frost slows the invaders' : `${S.names[opp()]} froze their side`, mine ? 'mine' : 'info', 1400, 2, 'frost');
      } else if (e.spell === 'repair') {
        const side = mine ? 'me' : 'opp';
        renderer.healBase(e.slot);
        renderer.float(renderer.baseX(side), renderer.h * 0.3, `+${SPELLS.repair.amount}`, '#5BB33A', 34);
      } else if (!mine) {
        showAlert(`${S.names[opp()]} cast ${name}`, 'info', 1200, 1, e.spell);
      }
      break;
    }
    case 'ult':
      renderer.lightning(e.targets);
      sfx.ult();
      if (!mine) showAlert(`${S.names[opp()]} called down LIGHTNING!`, 'info', 1500, 2, 'bolt');
      break;
    case 'overtime':
      showAlert('OVERTIME! Mobs keep speeding up, income doubled', 'danger', 3000, 4, 'flame');
      break;
    case 'suddenDeath':
      showAlert('SUDDEN DEATH! Both bases crumble, no repairs', 'danger', 3500, 5, 'skull');
      break;
    default:
  }
}

// ------------------------------------------------------------ typing
function incomingMobs() {
  if (!S.snap) return [];
  return S.snap.mobs.filter((m) => m.target === S.you && !S.killed.has(m.id));
}

function distToMyBase(m) {
  return S.you === 'p1' ? m.x : LANE_LENGTH - m.x;
}

function findTarget(ch) {
  if (S.mode === 'fight') {
    const cands = incomingMobs()
      .filter((m) => m.words[m.wi]?.[0] === ch)
      .sort((a, b) => distToMyBase(a) - distToMyBase(b));
    const m = cands[0];
    return m && { kind: 'mob', id: m.id, wi: m.wi, typed: 0, word: m.words[m.wi] };
  }
  const ores = me().ores
    .filter((o) => !S.hiddenOres.has(o.id) && o.word[0] === ch)
    .sort((a, b) => (b.diamond ? 2 : b.golden ? 1 : 0) - (a.diamond ? 2 : a.golden ? 1 : 0));
  const o = ores[0];
  return o && { kind: 'ore', id: o.id, wi: 0, typed: 0, word: o.word };
}

function typeChar(ch) {
  if (!S.lock) {
    const target = findTarget(ch);
    if (!target) return miss();
    S.lock = target;
  } else if (S.lock.word[S.lock.typed] !== ch) {
    return miss();
  }

  const lock = S.lock;
  lock.typed++;
  sfx.key(lock.typed);

  if (lock.kind === 'mob') renderer.bolt(S.you, lock.id);

  if (lock.typed < lock.word.length) {
    if (lock.kind === 'mob') send({ t: 'progress', id: lock.id, wi: lock.wi, typed: lock.typed });
    showLock();
    return;
  }

  // Word complete
  if (lock.kind === 'ore') {
    send({ t: 'gather', id: lock.id });
    S.hiddenOres.add(lock.id);
    dropLock();
    return;
  }

  send({ t: 'hit', id: lock.id, wi: lock.wi });
  const mob = S.snap.mobs.find((m) => m.id === lock.id);
  const pos = renderer.mobPos.get(lock.id);
  if (mob && lock.wi + 1 < mob.words.length) {
    sfx.armor();
    if (pos) renderer.burst(pos.x, pos.y, '#c8cfdb', 10, 120);
    S.lock = { kind: 'mob', id: mob.id, wi: lock.wi + 1, typed: 0, word: mob.words[lock.wi + 1] };
    showLock();
  } else {
    sfx.kill();
    if (pos) renderer.killFx(pos.x, pos.y);
    S.killed.set(lock.id, performance.now());
    dropLock();
  }
}

function miss() {
  send({ t: 'miss' });
  sfx.miss();
  if (S.snap) me().combo = 0;
  showLock(true);
}

function setMode(mode) {
  if (mode === S.mode) return;
  S.mode = mode;
  S.modeAt = performance.now();
  dropLock();
  send({ t: 'mode', mode });
  sfx.switch();
}

function buy(id) {
  const p = me();
  if (!S.playing || !p) return;
  const cost = itemCost(id, p);
  const ok = cost != null && p.gold >= cost && p.charges[id]?.n !== 0
    && !(id === 'frost' && p.frostCd > 0)
    && !(id === 'repair' && (p.hp >= BASE_HP || S.snap.suddenDeath));
  flashShop(id, ok);
  if (!ok) return sfx.denied();
  p.gold -= cost; // optimistic; the next snapshot corrects it
  if (p.charges[id]) p.charges[id].n--;
  if (id === 'frost') p.frostCd = SPELLS.frost.cooldown;
  send({ t: 'buy', item: id });
}

const KEY_TO_ITEM = Object.fromEntries(SHOP_ITEMS.map((it) => [it.key, it.id]));

document.addEventListener('keydown', (e) => {
  if (!S.playing || !$('#game').classList.contains('active')) return;
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  unlockAudio();

  if (e.key === 'Tab') {
    e.preventDefault();
    setMode(S.mode === 'gather' ? 'fight' : 'gather');
    return;
  }
  if (e.key === 'Escape' || e.key === 'Backspace') {
    e.preventDefault();
    dropLock();
    return;
  }
  if (e.key === 'Enter') {
    e.preventDefault();
    if ((me()?.ult ?? 0) >= ULT_MAX) send({ t: 'ult' });
    else sfx.denied();
    return;
  }
  if (KEY_TO_ITEM[e.key]) {
    e.preventDefault();
    buy(KEY_TO_ITEM[e.key]);
    return;
  }
  if (/^[a-zA-Z]$/.test(e.key)) {
    e.preventDefault();
    typeChar(e.key.toLowerCase());
  }
});

for (const el of document.querySelectorAll('.mode-btn')) {
  el.addEventListener('mousedown', (e) => {
    e.preventDefault();
    if (S.playing) setMode(el.dataset.mode);
  });
}
buildShop(buy);

// ------------------------------------------------------------ frame loop
let lastFrame = performance.now();
function frame(now) {
  const dt = Math.min((now - lastFrame) / 1000, 0.1);
  lastFrame = now;

  let mobs = [];
  let danger = 0;
  if (S.snap) {
    const since = S.playing ? (now - S.snapAt) / 1000 : 0;
    for (const m of S.snap.mobs) {
      if (S.killed.has(m.id)) continue;
      const predicted = Math.max(0, Math.min(LANE_LENGTH, m.x + m.vx * since));
      const prev = S.display.get(m.id);
      const dx = prev == null ? predicted : prev + (predicted - prev) * Math.min(1, dt * 12);
      S.display.set(m.id, dx);
      mobs.push({ ...m, dx });
      if (m.target === S.you && (S.you === 'p1' ? dx : LANE_LENGTH - dx) < LANE_LENGTH * 0.3) danger++;
    }
  }

  if (S.snap && $('#game').classList.contains('active')) {
    updateHud({ snap: S.snap, you: S.you, mode: S.mode, lock: S.lock, hiddenOres: S.hiddenOres, danger });
  }
  renderer.draw({ snap: S.snap, mobs, lock: S.lock, mode: S.mode, now }, dt);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// ------------------------------------------------------------ lobby
const nameInput = $('#name');
nameInput.value = localStorage.getItem('tz-name') ?? '';
const playerName = () => {
  const n = nameInput.value.trim() || 'Player';
  localStorage.setItem('tz-name', n);
  return n;
};

async function lobbyAction(msg) {
  unlockAudio();
  $('#lobby-error').textContent = '';
  try {
    await connect();
    send({ ...msg, name: playerName() });
  } catch (err) {
    $('#lobby-error').textContent = err.message;
  }
}

$('#btn-create').addEventListener('click', () => lobbyAction({ t: 'create' }));
$('#btn-join').addEventListener('click', () => {
  const code = $('#join-code').value.trim().toUpperCase();
  if (code.length !== 4) {
    $('#lobby-error').textContent = 'Enter the 4-letter room code.';
    return;
  }
  lobbyAction({ t: 'join', code });
});
$('#join-code').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') $('#btn-join').click();
});
$('#btn-practice').addEventListener('click', () => lobbyAction({ t: 'practice', difficulty: $('#bot-level').value }));

function leaveRoom() {
  S.playing = false;
  S.you = null;
  S.snap = null;
  if (S.ws) {
    const ws = S.ws;
    S.ws = null;
    ws.close();
  }
  $('#end').classList.add('hidden');
  $('#countdown').classList.add('hidden');
  history.replaceState(null, '', '/');
  showScreen('lobby');
}

$('#btn-cancel').addEventListener('click', leaveRoom);
$('#btn-leave').addEventListener('click', leaveRoom);
$('#btn-rematch').addEventListener('click', () => {
  send({ t: 'rematch' });
  $('#btn-rematch').disabled = true;
});
$('#btn-copy').addEventListener('click', async () => {
  const input = $('#share-link');
  try {
    await navigator.clipboard.writeText(input.value);
  } catch {
    input.select();
    document.execCommand('copy');
  }
  $('#btn-copy').textContent = 'Copied!';
  setTimeout(() => ($('#btn-copy').textContent = 'Copy'), 1200);
});

const muteBtn = $('#btn-mute');
function paintMute(muted) {
  muteBtn.innerHTML = icon(muted ? 'soundOff' : 'soundOn', { size: 22, width: 2.5 });
  muteBtn.setAttribute('aria-label', muted ? 'Unmute sound' : 'Mute sound');
}
paintMute(isMuted());
muteBtn.addEventListener('click', () => {
  paintMute(toggleMute());
  muteBtn.blur();
});

const roomParam = new URLSearchParams(location.search).get('room');
if (roomParam) {
  $('#join-code').value = roomParam.toUpperCase().slice(0, 4);
  $('#lobby-error').textContent = 'Enter your name and hit Join to accept the challenge.';
  nameInput.focus();
} else {
  nameInput.focus();
}
