import { tutorialPolicy } from '../../shared/tutorial-policy.js';
import { TypingState } from './typing-state.js?v=20261024-rules';
import { ShopPrediction } from './shop-state.js?v=20261024-rules';
import { BASE_HP, LANE_LENGTH, MOBS, SPELLS, ULT_MAX, comboMultiplier } from '/shared/config.js?v=20261024-wizard';
import { Renderer } from './render.js?v=20261024-wizard';
import { TutorialOverlay } from './tutorial.js?v=20261024-wizard';
import { sfx, unlockAudio, toggleMute, isMuted } from './audio.js?v=20261024-wizard';
import { icon } from './icons.js?v=20261024-wizard';
import {
  $, SHOP_ITEMS, showScreen, buildShop, buildMiners, flashShop, showAlert, flashMiss, updateHud, resetHud,
  floatGold, showEnd,
} from './ui.js?v=20261024-wizard';

// ------------------------------------------------------------ state
const S = {
  ws: null,
  you: null,
  code: null,
  names: { p1: 'Player 1', p2: 'Player 2' },
  playing: false,
  snap: null,
  snapAt: 0,
  seq: 0,
  shop: null,
  mode: 'gather',
  lock: null, // { kind: 'mob'|'ore', id, wi, typed, word }
  typing: null,
  display: new Map(), // mobId -> displayed x
  oppTyped: new Map(), // mobId -> last seen opponent progress on our mobs
};

const opp = () => (S.you === 'p1' ? 'p2' : 'p1');
const me = () => S.snap?.players[S.you];

const renderer = new Renderer($('#field'));
const tutorial = new TutorialOverlay();

// ------------------------------------------------------------ network
function connect() {
  return new Promise((resolve, reject) => {
    if (S.ws && S.ws.readyState === WebSocket.OPEN) return resolve(S.ws);
    const ws = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}`);
    ws.onopen = () => resolve(ws);
    ws.onerror = () => reject(new Error('Could not reach the server.'));
    ws.onmessage = (ev) => { if (S.ws === ws) onMessage(JSON.parse(ev.data)); };
    ws.onclose = () => {
      if (S.ws !== ws) return;
      S.ws = null;
      if (S.you) {
        resetPrediction();
        S.playing = false;
        S.you = null;
        S.snap = null;
        tutorial.hide();
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
      resetPrediction();
      S.snap = null;
      resetHud();
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
      startMatch(msg.tutorial);
      break;
    case 'state':
      onSnapshot(msg);
      break;
    case 'end':
      S.playing = false;
      resetPrediction();
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
  document.activeElement?.blur();
  showScreen('game');
  renderer.resize();
  $('#mine').setAttribute('aria-label', `${S.names[S.you]}'s mine`);
}

function startMatch(tutorial = false) {
  enterGameScreen();
  $('#countdown').classList.add('hidden');
  $('#end').classList.add('hidden');
  S.playing = true;
  resetPrediction();
  S.snap = null;
  S.mode = 'gather';
  S.lock = null;
  S.display.clear();
  S.oppTyped.clear();
  resetHud();
  sfx.count(true);
  if (!tutorial) showAlert('FIGHT! Mine gold and send your army', 'mine', 1600, 1, 'sword');
}

// ------------------------------------------------------------ snapshots
function resetPrediction() {
  S.seq = 0;
  S.shop = new ShopPrediction(S.you);
  S.typing = new TypingState(S.you);
  S.lock = null;
  S.mode = 'gather';
}

function refreshView() {
  const view = S.typing.view;
  const typedPlayer = view.snap.players[S.you];
  S.snap = { ...view.snap, players: { ...view.snap.players, [S.you]: {
    ...S.shop.player, ores: typedPlayer.ores, mode: view.mode, combo: typedPlayer.combo,
  } } };
  S.mode = view.mode;
  S.lock = view.lock;
}

function onSnapshot(snap) {
  S.shop.receive(snap);
  S.typing.receive(snap);
  refreshView();
  S.snapAt = performance.now();
  const ids = new Set(snap.mobs.map((m) => m.id));
  for (const id of S.display.keys()) if (!ids.has(id)) S.display.delete(id);

  // Opponent chipping away at our mobs: fire their bolts.
  for (const m of snap.mobs) {
    if (m.owner !== S.you) continue;
    const prev = S.oppTyped.get(m.id) ?? 0;
    if (m.typed > prev) renderer.bolt(opp(), m.id);
    S.oppTyped.set(m.id, m.typed);
  }
  for (const id of S.oppTyped.keys()) if (!ids.has(id)) S.oppTyped.delete(id);

  for (const e of S.snap.events) handleEvent(e);
}

function dropLock() {
  S.typing?.drop();
  S.lock = null;
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
      // The killer's target was coming at them: our kills land on the defend road, theirs on the attack road.
      const color = mine ? '#2F6FE0' : '#E8681C';
      if (!e.predicted) renderer.burstAtWorld(e.x, mine, color, 16);
      if (e.type === 'slime') renderer.burstAtWorld(e.x, mine, '#8EE07A', 24, 220);
      if (mine) renderer.killAtWorld(e.x, mine, `+${e.bounty}◆`);
      if (!mine) sfx.enemyHit();
      break;
    }
    case 'armor':
      if (!mine) sfx.enemyHit();
      break;
    case 'send':
      if (mine) sfx.send();
      else showAlert(`${S.names[opp()]} sent a ${MOBS[e.type].name}!`, 'info', 1400, 1, e.type);
      break;
    case 'baseHit':
      if (mine) {
        renderer.shake(14);
        renderer.flashBase(S.you);
        renderer.floatAtBase('me', `−${e.dmg}`, '#C2183A', 40);
        sfx.baseHit();
      } else {
        renderer.shake(4);
        renderer.flashBase(opp());
        renderer.floatAtBase('opp', `−${e.dmg}`, '#C2183A', 40);
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
        renderer.floatAtBase(side, `+${SPELLS.repair.amount}`, '#5BB33A', 34);
      } else if (!mine) {
        showAlert(`${S.names[opp()]} cast ${name}`, 'info', 1200, 1, e.spell);
      }
      break;
    }
    case 'ult':
      renderer.lightning(e.targets, mine);
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
function typeChar(ch) {
  if (!S.snap || !tutorialPolicy(S.snap.tutorial, S.mode).allows({ t: 'type' })) return;
  const result = S.typing.type(ch, ++S.seq);
  refreshView();
  if (result.action) send(result.action);
  if (result.feedback === 'miss') {
    sfx.miss();
    renderer.miss();
    flashMiss();
    return;
  }
  const lock = result.lock;
  if (!lock) return;
  sfx.key(lock.typed);
  if (lock.kind === 'mob') renderer.bolt(S.you, lock.id);
  const pos = renderer.mobPos.get(lock.id);
  if (result.feedback === 'armor') {
    sfx.armor();
    if (pos) renderer.burst(pos.x, pos.y, '#c8cfdb', 10, 120);
  } else if (result.feedback === 'kill') {
    sfx.kill();
    if (pos) renderer.killFx(pos.x, pos.y);
  }
}

