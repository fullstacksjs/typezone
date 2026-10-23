import { LANE_LENGTH, LANES, BASE_HP } from '/shared/config.js';

const C = {
  ink: '#2B2118',
  cream: '#FFF8E8',
  me: '#2F6FE0',
  meDeep: '#1C4398',
  opp: '#E8681C',
  danger: '#C2183A',
  dangerBg: '#FFE1E4',
  gold: '#FFD34D',
  earth: '#6B4A2E',
};
const MONO = "'JetBrains Mono', ui-monospace, Menlo, Consolas, monospace";
const BODY = 'Nunito, system-ui, sans-serif';
const DISPLAY = "'Lilita One', Nunito, system-ui, sans-serif";

// Art is specified against a 700px-tall field and scaled to the real height.
const REF_H = 700;
const LANE_TOP = 250;
const LANE_BOTTOM = 590;
const LANE_INSET = 200; // where the lane meets each base
const MOB_PX = { goblin: 56, knight: 68, slime: 60, slimelet: 40, giant: 104 };
const DANGER_DIST = 0.22;

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const rand = (a, b) => a + Math.random() * (b - a);

// ------------------------------------------------------------ SVG-path art
const rr = (x, y, w, h, r) => (r
  ? `M${x + r} ${y}H${x + w - r}A${r} ${r} 0 0 1 ${x + w} ${y + r}V${y + h - r}A${r} ${r} 0 0 1 ${x + w - r} ${y + h}`
    + `H${x + r}A${r} ${r} 0 0 1 ${x} ${y + h - r}V${y + r}A${r} ${r} 0 0 1 ${x + r} ${y}Z`
  : `M${x} ${y}h${w}v${h}h${-w}Z`);
const ell = (cx, cy, rx, ry = rx) => `M${cx - rx} ${cy}a${rx} ${ry} 0 1 0 ${2 * rx} 0a${rx} ${ry} 0 1 0 ${-2 * rx} 0Z`;

const pathCache = new Map();
const P = (d) => {
  let p = pathCache.get(d);
  if (!p) pathCache.set(d, (p = new Path2D(d)));
  return p;
};

/** Draws a list of {d, fill, stroke, lw, dash} shapes. `tint` overrides every fill (hit/heal flashes). */
function paint(ctx, shapes, tint = null) {
  for (const s of shapes) {
    const p = P(s.d);
    if (s.fill) {
      ctx.fillStyle = tint ?? s.fill;
      ctx.fill(p);
    }
    if (s.stroke && !tint) {
      ctx.strokeStyle = s.stroke;
      ctx.lineWidth = s.lw ?? 2.5;
      if (s.dash) ctx.setLineDash(s.dash);
      ctx.stroke(p);
      if (s.dash) ctx.setLineDash([]);
    }
  }
}

const ink = (d, fill, lw = 5) => ({ d, fill, stroke: C.ink, lw });
const line = (d, stroke, lw) => ({ d, stroke, lw });

// Bases: 240×420 art; mine has round towers and domes, theirs square towers and spires.
const BASE_ART = {
  me: [
    ink(rr(30, 80, 180, 300, 12), '#D9CBB0'),
    line('M30 110h180M30 170h180M30 230h180M30 290h180M30 350h180', '#B9A888', 3),
    ink(rr(10, 40, 70, 350, 35), '#E6D9C0'),
    ink('M10 80a35 35 0 0 1 70 0z', C.me),
    ink(rr(160, 40, 70, 350, 35), '#E6D9C0'),
    ink('M160 80a35 35 0 0 1 70 0z', C.me),
    line('M195 45V0', C.ink, 4),
    ink('M195 2h34l-8 10 8 10h-34z', C.me, 3),
    ink('M150 300a40 40 0 0 1 80 0v80h-80z', '#5B3B25'),
    ink(ell(120, 190, 26), C.me),
    { d: ell(120, 190, 10), fill: C.cream },
  ],
  opp: [
    ink(rr(30, 80, 180, 300, 6), '#CDBFA3'),
    line('M30 110h180M30 170h180M30 230h180M30 290h180M30 350h180', '#AE9D7E', 3),
    ink(rr(10, 60, 70, 330, 0), '#DACDB2'),
    ink('M2 64 45 0 88 64z', C.opp),
    ink(rr(160, 60, 70, 330, 0), '#DACDB2'),
    ink('M152 64 195 6 238 64z', C.opp),
    ink('M10 300a40 40 0 0 1 80 0v80H10z', '#5B3B25'),
    ink('M120 164 96 206h48z', C.opp),
  ],
};
const BASE_CRACKS = [
  [line('M60 140l18 26-10 22', C.ink, 3), line('M200 130l-6 14 10 4', C.ink, 3)], // ≤70%
  [line('M110 90l-14 40 22 22-10 40M180 200l-20 30 16 24M60 120l14 30', C.ink, 4)], // ≤40%
  [line('M40 250l20 18-6 24 16 20M150 110l-12 26 14 18', C.ink, 4)], // ≤15%
];

