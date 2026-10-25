import { LANE_LENGTH, ITEM_KEY, comboMultiplier } from '../../shared/config.js';
import { canClaim } from '../../shared/items.js';
import { MatchSession } from './session.js';
import { MatchFeedback } from './feedback.js';
import { Connection } from './connection.js';
import { Renderer } from './render.js';
import { TutorialOverlay } from './tutorial.js';
import { sfx, unlockAudio, toggleMute, isMuted } from './audio.js';
import { icon } from './icons.js';
import {
  $, SHOP_ITEMS, showScreen, buildShop, buildMiners, flashShop, showAlert, flashMiss, updateHud, resetHud, showEnd,
} from './ui.js';

// ------------------------------------------------------------ state
const S = {
  you: null,
  code: null,
  names: { p1: 'Player 1', p2: 'Player 2' },
  playing: false,
  matchType: null,
  tutorialCompleted: false,
  session: new MatchSession(null), // prediction and the frame we draw
  lastFrame: null, // latest authoritative snapshot
  snapAt: 0,
  display: new Map(), // mobId -> displayed x
};

const opp = () => (S.you === 'p1' ? 'p2' : 'p1');
const me = () => S.session.me;
const capture = (event, properties) => window.posthog?.capture(event, properties);
const logInfo = (message, attributes) => window.posthog?.logger?.info(message, attributes);

const renderer = new Renderer($('#field'));
const tutorial = new TutorialOverlay();
const feedback = new MatchFeedback(renderer);
const conn = new Connection({ onMessage, onDrop });

/** Discards prediction. `frame` keeps an authoritative battlefield on screen. */
function newSession(frame = null) {
  S.session = new MatchSession(S.you);
  if (frame) S.session.receive(frame);
}

// ------------------------------------------------------------ network
function onDrop() {
  if (!S.you) return;
  S.playing = false;
  S.you = null;
  newSession();
  tutorial.hide();
  showScreen('lobby');
  $('#lobby-error').textContent = 'Disconnected from server.';
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
      newSession();
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
      capture('match_completed', {
        match_type: S.matchType,
        result: msg.winner === S.you ? 'won' : 'lost',
        completion_reason: msg.reason,
      });
      logInfo('match_completed', {
        match_type: S.matchType,
        result: msg.winner === S.you ? 'won' : 'lost',
        completion_reason: msg.reason,
      });
      S.playing = false;
      newSession(S.lastFrame);
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
  S.tutorialCompleted = false;
  S.lastFrame = null;
  newSession();
  S.display.clear();
  feedback.reset(S.you, S.names);
  resetHud();
  sfx.count(true);
  capture('match_started', { match_type: S.matchType, is_tutorial: tutorial });
  logInfo('match_started', { match_type: S.matchType, is_tutorial: tutorial });
  if (!tutorial) showAlert('FIGHT! Mine gold and send your army', 'mine', 1600, 1, 'sword');
}

function onSnapshot(snap) {
  S.lastFrame = snap;
  const view = S.session.receive(snap);
  S.snapAt = performance.now();
  const ids = new Set(snap.mobs.map((m) => m.id));
  for (const id of S.display.keys()) if (!ids.has(id)) S.display.delete(id);
  feedback.receive(view.snap, view.mode);
}

// ------------------------------------------------------------ input
function typeChar(ch) {
  const result = S.session.type(ch);
  if (!result) return;
  if (result.action) conn.send(result.action);
  if (result.feedback === 'miss') {
    sfx.miss();
    renderer.miss();
    flashMiss();
    return;
  }
  const lock = result.lock;
  if (!lock) return;
  sfx.key(lock.typed);
  if (lock.kind !== 'ore') renderer.bolt(S.you, lock.id);
  const pos = renderer.mobPos.get(lock.id);
  if (result.feedback === 'claim' || result.feedback === 'kill') {
    sfx.kill();
    if (pos) renderer.killFx(pos.x, pos.y);
  } else if (result.feedback === 'armor') {
    sfx.armor();
    if (pos) renderer.burst(pos.x, pos.y, '#c8cfdb', 10, 120);
  }
}

function setMode(mode) {
  const action = S.session.setMode(mode);
  if (!action) return;
  conn.send(action);
  capture('gameplay_mode_switched', { mode });
  sfx.switch();
}

function buy(id) {
  if (!S.playing || !me()) return;
  const action = S.session.buy(id);
  flashShop(id, !!action);
  if (!action) return sfx.denied();
  conn.send(action);
  capture('shop_purchase_attempted', { item_id: id });
}

/** Use the item in a supply slot; heals are predicted. */
function useItem(slot) {
  const itemId = me()?.items[slot]?.id;
  if (!S.playing || !itemId) return sfx.denied();
  const action = S.session.use(slot);
  flashShop(slot, !!action);
  if (!action) return sfx.denied();
  conn.send(action);
  capture('item_used', { item_id: itemId });
}

