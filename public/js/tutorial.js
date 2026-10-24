import { tutorialPolicy } from '../../shared/tutorial-policy.js';
const $ = (selector) => document.querySelector(selector);
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

/** A viewport overlay with a live anchor, including words drawn on the canvas. */
export class TutorialOverlay {
  constructor() {
    this.root = $('#tutorial');
    this.card = $('#tutorial-card');
    this.spotlight = $('#tutorial-spotlight');
    this.signature = '';
  }

  hide() {
    if (this.root.matches(':popover-open')) this.root.hidePopover();
    this.signature = '';
  }

  update({ lesson, player, mode, lock, renderer }) {
    const { complete: done, guidance } = tutorialPolicy(lesson, mode);
    if (!guidance) return this.hide();
    let rect;
    let word;
    if (guidance.anchor === 'ore') {
      const ore = player.ores.find((ore) => ore.id === lock?.id)
        ?? player.ores[0];
      rect = ore && $(`#ores .ore[data-id="${ore.id}"]`)?.getBoundingClientRect();
      word = ore?.word;
    } else if (guidance.anchor === 'enemy') {
      const anchor = renderer.tutorialAnchor;
      if (anchor) {
        const canvas = renderer.canvas.getBoundingClientRect();
        const scaleX = canvas.width / renderer.w;
        const scaleY = canvas.height / renderer.h;
        rect = { left: canvas.left + anchor.x * scaleX, top: canvas.top + anchor.y * scaleY,
          width: anchor.width * scaleX, height: anchor.height * scaleY,
          enemyBottom: canvas.top + anchor.enemyBottom * scaleY };
        word = anchor.word;
      }
    } else if (!done) {
      const target = guidance.item
        ? $(`.tile[data-id="${guidance.item}"]`) : $(`#${guidance.focus}`);
      rect = target?.getBoundingClientRect();
    }
    if (!rect && !done) return this.hide();

    const signature = JSON.stringify([lesson.id, lesson.mined, guidance.focus, word]);
    if (signature !== this.signature) {
      this.signature = signature;
      $('#tutorial-progress').textContent = done ? 'Tutorial complete'
        : `${lesson.step} / ${lesson.total}${guidance.anchor === 'ore' ? ` · ${lesson.mined}/2 words` : ''}`;
      $('#tutorial-title').textContent = guidance.title;
      $('#tutorial-verb').textContent = guidance.verb;
      $('#tutorial-key').textContent = word ?? guidance.key ?? '';
      $('#tutorial-instruction').classList.toggle('hidden', done);
      $('#tutorial-complete').classList.toggle('hidden', !done);
    }
    if (!this.root.matches(':popover-open')) this.root.showPopover();
    this.position(rect, guidance.anchor === 'enemy');
  }

  position(rect, belowEnemy = false) {
    const width = window.innerWidth;
    const height = window.innerHeight;
    const viewport = `M0 0H${width}V${height}H0Z`;
    this.spotlight.classList.toggle('hidden', !rect);
    if (!rect) {
      $('#tutorial-shade').setAttribute('d', viewport);
      this.card.dataset.side = 'center';
      this.card.style.left = `${(width - this.card.offsetWidth) / 2}px`;
      this.card.style.top = `${(height - this.card.offsetHeight) / 2}px`;
      return;
    }

    const left = clamp(rect.left - 8, 2, width - 2);
    const top = clamp(rect.top - 8, 2, height - 2);
    const right = clamp(rect.left + rect.width + 8, left, width - 2);
    const bottom = clamp(rect.top + rect.height + 8, top, height - 2);
    $('#tutorial-shade').setAttribute('d', `${viewport}M${left} ${top}H${right}V${bottom}H${left}Z`);
    Object.assign(this.spotlight.style, { left: `${left}px`, top: `${top}px`, width: `${right - left}px`, height: `${bottom - top}px` });

    const cardWidth = this.card.offsetWidth;
    const cardHeight = this.card.offsetHeight;
    const x = clamp((left + right - cardWidth) / 2, 12, width - cardWidth - 12);
    const above = !belowEnemy && top >= cardHeight + 30;
    const y = above ? top - cardHeight - 18 : Math.max(bottom, rect.enemyBottom ?? bottom) + 18;
    this.card.dataset.side = above ? 'above' : 'below';
    this.card.style.left = `${x}px`;
    this.card.style.top = `${clamp(y, 12, height - cardHeight - 12)}px`;
    this.card.style.setProperty('--arrow-x', `${clamp((left + right) / 2 - x - 7, 20, cardWidth - 34)}px`);
  }
}