/** Mob sprite in a 64×64 box, feet at y=60, facing right. `wi` = words already broken. */
function mobArt(type, team, incoming, wi) {
  const s = [];
  const o = (d, fill) => s.push({ d, fill, stroke: C.ink, lw: 2.5 });
  switch (type) {
    case 'goblin':
      o('M18 27 4 18l12 15z', '#7DBA4A');
      o('M46 27 60 18 48 33z', '#7DBA4A');
      o(rr(20, 40, 24, 18, 7), team);
      o(ell(32, 30, 15), '#7DBA4A');
      s.push({ d: ell(38, 28, 2.5), fill: C.ink });
      s.push(line('M34 36q4 2 8-1', C.ink, 2.5));
      break;
    case 'knight':
      if (wi === 0) s.push(line('M30 14q10-10 18-2', team, 7));
      o(rr(17, 34, 28, 24, 6), '#B8C0CC');
      o('M17 32a14 14 0 0 1 28 0v6H17z', '#D5DBE3');
      s.push({ d: rr(31, 27, 15, 4, 0), fill: C.ink });
      if (wi === 0) {
        o('M40 36h16v9q0 9-8 12-8-3-8-12z', team);
        s.push({ d: incoming ? 'M48 39l-4 10h8z' : ell(48, 45, 4), fill: C.cream });
      } else {
        o('M40 46h16q0 6-8 11-8-3-8-11z', team); // shield shattered: one layer down
      }
      break;
    case 'slime':
    case 'slimelet':
      o('M8 57C8 32 20 18 32 18s24 14 24 39z', '#8EE07A');
      s.push(line('M14 34q18-16 36 0', team, 6));
      s.push({ d: ell(26, 27, 5, 3), fill: '#C9F5BE' });
      s.push({ d: ell(38, 42, 3), fill: C.ink }, { d: ell(48, 42, 3), fill: C.ink });
      break;
    case 'giant':
      if (wi < 2) {
        s.push({ d: 'M46 34 60 6', stroke: '#6B4A2E', lw: 7 });
        o(ell(59, 8, 6.5), '#6B4A2E');
      }
      o(rr(12, 26, 38, 32, 13), '#C89B7B');
      o(rr(12, 44, 38, 8, 0), team);
      o(ell(30, 18, 12), '#C89B7B');
      s.push({ d: ell(36, 16, 2.5), fill: C.ink });
      s.push(line('M30 24h10', C.ink, 2.5));
      if (wi >= 1) s.push(line('M20 30l6 8-3 6M42 50l-5 4', C.ink, 2.5));
      break;
    default:
      o(ell(32, 40, 18), '#ccc');
  }
  return s;
}

const RETICLE = 'M4 26V4h22M74 4h22v22M96 74v22H74M26 96H4V74';
const SHIELD = 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z';
const STAR = 'M0-34 8-10 32-14 14 4 26 28 0 14-26 28-14 4-32-14-8-10z';
const SNOW = 'M12 2v20M3.3 7l17.4 10M20.7 7 3.3 17';