function ultimate() {
  const action = S.session.ultimate();
  if (action) {
    conn.send(action);
    capture('ultimate_activated');
  } else if (S.session.policy.allows({ t: 'ult' })) sfx.denied();
}

const KEY_TO_ITEM = Object.fromEntries(SHOP_ITEMS.map((it) => [it.key, it.id]));

document.addEventListener('keydown', (e) => {
  if (!S.playing || !$('#game').classList.contains('active')) return;
  if (e.target.closest('button, input, select, textarea')) return;
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  unlockAudio();

  if (e.key === 'Tab') {
    e.preventDefault();
    setMode(S.session.mode === 'gather' ? 'fight' : 'gather');
    return;
  }
  if (e.key === 'Escape' || e.key === 'Backspace') {
    e.preventDefault();
    S.session.dropLock();
    return;
  }
  if (e.key === 'Enter') {
    e.preventDefault();
    ultimate();
    return;
  }
  if (e.key === ITEM_KEY) {
    e.preventDefault();
    useItem(0);
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

buildShop(buy, useItem);
buildMiners();

// ------------------------------------------------------------ frame loop
/** Mobs at their interpolated display positions, and how many are close to our base. */
function interpolateMobs(snap, now, dt) {
  const mobs = [];
  let danger = 0;
  const since = S.playing ? (now - S.snapAt) / 1000 : 0;
  for (const m of snap.mobs) {
    const predicted = Math.max(0, Math.min(LANE_LENGTH, m.x + m.vx * since));
    const prev = S.display.get(m.id);
    const dx = prev == null ? predicted : prev + (predicted - prev) * Math.min(1, dt * 12);
    S.display.set(m.id, dx);
    mobs.push({ ...m, dx });
    if (m.target === S.you && (S.you === 'p1' ? dx : LANE_LENGTH - dx) < LANE_LENGTH * 0.3) danger++;
  }
  return { mobs, danger };
}

let lastFrame = performance.now();
function frame(now) {
  const dt = Math.min((now - lastFrame) / 1000, 0.1);
  lastFrame = now;
  const { snap, mode, lock } = S.session;
  const onGame = $('#game').classList.contains('active');

  const { mobs, danger } = snap ? interpolateMobs(snap, now, dt) : { mobs: [], danger: 0 };
  if (snap && onGame) updateHud({ snap, you: S.you, mode, lock, danger });
  const combo = snap ? `×${comboMultiplier(me().combo).toFixed(1)}` : null;
  const drop = snap?.airdrop && { ...snap.airdrop, ttl: snap.airdrop.ttl - (S.playing ? (now - S.snapAt) / 1000 : 0) };
  renderer.draw({
    snap, mobs, drop, canClaim: !!snap && canClaim(me()), lock, mode, combo, now,
  }, dt);
  if (snap?.tutorial && onGame) {
    tutorial.update({ lesson: snap.tutorial, player: me(), mode, lock, renderer });
    if (S.session.policy.complete) {
      if (!S.tutorialCompleted) {
        capture('tutorial_completed');
        S.tutorialCompleted = true;
      }
      S.playing = false;
    }
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
    await conn.open();
    S.matchType = msg.t;
    conn.send({ ...msg, name: playerName() });
    capture('game_mode_selected', {
      match_type: msg.t,
      ...(msg.t === 'practice' ? { difficulty: msg.difficulty } : {}),
    });
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
  if (S.you || S.playing) {
    capture('game_session_left', {
      match_type: S.matchType,
      phase: S.playing ? 'match' : 'lobby',
    });
  }
  S.playing = false;
  S.you = null;
  newSession();
  tutorial.hide();
  conn.close();
  $('#end').classList.add('hidden');
  $('#countdown').classList.add('hidden');
  history.replaceState(null, '', '/');
  showScreen('lobby');
}

$('#btn-cancel').addEventListener('click', leaveRoom);
$('#btn-leave').addEventListener('click', leaveRoom);
$('#btn-rematch').addEventListener('click', () => {
  conn.send({ t: 'rematch' });
  capture('rematch_requested', { match_type: S.matchType });
  $('#btn-rematch').disabled = true;
});
$('#btn-copy').addEventListener('click', async () => {
  const input = $('#share-link');
  let copied = false;
  try {
    await navigator.clipboard.writeText(input.value);
    copied = true;
  } catch {
    input.select();
    copied = document.execCommand('copy');
  }
  if (copied) capture('room_link_copied');
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
  const muted = toggleMute();
  paintMute(muted);
  capture('sound_setting_changed', { muted });
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
