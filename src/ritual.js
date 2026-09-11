/**
 * 七步存星仪式状态机（纯逻辑，可测）
 * idle → trigger → write → color → offer → name → converge → afterglow → idle
 */

export const STEPS = [
  'idle',
  'trigger',
  'write',
  'color',
  'offer',
  'name',
  'converge',
  'afterglow',
];

export class StoreRitual {
  constructor({ store, galaxy, ui, onHint }) {
    this.store = store;
    this.galaxy = galaxy;
    this.ui = ui;
    this.onHint = onHint || (() => {});
    this.step = 'idle';
    this.draft = null;
    this.targetPos = null;
    this._timers = [];
  }

  get busy() {
    return this.step !== 'idle';
  }

  _clearTimers() {
    this._timers.forEach((t) => clearTimeout(t));
    this._timers = [];
  }

  _after(ms, fn) {
    const t = setTimeout(fn, ms);
    this._timers.push(t);
    return t;
  }

  start(pos) {
    if (this.busy) return;
    this.targetPos = pos || this.galaxy.createStarPosition();
    const saved = this.store.getDraft();
    this.draft = saved || {
      text: '',
      emotion: null,
      media: [],
      name: '',
      startedAt: Date.now(),
    };
    this.store.log('ritual_step', { step: 'trigger' });
    this.step = 'trigger';
    this.ui.enterDim();
    this.ui.showLightDomain();
    this._after(800, () => this.enterWrite());
  }

  enterWrite() {
    this.step = 'write';
    this.store.log('ritual_step', { step: 'write' });
    this.ui.showWrite({
      value: this.draft.text || '',
      max: 300,
      onInput: (text) => {
        this.draft.text = text;
        this.ui.setLightPoints(300 - text.length);
        this.store.saveDraft(this.draft);
      },
      onSubmit: () => this._fromWrite(),
      onEscape: () => this.abortToDraft(),
    });
  }

  _fromWrite() {
    const t = (this.draft.text || '').trim();
    if (!t) return;
    this.enterColor();
  }

  enterColor() {
    this.step = 'color';
    this.store.log('ritual_step', { step: 'color' });
    this.ui.showColor({
      onHover: (key) => this.ui.nightTemperature(key, 800),
      onPick: (key) => {
        this.draft.emotion = key;
        this.store.saveDraft(this.draft);
        this.enterOffer();
      },
      onEscape: () => this.abortToDraft(),
    });
  }

  enterOffer() {
    this.step = 'offer';
    this.store.log('ritual_step', { step: 'offer' });
    this.ui.showOffer({
      media: this.draft.media || [],
      onSkip: () => this.enterName(),
      onAdd: (item) => {
        this.draft.media = [...(this.draft.media || []), item];
        this.store.saveDraft(this.draft);
      },
      onRemove: (id) => {
        this.draft.media = (this.draft.media || []).filter((m) => m.id !== id);
        this.store.saveDraft(this.draft);
      },
      onDone: () => this.enterName(),
      onEscape: () => this.abortToDraft(),
    });
  }

  enterName() {
    this.step = 'name';
    this.store.log('ritual_step', { step: 'name' });
    this.ui.showName({
      value: this.draft.name || '',
      onConfirm: (name) => {
        this.draft.name = (name || '').trim();
        this.store.saveDraft(this.draft);
        this.enterConverge();
      },
      onEscape: () => this.abortToDraft(),
    });
  }

  async enterConverge() {
    this.step = 'converge';
    this.store.log('ritual_step', { step: 'converge' });
    this.ui.lockAll();
    this.ui.showConverge();

    const memorial = this.draft.emotion === 'eternal';
    const duration = memorial ? 6000 : 5000;

    await this.galaxy.fxConverge(
      {
        pos: this.targetPos,
        color: undefined, // galaxy resolves from emotion via callback below
        emotion: this.draft.emotion,
        text: this.draft.text,
      },
      duration,
      memorial,
    );

    const star = this.store.createStar({
      text: this.draft.text,
      emotion: this.draft.emotion,
      name: this.draft.name,
      pos: this.targetPos,
      media: this.draft.media || [],
    });
    this.store.clearDraft();
    await this.store.save();
    this.store.log('ritual_complete', {
      emotion: star.layers[0].emotion,
      textLen: star.layers[0].text.length,
      durationMs: duration,
    });
    if (this.store.countLive() === 1) {
      this.store.log('first_star_born', { emotion: star.layers[0].emotion });
    } else if (this.store.countLive() === 2) {
      this.store.log('second_star_born', {});
    }

    this.galaxy.setMemoryStars(this.store.listStars());
    this.enterAfterglow();
  }

  enterAfterglow() {
    this.step = 'afterglow';
    this.store.log('ritual_step', { step: 'afterglow' });
    this.ui.showAfterglow();
    this.galaxy.pullBack(3000);
    this._after(3000, () => {
      this.ui.exitDim();
      this.ui.zeroUI();
      this.step = 'idle';
    });
  }

  abortToDraft() {
    this.store.log('ritual_abort', { step: this.step });
    this.store.saveDraft(this.draft);
    this.store.save();
    this.galaxy.leaveUnformed(this.targetPos);
    this.ui.exitDim();
    this.ui.zeroUI();
    this.onHint('未凝之光，已替你留在原地');
    this.step = 'idle';
  }

  dispose() {
    this._clearTimers();
  }
}