/** Draws the battlefield. Always renders the local player's base on the left. */
export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.you = 'p1';
    this.w = 0;
    this.h = 0;
    this.particles = [];
    this.floaters = [];
    this.bolts = [];
    this.stars = [];
    this.strikes = [];
    this.shakeAmt = 0;
    this.baseFlash = { me: 0, opp: 0 };
    this.baseHeal = { me: 0, opp: 0 };
    this.mobPos = new Map();
    this.ground = document.createElement('canvas');
    this.resize();
    window.addEventListener('resize', () => this.resize());
    document.fonts?.ready.then(() => this.resize());
  }

  resize() {
    const r = this.canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    this.dpr = dpr;
    this.w = Math.max(320, r.width);
    this.h = Math.max(200, r.height);
    this.canvas.width = Math.round(this.w * dpr);
    this.canvas.height = Math.round(this.h * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.k = this.h / REF_H;
    // Labels shrink less than the art so words stay readable on short screens.
    this.ls = Math.max(0.78, Math.min(1.35, this.k));
    this.baseW = LANE_INSET * this.k;
    this.paintGround();
  }

  setPerspective(you) {
    this.you = you;
  }

  // ------------------------------------------------------------ coords
  sx(x) {
    const span = this.w - this.baseW * 2;
    const t = x / LANE_LENGTH;
    return this.you === 'p1' ? this.baseW + t * span : this.w - this.baseW - t * span;
  }

  laneY(lane) {
    const { k } = this;
    return LANES === 1 ? ((LANE_TOP + LANE_BOTTOM) / 2) * k : (LANE_TOP + (lane / (LANES - 1)) * (LANE_BOTTOM - LANE_TOP)) * k;
  }

  baseX(side) {
    return side === 'me' ? 110 * this.k : this.w - 110 * this.k;
  }

  side(slot) {
    return slot === this.you ? 'me' : 'opp';
  }

  // ------------------------------------------------------------ effects
  shake(amount) {
    if (reducedMotion.matches) return;
    this.shakeAmt = Math.max(this.shakeAmt, amount);
  }

  flashBase(slot) {
    this.baseFlash[this.side(slot)] = 1;
  }

  healBase(slot) {
    this.baseHeal[this.side(slot)] = 1;
  }

  burst(x, y, color, n = 18, speed = 160) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = rand(0.3, 1) * speed;
      this.particles.push({
        x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 40, life: rand(0.4, 0.9), max: 0.9, color, size: rand(3, 6),
      });
    }
  }

  burstAtWorld(x, lane, color, n, speed) {
    this.burst(this.sx(x), this.laneY(lane) - 24 * this.k, color, n, speed);
  }

  /** Kill pop: an inked star plus gold sparks. */
  killFx(x, y) {
    this.stars.push({ x, y, life: 0.35, max: 0.35 });
    this.burst(x, y, C.gold, 14, 200);
  }

  float(x, y, text, color, size = 26) {
    this.floaters.push({ x, y, text, color, size, life: 1.1, max: 1.1 });
  }

  floatAtWorld(x, lane, text, color) {
    this.float(this.sx(x), this.laneY(lane) - 90 * this.k, text, color);
  }

  killAtWorld(x, lane, text) {
    this.floatAtWorld(x, lane, text, C.gold);
  }

  bolt(fromSlot, mobId) {
    const side = this.side(fromSlot);
    this.bolts.push({ side, mobId, life: 0.16, max: 0.16, seed: Math.random() * 100 });
  }

  lightning(targets) {
    for (const tg of targets) {
      const x = this.sx(tg.x);
      const y = this.laneY(tg.lane) - 30 * this.k;
      this.strikes.push({ x, y, life: 0.5, max: 0.5, seed: Math.random() });
      this.stars.push({ x, y, life: 0.4, max: 0.4 });
      this.burst(x, y, C.gold, 14, 220);
    }
    this.shake(10);
  }

  // ------------------------------------------------------------ frame
  draw(view, dt) {
    const { ctx } = this;
    const { snap } = view;
    ctx.save();
    ctx.clearRect(0, 0, this.w, this.h);
    if (this.shakeAmt > 0.1) {
      ctx.translate(rand(-1, 1) * this.shakeAmt, rand(-1, 1) * this.shakeAmt);
      this.shakeAmt *= Math.pow(0.002, dt);
    }
    ctx.drawImage(this.ground, 0, 0, this.w, this.h);
    if (snap) {
      const me = snap.players[this.you];
      const opp = snap.players[this.you === 'p1' ? 'p2' : 'p1'];
      this.drawFrost(snap);
      this.drawBase('me', me);
      this.drawBase('opp', opp);
      this.drawMobs(view);
    }
    this.drawBolts(dt);
    this.drawParticles(dt);
    this.drawStars(dt);
    this.drawStrikes(dt);
    this.drawFloaters(dt);
    ctx.restore();
    for (const k of ['me', 'opp']) {
      this.baseFlash[k] = Math.max(0, this.baseFlash[k] - dt * 3);
      this.baseHeal[k] = Math.max(0, this.baseHeal[k] - dt * 1.5);
    }
  }

  /** Static scenery, lanes and gate zone, cached until the next resize. */
  paintGround() {
    const g = this.ground;
    g.width = Math.round(this.w * this.dpr);
    g.height = Math.round(this.h * this.dpr);
    const ctx = g.getContext('2d');
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    const { w, h, k } = this;

    ctx.fillStyle = '#9BCB6A';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#86BB58';
    ctx.fillRect(0, 0, w, 150 * k);

    // Tree line across the top strip, so wide screens never look empty.
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let x = -20 * k; x < w; x += rnd() * 120 * k + 110 * k) {
      const s = (70 + rnd() * 40) * k;
      const y = (4 + rnd() * 56) * k;
      ctx.beginPath();
      ctx.arc(x + s / 2, y + s / 2, s / 2, 0, Math.PI * 2);
      ctx.fillStyle = '#5E9A3F';
      ctx.fill();
      ctx.save();
      ctx.clip();
      ctx.beginPath();
      ctx.arc(x + s / 2 - 8 * k, y + s / 2 - 8 * k, s / 2, 0, Math.PI * 2);
      ctx.rect(x - s, y - s, s * 3, s * 3);
      ctx.fillStyle = '#4F8735';
      ctx.fill('evenodd');
      ctx.restore();
      ctx.lineWidth = 3 * k;
      ctx.strokeStyle = '#3F6E2A';
      ctx.beginPath();
      ctx.arc(x + s / 2, y + s / 2, s / 2, 0, Math.PI * 2);
      ctx.stroke();
    }
    const flowers = ['#FFF8E8', '#FFD34D', '#F2A1C2'];
    const nFlowers = Math.round(w / 70);
    for (let i = 0; i < nFlowers; i++) {
      const fx = this.baseW + rnd() * (w - this.baseW * 2);
      const fy = (i % 2 ? 640 + (i % 3) * 14 : 160 + (i % 4) * 6) * k;
      ctx.fillStyle = flowers[i % 3];
      ctx.beginPath();
      ctx.arc(fx, fy, 4 * k, 0, Math.PI * 2);
      ctx.fill();
    }

    // Lanes: sandy paths with an inked rim.
    const lx = 190 * k;
    const lw = w - 380 * k;
    for (let l = 0; l < LANES; l++) {
      const y = this.laneY(l) - 34 * k;
      const lh = 48 * k;
      ctx.beginPath();
      ctx.roundRect(lx, y, lw, lh, lh / 2);
      ctx.fillStyle = '#E6C792';
      ctx.fill();
      ctx.save();
      ctx.clip();
      ctx.fillStyle = '#C9A66B';
      ctx.fillRect(lx, y + lh - 5 * k, lw, 5 * k);
      ctx.restore();
      ctx.lineWidth = 3 * k;
      ctx.strokeStyle = '#B8925A';
      ctx.beginPath();
      ctx.roundRect(lx - 1.5 * k, y - 1.5 * k, lw + 3 * k, lh + 3 * k, lh / 2 + 1.5 * k);
      ctx.stroke();
    }

    // Gate zone: hatched stretch where incoming mobs turn dangerous.
    const gx0 = 225 * k;
    const gx1 = this.baseW + DANGER_DIST * (w - this.baseW * 2);
    const gy0 = this.laneY(0) - 80 * k;
    const gy1 = this.laneY(LANES - 1) + 30 * k;
    ctx.save();
    ctx.beginPath();
    ctx.rect(gx0, gy0, gx1 - gx0, gy1 - gy0);
    ctx.clip();
    ctx.strokeStyle = 'rgba(194,24,58,.16)';
    ctx.lineWidth = 14 * k;
    for (let d = -(gy1 - gy0); d < gx1 - gx0; d += 28 * k * Math.SQRT2) {
      ctx.beginPath();
      ctx.moveTo(gx0 + d, gy1);
      ctx.lineTo(gx0 + d + (gy1 - gy0), gy0);
      ctx.stroke();
    }
    ctx.restore();
    ctx.setLineDash([12 * k, 8 * k]);
    ctx.lineWidth = 4 * k;
    ctx.strokeStyle = 'rgba(194,24,58,.7)';
    ctx.beginPath();
    ctx.moveTo(gx1, gy0);
    ctx.lineTo(gx1, gy1);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.font = `900 ${Math.round(13 * this.ls)}px ${BODY}`;
    const label = 'GATE ZONE';
    const tw = ctx.measureText(label).width;
    const px = 6 * this.ls;
    const bx = gx1 - tw - px * 2 - 8 * k;
    ctx.fillStyle = C.dangerBg;
    ctx.beginPath();
    ctx.roundRect(bx, gy0 + 4 * k, tw + px * 2, 20 * this.ls, 6);
    ctx.fill();
    ctx.fillStyle = '#8E1029';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, bx + px, gy0 + 4 * k + 10 * this.ls + 1);
  }

  drawFrost(snap) {
    const { ctx, w, h } = this;
    for (const slot of ['p1', 'p2']) {
      if (snap.players[slot].frost <= 0) continue;
      const side = this.side(slot);
      const x0 = side === 'me' ? 0 : w / 2;
      const fg = ctx.createLinearGradient(x0, 0, x0 + w / 2, 0);
      fg.addColorStop(side === 'me' ? 0 : 1, 'rgba(170,220,255,.45)');
      fg.addColorStop(side === 'me' ? 1 : 0, 'rgba(170,220,255,0)');
      ctx.fillStyle = fg;
      ctx.fillRect(x0, 0, w / 2, h);
    }
  }

  drawBase(side, p) {
    const { ctx, k } = this;
    const x = side === 'me' ? -10 * k : this.w - 230 * k;
    const art = BASE_ART[side];
    const dmg = 1 - p.hp / BASE_HP;
    ctx.save();
    ctx.translate(x, 190 * k);
    ctx.scale(k, k);
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    paint(ctx, art);
    if (dmg >= 0.3) paint(ctx, BASE_CRACKS[0]);
    if (dmg >= 0.6) paint(ctx, BASE_CRACKS[1]);
    if (dmg >= 0.85) paint(ctx, BASE_CRACKS[2]);
    if (dmg >= 0.6) {
      // Smoke from the battlements once it's badly hurt.
      const t = performance.now() / 600;
      ctx.fillStyle = 'rgba(140,130,115,.7)';
      for (let i = 0; i < (dmg >= 0.85 ? 4 : 2); i++) {
        const ph = (t + i * 0.45) % 1;
        ctx.globalAlpha = 0.7 * (1 - ph);
        ctx.beginPath();
        ctx.arc(70 + i * 30 + ph * 18, 40 - ph * 50, 10 + ph * 10, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
    if (p.frost > 0) {
      ctx.globalAlpha = 0.35;
      paint(ctx, art, '#BFE6FF');
      ctx.globalAlpha = 1;
    }
    if (this.baseFlash[side] > 0) {
      ctx.globalAlpha = this.baseFlash[side] * 0.6;
      paint(ctx, art, '#FF3B3B');
      ctx.globalAlpha = 1;
    }
    if (this.baseHeal[side] > 0) {
      ctx.globalAlpha = this.baseHeal[side] * 0.5;
      paint(ctx, art, '#9BE87A');
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  }

  drawMobs(view) {
    const { ctx } = this;
    const { mobs, lock, now, snap } = view;
    const fogged = snap.players[this.you].fog > 0;
    const fight = view.mode === 'fight';
    this.mobPos.clear();

    const sorted = [...mobs].sort((a, b) => a.lane - b.lane);
    for (const m of sorted) {
      const x = this.sx(m.dx);
      const y = this.laneY(m.lane);
      const size = (MOB_PX[m.type] ?? 56) * this.k;
      this.mobPos.set(m.id, { x, y: y - size / 2 });
      const dir = m.vx > 0 === (this.you === 'p1') ? 1 : -1;
      const incoming = m.target === this.you;
      const frozen = snap.players[m.target].frost > 0;
      this.drawMob(m, x, y, size, dir, incoming, frozen, now);
    }

    // Labels sit on their own layer above all art. Same-lane neighbours that would
    // overlap collapse into the front label's queue instead of stacking into towers.
    const labels = [];
    for (const m of sorted) {
      const incoming = m.target === this.you;
      const locked = !!lock && lock.kind === 'mob' && lock.id === m.id;
      const wi = locked ? lock.wi : m.wi;
      const word = m.words[wi];
      if (!word) continue;
      const dist = incoming ? (this.you === 'p1' ? m.dx : LANE_LENGTH - m.dx) / LANE_LENGTH : 1;
      const size = (MOB_PX[m.type] ?? 56) * this.k;
      const l = {
        m, x: this.sx(m.dx), mobY: this.laneY(m.lane), size, word, incoming, locked,
        extra: m.words.length - wi - 1,
        typed: locked ? lock.typed : incoming ? 0 : m.typed,
        danger: incoming && dist < DANGER_DIST,
        priority: locked ? -1 : incoming ? dist : 2 + m.id * 1e-6,
        queue: [],
      };
      this.measureLabel(l);
      labels.push(l);
    }
    labels.sort((a, b) => a.priority - b.priority);
    const placed = [];
    const hidden = [];
    for (const l of labels) {
      l.x = Math.max(l.bw / 2 + 4, Math.min(this.w - l.bw / 2 - 4, l.x));
      l.y = l.mobY - l.size - (l.incoming ? 12 : 8) * this.k - l.bh / 2;
      const hit = placed.find((p) => Math.abs(l.x - p.x) < (l.bw + p.bw) / 2 + 4
        && Math.abs(l.y - p.y) < (l.bh + p.bh) / 2 + 2);
      if (!hit) {
        placed.push(l);
        continue;
      }
      hidden.push(l);
      if (l.incoming && hit.incoming && hit.queue.length < 3) {
        hit.queue.push(l.word[0]);
        this.measureLabel(hit);
      }
    }

    for (const l of hidden) {
      const r = 7 * this.ls;
      ctx.beginPath();
      ctx.arc(l.x, l.mobY - l.size - 18 * this.k + r, r, 0, Math.PI * 2);
      ctx.fillStyle = C.cream;
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = C.ink;
      ctx.stroke();
    }
    for (const l of placed) if (l.locked) this.drawReticle(this.sx(l.m.dx), l.mobY, l.size, now);
    for (const l of [...placed].reverse()) {
      this.drawLabel(l, { active: !l.incoming || fight, fogged: l.incoming && fogged, now });
    }
  }

  /** Lays out a label's parts and stores its box size on it. */
  measureLabel(l) {
    const { ctx, ls } = this;
    const kind = l.locked ? 'locked' : l.incoming ? 'in' : 'out';
    const fs = { locked: 32, in: 24, out: 16 }[kind] * ls;
    const padX = { locked: 14, in: 10, out: 8 }[kind] * ls;
    const padY = { locked: 8, in: 6, out: 4 }[kind] * ls;
    const border = { locked: 4, in: 3, out: 2 }[kind];
    const gap = 6 * ls;
    ctx.font = `800 ${fs}px ${MONO}`;
    const charW = ctx.measureText('m').width;
    const parts = [];
    if (l.danger) parts.push(['bang', 22 * ls]);
    if (l.locked) parts.push(['ret', 22 * ls]);
    parts.push(['word', charW * l.word.length + (l.typed > 0 && l.incoming ? 4 * ls : 0)]);
    if (l.incoming && l.extra > 0) {
      ctx.font = `900 ${15 * ls}px ${BODY}`;
      parts.push(['armor', 13 * ls + 3 * ls + ctx.measureText(`+${l.extra}`).width + 12 * ls]);
    }
    if (l.queue.length) parts.push(['queue', 8 * ls + l.queue.length * 26 * ls + (l.queue.length - 1) * 4 * ls]);
    const inner = parts.reduce((s, [, w]) => s + w, 0) + gap * (parts.length - 1);
    Object.assign(l, {
      kind, fs, padX, padY, border, gap, charW, parts,
      bw: inner + padX * 2 + border * 2,
      bh: fs + padY * 2 + border * 2 + (kind === 'out' ? 0 : 4 * ls),
    });
  }

  drawLabel(l, { active, fogged, now }) {
    const { ctx, ls } = this;
    const { kind, fs, padX, border, gap, charW, bw, bh } = l;
    const dim = l.incoming && !active && !l.danger && !l.locked;
    ctx.save();
    ctx.translate(l.x, l.y);
    if (l.danger && !reducedMotion.matches) {
      const s = 1 + 0.035 * (1 + Math.sin((now / 700) * Math.PI * 2));
      ctx.scale(s, s);
    }
    ctx.globalAlpha = dim ? 0.5 : kind === 'out' ? 0.88 : 1;
    const bx = -bw / 2;
    const by = -bh / 2;
    const radius = 12 * ls;

    let bg = C.cream;
    let edge = C.ink;
    let shadow = C.ink;
    if (kind === 'out') {
      bg = C.meDeep;
      edge = '#A9C3F5';
      shadow = null;
    } else if (l.locked) {
      edge = C.meDeep;
      shadow = l.danger ? C.danger : C.meDeep;
    } else if (l.danger) {
      bg = C.dangerBg;
      edge = C.danger;
      shadow = C.danger;
    }
    if (dim) shadow = null;
    if (l.locked) {
      ctx.fillStyle = l.danger ? 'rgba(194,24,58,.3)' : 'rgba(47,111,224,.25)';
      ctx.beginPath();
      ctx.roundRect(bx - 6 * ls, by - 6 * ls, bw + 12 * ls, bh + 12 * ls + 5 * ls, radius + 6 * ls);
      ctx.fill();
    }
    if (shadow) {
      ctx.fillStyle = shadow;
      ctx.beginPath();
      ctx.roundRect(bx, by + (l.locked ? 5 : 4) * ls, bw, bh, radius);
      ctx.fill();
    }
    ctx.fillStyle = bg;
    ctx.beginPath();
    ctx.roundRect(bx, by, bw, bh, radius);
    ctx.fill();
    ctx.strokeStyle = edge;
    ctx.lineWidth = border;
    if (dim) ctx.setLineDash([7, 5]);
    ctx.beginPath();
    ctx.roundRect(bx + border / 2, by + border / 2, bw - border, bh - border, radius - border / 2);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    let x = bx + border + l.padX;
    for (const [part, pw] of l.parts) {
      if (part === 'bang') this.drawBang(x + pw / 2, 0, pw);
      else if (part === 'ret') this.drawCrosshair(x + pw / 2, 0, pw);
      else if (part === 'word') this.drawWord(l, x, fs, charW, fogged);
      else if (part === 'armor') {
        ctx.fillStyle = C.ink;
        ctx.beginPath();
        ctx.roundRect(x, -11 * ls, pw, 22 * ls, 8 * ls);
        ctx.fill();
        ctx.save();
        ctx.translate(x + 6 * ls, -6.5 * ls);
        ctx.scale((13 * ls) / 24, (13 * ls) / 24);
        ctx.fillStyle = C.cream;
        ctx.fill(P(SHIELD));
        ctx.restore();
        ctx.font = `900 ${15 * ls}px ${BODY}`;
        ctx.fillStyle = C.cream;
        ctx.fillText(`+${l.extra}`, x + 6 * ls + 16 * ls, 1);
      } else if (part === 'queue') {
        ctx.strokeStyle = '#C9B48E';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x, -13 * ls);
        ctx.lineTo(x, 13 * ls);
        ctx.stroke();
        let qx = x + 8 * ls;
        ctx.font = `800 ${16 * ls}px ${MONO}`;
        ctx.textAlign = 'center';
        for (const ch of l.queue) {
          ctx.setLineDash([3, 2]);
          ctx.strokeStyle = C.ink;
          ctx.beginPath();
          ctx.arc(qx + 13 * ls, 0, 12 * ls, 0, Math.PI * 2);
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.fillStyle = C.ink;
          ctx.fillText(ch, qx + 13 * ls, 1);
          qx += 30 * ls;
        }
        ctx.textAlign = 'left';
      }
      x += pw + gap;
    }
    ctx.restore();
  }

  /** Word with typed letters on a solid chip, the next letter underlined, the rest plain. */
  drawWord(l, x, fs, charW, fogged) {
    const { ctx, ls } = this;
    const { word, typed } = l;
    ctx.font = `800 ${fs}px ${MONO}`;
    const out = l.kind === 'out';
    if (out) {
      ctx.fillStyle = '#DCE8FF';
      ctx.fillText(word, x, 1);
      if (typed > 0) {
        // Opponent's progress on my mob: their colour, struck through.
        ctx.fillStyle = '#FFB37A';
        ctx.fillText(word.slice(0, typed), x, 1);
        ctx.fillRect(x, -1.5, charW * typed, 3);
      }
      return;
    }
    let cx = x;
    if (typed > 0) {
      const tw = charW * typed + 4 * ls;
      ctx.fillStyle = l.locked ? C.meDeep : C.ink;
      ctx.beginPath();
      ctx.roundRect(cx, -fs * 0.6, tw, fs * 1.2, 4 * ls);
      ctx.fill();
      ctx.fillStyle = C.cream;
      ctx.fillText(word.slice(0, typed), cx + 2 * ls, 1);
      cx += tw;
    }
    const next = word.charAt(typed);
    ctx.fillStyle = C.ink;
    ctx.fillText(next, cx, 1);
    ctx.fillRect(cx, fs * 0.5 + 2 * ls, charW, Math.max(3, (l.locked ? 5 : 4) * ls));
    cx += charW;
    const rest = word.slice(typed + 1);
    if (!rest) return;
    if (fogged) {
      // Fog hides everything but the next letter.
      ctx.save();
      ctx.filter = `blur(${3.5 * ls}px)`;
      ctx.globalAlpha *= 0.75;
      ctx.fillText(rest, cx, 1);
      ctx.restore();
    } else {
      ctx.fillText(rest, cx, 1);
    }
  }

  drawBang(x, y, size) {
    const { ctx } = this;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(Math.PI / 4);
    ctx.fillStyle = C.danger;
    ctx.beginPath();
    ctx.roundRect(-size * 0.36, -size * 0.36, size * 0.72, size * 0.72, 3);
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = '#fff';
    ctx.font = `900 ${size * 0.7}px ${BODY}`;
    ctx.textAlign = 'center';
    ctx.fillText('!', x, y + 1);
    ctx.textAlign = 'left';
  }

  drawCrosshair(x, y, size) {
    const { ctx } = this;
    ctx.save();
    ctx.translate(x - size / 2, y - size / 2);
    ctx.scale(size / 24, size / 24);
    ctx.strokeStyle = C.meDeep;
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.stroke(P(`${ell(12, 12, 8)}M12 1v5M12 18v5M1 12h5M18 12h5`));
    ctx.restore();
  }

  drawMob(m, x, y, size, dir, incoming, frozen, now) {
    const { ctx } = this;
    const team = incoming ? C.opp : C.me;
    const speed = frozen ? 0.4 : 1;
    const phase = (now / 140) * speed + m.id;
    const bob = Math.abs(Math.sin(phase)) * 3 * this.k;
    const squash = m.type === 'slime' || m.type === 'slimelet' ? Math.sin(phase * 2) * 0.06 : 0;

    ctx.save();
    ctx.translate(x, y);
    ctx.scale((size / 64) * dir, size / 64);
    ctx.translate(-32, -64);
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    // Ground ring: solid for mine, dashed for theirs, so team reads without colour.
    paint(ctx, [{
      d: ell(32, 60, 22, 5), fill: 'rgba(43,33,24,.18)', stroke: team, lw: 3.5, dash: incoming ? [5, 4] : null,
    }]);
    ctx.translate(32, 60 - (bob * 64) / size);
    ctx.rotate(m.type === 'slime' || m.type === 'slimelet' ? 0 : Math.sin(phase) * 0.05);
    ctx.scale(1 + squash, 1 - squash);
    ctx.translate(-32, -60);
    paint(ctx, mobArt(m.type, team, incoming, m.wi));
    if (frozen) {
      ctx.globalAlpha = 0.3;
      paint(ctx, mobArt(m.type, team, incoming, m.wi), '#BFE6FF');
      ctx.globalAlpha = 1;
    }
    ctx.restore();

    if (frozen) {
      ctx.save();
      ctx.translate(x - size / 2 - 4, y - size * 0.9);
      ctx.scale((14 * this.ls) / 24, (14 * this.ls) / 24);
      ctx.strokeStyle = '#3A8FC2';
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.stroke(P(SNOW));
      ctx.restore();
    }
  }

  drawReticle(x, y, s, now) {
    const { ctx } = this;
    const pulse = reducedMotion.matches ? 0 : Math.sin(now / 120) * 3;
    const w = s + 28 + pulse * 2;
    const h = s + 24 + pulse * 2;
    ctx.save();
    ctx.translate(x - w / 2, y - s - 12 - pulse);
    ctx.scale(w / 100, h / 100);
    ctx.strokeStyle = C.meDeep;
    ctx.lineWidth = 7;
    ctx.lineCap = 'round';
    ctx.stroke(P(RETICLE));
    ctx.restore();
  }

  /** Keystroke zaps: a jagged inked bolt from the shooter's base to the target. */
  drawBolts(dt) {
    const { ctx, k } = this;
    this.bolts = this.bolts.filter((b) => {
      b.life -= dt;
      const target = this.mobPos.get(b.mobId) ?? b.last;
      if (b.life <= 0 || !target) return false;
      b.last = target;
      const x0 = this.baseX(b.side);
      const y0 = 375 * k;
      const pts = [[x0, y0]];
      const steps = 6;
      for (let i = 1; i < steps; i++) {
        const t = i / steps;
        pts.push([x0 + (target.x - x0) * t, y0 + (target.y - y0) * t + (i % 2 ? -1 : 1) * 16 * k * Math.sin(b.seed + i)]);
      }
      pts.push([target.x, target.y]);
      ctx.globalAlpha = Math.min(1, (b.life / b.max) * 2);
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      const stroke = (color, width, dash) => {
        ctx.strokeStyle = color;
        ctx.lineWidth = width;
        ctx.setLineDash(dash ?? []);
        ctx.beginPath();
        pts.forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py)));
        ctx.stroke();
      };
      if (b.side === 'me') {
        stroke(C.cream, 10 * k);
        stroke(C.me, 5 * k);
      } else {
        stroke(C.opp, 5 * k, [10 * k, 8 * k]);
      }
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;
      return true;
    });
  }

  drawParticles(dt) {
    const { ctx } = this;
    this.particles = this.particles.filter((p) => {
      p.life -= dt;
      if (p.life <= 0) return false;
      p.vy += 300 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      ctx.globalAlpha = Math.max(0, p.life / p.max);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size / 2, 0, Math.PI * 2);
      ctx.fill();
      return true;
    });
    ctx.globalAlpha = 1;
  }

  drawStars(dt) {
    const { ctx, k } = this;
    this.stars = this.stars.filter((s) => {
      s.life -= dt;
      if (s.life <= 0) return false;
      const t = 1 - s.life / s.max;
      ctx.save();
      ctx.globalAlpha = Math.min(1, (s.life / s.max) * 2);
      ctx.translate(s.x, s.y);
      ctx.scale(k * (0.6 + t * 0.7), k * (0.6 + t * 0.7));
      ctx.rotate(t * 0.6);
      ctx.fillStyle = C.gold;
      ctx.fill(P(STAR));
      ctx.lineWidth = 3;
      ctx.lineJoin = 'round';
      ctx.strokeStyle = C.ink;
      ctx.stroke(P(STAR));
      ctx.restore();
      return true;
    });
  }

  drawStrikes(dt) {
    const { ctx, k } = this;
    this.strikes = this.strikes.filter((s) => {
      s.life -= dt;
      if (s.life <= 0) return false;
      ctx.globalAlpha = s.life / s.max;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      const path = () => {
        ctx.beginPath();
        let x = s.x + 30 * Math.sin(s.seed * 10);
        ctx.moveTo(x, 0);
        const steps = 8;
        for (let i = 1; i <= steps; i++) {
          const y = (s.y * i) / steps;
          x = i === steps ? s.x : s.x + Math.sin(s.seed * 50 + i * 7) * 22 * k;
          ctx.lineTo(x, y);
        }
      };
      path();
      ctx.strokeStyle = C.ink;
      ctx.lineWidth = 12 * k;
      ctx.stroke();
      path();
      ctx.strokeStyle = C.gold;
      ctx.lineWidth = 6 * k;
      ctx.stroke();
      return true;
    });
    ctx.globalAlpha = 1;
  }

  drawFloaters(dt) {
    const { ctx } = this;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    this.floaters = this.floaters.filter((f) => {
      f.life -= dt;
      if (f.life <= 0) return false;
      f.y -= 40 * dt;
      const size = f.size * this.ls;
      ctx.globalAlpha = Math.min(1, (f.life / f.max) * 2);
      ctx.font = `${size}px ${DISPLAY}`;
      ctx.strokeStyle = C.ink;
      ctx.lineWidth = Math.max(3, size / 9);
      ctx.strokeText(f.text, f.x, f.y);
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, f.x, f.y);
      return true;
    });
    ctx.globalAlpha = 1;
    ctx.textAlign = 'left';
  }
}