function setMode(mode) {
  if (!tutorialPolicy(S.snap?.tutorial, S.mode).allows({ t: 'mode', mode })) return;
  const action = S.typing.setMode(mode, ++S.seq);
  if (!action) return;
  refreshView();
  send(action);
  sfx.switch();
}

function buy(id) {
  const p = me();
  if (!S.playing || !p) return;
  const seq = S.seq + 1;
  const ok = S.shop.buy(id, seq, S.mode);
  flashShop(id, ok);
  if (!ok) return sfx.denied();
  S.seq = seq;
  refreshView();
  send({ t: 'buy', item: id, seq });
}

const KEY_TO_ITEM = Object.fromEntries(SHOP_ITEMS.map((it) => [it.key, it.id]));

document.addEventListener('keydown', (e) => {
  if (!S.playing || !$('#game').classList.contains('active')) return;
  if (e.target.closest('button, input, select, textarea')) return;
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
    if (!tutorialPolicy(S.snap?.tutorial, S.mode).allows({ t: 'ult' })) return;
    if ((me()?.ult ?? 0) >= ULT_MAX) send({ t: 'ult', seq: ++S.seq });
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

buildShop(buy);
buildMiners();

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
      const predicted = Math.max(0, Math.min(LANE_LENGTH, m.x + m.vx * since));
      const prev = S.display.get(m.id);
      const dx = prev == null ? predicted : prev + (predicted - prev) * Math.min(1, dt * 12);
      S.display.set(m.id, dx);
      mobs.push({ ...m, dx });
      if (m.target === S.you && (S.you === 'p1' ? dx : LANE_LENGTH - dx) < LANE_LENGTH * 0.3) danger++;
    }
  }

  if (S.snap && $('#game').classList.contains('active')) {
    updateHud({ snap: S.snap, you: S.you, mode: S.mode, lock: S.lock, danger });
  }
  const combo = S.snap ? `×${comboMultiplier(me().combo).toFixed(1)}` : null;
  renderer.draw({ snap: S.snap, mobs, lock: S.lock, mode: S.mode, combo, now }, dt);
  if (S.snap?.tutorial && $('#game').classList.contains('active')) {
    tutorial.update({ lesson: S.snap.tutorial, player: me(), mode: S.mode, lock: S.lock, renderer });
    if (tutorialPolicy(S.snap.tutorial, S.mode).complete) S.playing = false;
  } else tutorial.hide();
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
$('#btn-tutorial').addEventListener('click', () => lobbyAction({ t: 'tutorial' }));

$('#btn-tutorial-exit').addEventListener('click', leaveRoom);
$('#btn-tutorial-lobby').addEventListener('click', leaveRoom);
$('#btn-tutorial-practice').addEventListener('click', () => {
  leaveRoom();
  lobbyAction({ t: 'practice', difficulty: 'easy' });
});

function leaveRoom() {
  S.playing = false;
  S.you = null;
  S.snap = null;
  resetPrediction();
  tutorial.hide();
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
