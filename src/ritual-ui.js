import { EMOTION_ORDER, EMOTIONS } from './emotions.js';

/**
 * 仪式 UI：全屏光域，无卡片无输入框边框
 */
export class RitualUI {
  constructor(root) {
    this.root = root;
    this.root.innerHTML = '';
    this.root.hidden = true;
    this._onKey = null;
  }

  _el(tag, cls, html) {
    const el = document.createElement(tag);
    if (cls) el.className = cls;
    if (html != null) el.innerHTML = html;
    return el;
  }

  enterDim() {
    this.root.hidden = false;
    this.root.classList.add('ritual-dim');
    this.root.innerHTML = '';
  }

  exitDim() {
    this.root.classList.remove('ritual-dim');
    this.root.hidden = true;
    this.root.innerHTML = '';
    this._unbindKey();
  }

  zeroUI() {
    this.root.hidden = true;
  }

  lockAll() {
    this.root.classList.add('locked');
  }

  unlockAll() {
    this.root.classList.remove('locked');
  }

  _unbindKey() {
    if (this._onKey) {
      window.removeEventListener('keydown', this._onKey);
      this._onKey = null;
    }
  }

  _bindKey(handler) {
    this._unbindKey();
    this._onKey = handler;
    window.addEventListener('keydown', handler);
  }

  showLightDomain() {
    const domain = this._el('div', 'light-domain');
    const pts = this._el('div', 'light-points');
    const label = this._el('p', 'light-label', '写下这一刻');
    domain.append(pts, label);
    this.root.append(domain);
    this._points = pts;
  }

  setLightPoints(n) {
    if (!this._points) return;
    const gold = n <= 30;
    this._points.classList.toggle('gold', gold);
    const show = Math.max(0, Math.min(30, Math.ceil(n / 10)));
    this._points.innerHTML = Array.from({ length: show }, () => '<i></i>').join('');
  }

  nightTemperature(emotionKey, ms = 800) {
    const hex = EMOTIONS[emotionKey]?.hex || '#E8C27A';
    document.documentElement.style.setProperty('--ritual-tint', hex);
    this.root.style.transition = `background-color ${ms}ms ease`;
    this.root.style.backgroundColor = `color-mix(in srgb, #050510 72%, ${hex} 28%)`;
  }

  showWrite({ value, max, onInput, onSubmit, onEscape }) {
    this.lockAll();
    const domain = this.root.querySelector('.light-domain');
    const stage = this._el('div', 'rite-stage write');
    const ta = this._el('textarea', 'rite-text');
    ta.value = value || '';
    ta.maxLength = max;
    ta.placeholder = '';
    ta.spellcheck = false;
    const tip = this._el('p', 'rite-tip', '余量化作光点 · 剩 30 字时转金');
    const actions = this._el('div', 'rite-actions');
    const next = this._el('button', 'rite-next', '继续');
    const esc = this._el('button', 'rite-ghost', '暂离');
    actions.append(esc, next);
    stage.append(ta, tip, actions);
    domain.append(stage);
    this.setLightPoints(max - (value || '').length);

    ta.addEventListener('input', () => onInput(ta.value));
    next.addEventListener('click', () => {
      if (ta.value.trim()) onSubmit(ta.value);
    });
    esc.addEventListener('click', onEscape);
    this._bindKey((e) => {
      if (e.key === 'Escape') onEscape();
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && ta.value.trim()) onSubmit(ta.value);
    });
    setTimeout(() => ta.focus(), 50);
  }

  showColor({ onHover, onPick, onEscape }) {
    const domain = this.root.querySelector('.light-domain');
    const stage = domain.querySelector('.rite-stage');
    if (stage) stage.remove();

    const wrap = this._el('div', 'rite-stage color');
    const q = this._el('p', 'rite-question', '这一刻，是哪种光？');
    const row = this._el('div', 'emotion-orbit');
    EMOTION_ORDER.forEach((key, i) => {
      if (key === 'eternal') row.append(this._el('div', 'emotion-gap'));
      const ball = this._el('button', 'emotion-ball');
      ball.style.setProperty('--c', EMOTIONS[key].hex);
      ball.dataset.key = key;
      ball.setAttribute('aria-label', EMOTIONS[key].line);
      const line = this._el('span', 'emotion-line', EMOTIONS[key].line);
      ball.append(line);
      ball.addEventListener('mouseenter', () => onHover(key));
      ball.addEventListener('click', () => onPick(key));
      row.append(ball);
    });
    const esc = this._el('button', 'rite-ghost', '返回书写');
    esc.addEventListener('click', onEscape);
    wrap.append(q, row, esc);
    domain.append(wrap);
    this._bindKey((e) => {
      if (e.key === 'Escape') onEscape();
    });
  }

  showOffer({ media, onSkip, onAdd, onRemove, onDone, onEscape }) {
    const domain = this.root.querySelector('.light-domain');
    domain.querySelector('.rite-stage')?.remove();

    const wrap = this._el('div', 'rite-stage offer');
    wrap.append(this._el('p', 'rite-question', '把重量投进光里'));
    wrap.append(this._el('p', 'rite-tip', '照片 / 短片可选 · 就这些，也很好'));

    const list = this._el('div', 'offer-list');
    const render = () => {
      list.innerHTML = '';
      (media || []).forEach((m) => {
        const item = this._el('div', 'offer-item');
        item.textContent = m.name || m.kind;
        const rm = this._el('button', 'offer-x', '×');
        rm.addEventListener('click', () => {
          onRemove(m.id);
          media = media.filter((x) => x.id !== m.id);
          render();
        });
        item.append(rm);
        list.append(item);
      });
    };
    render();

    const pick = this._el('input');
    pick.type = 'file';
    pick.accept = 'image/*';
    pick.multiple = true;
    pick.hidden = true;
    pick.addEventListener('change', async () => {
      const files = [...(pick.files || [])].slice(0, 9);
      for (const f of files) {
        const url = await fileToDataURL(f);
        onAdd({ id: `m_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, kind: 'photo', file: url, name: f.name, addedAt: Date.now() });
        media = [...media, { id: `m_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, kind: 'photo', file: url, name: f.name, addedAt: Date.now() }];
      }
      render();
    });

    const actions = this._el('div', 'rite-actions');
    const addBtn = this._el('button', 'rite-ghost', '投献');
    const skip = this._el('button', 'rite-next', '就这些，也很好');
    addBtn.addEventListener('click', () => pick.click());
    skip.addEventListener('click', onDone);
    const esc = this._el('button', 'rite-ghost', '返回');
    esc.addEventListener('click', onEscape);
    actions.append(esc, addBtn, skip);
    wrap.append(list, pick, actions);
    domain.append(wrap);
    this._bindKey((e) => {
      if (e.key === 'Escape') onEscape();
    });
  }

  showName({ value, onConfirm, onEscape }) {
    const domain = this.root.querySelector('.light-domain');
    domain.querySelector('.rite-stage')?.remove();

    const wrap = this._el('div', 'rite-stage name');
    wrap.append(this._el('p', 'rite-question', '给它一个只有你懂的名字'));
    const input = this._el('input', 'rite-name');
    input.value = value || '';
    input.maxLength = 12;
    input.placeholder = '可留空';
    const actions = this._el('div', 'rite-actions');
    const esc = this._el('button', 'rite-ghost', '返回');
    const ok = this._el('button', 'rite-next', '凝成一颗星');
    esc.addEventListener('click', onEscape);
    ok.addEventListener('click', () => onConfirm(input.value));
    actions.append(esc, ok);
    wrap.append(input, actions);
    domain.append(wrap);
    this._bindKey((e) => {
      if (e.key === 'Enter') onConfirm(input.value);
      if (e.key === 'Escape') onEscape();
    });
    setTimeout(() => input.focus(), 50);
  }

  showConverge() {
    const domain = this.root.querySelector('.light-domain');
    domain.querySelector('.rite-stage')?.remove();
    const msg = this._el('p', 'rite-converge', '凝星中…');
    domain.append(msg);
  }

  showAfterglow() {
    const domain = this.root.querySelector('.light-domain');
    domain.querySelector('.rite-stage')?.remove();
    domain.querySelector('.rite-converge')?.remove();
    const msg = this._el('p', 'rite-after', '');
    domain.append(msg);
  }

  /** 星内态：文字星尘 */
  showStarView(star, { onClose, onLink }) {
    this.root.hidden = false;
    this.root.classList.remove('ritual-dim');
    this.root.classList.add('starview-dim');
    this.root.innerHTML = '';
    const wrap = this._el('div', 'starview');
    const layer = star.layers?.[0] || { text: '', emotion: 'warm' };
    const title = this._el('h2', 'starview-name', escapeHtml(star.name || '未命名'));
    const meta = this._el('p', 'starview-meta', visitLine(star));
    const text = this._el('div', 'starview-text');
    // 逐字浮现
    const chars = [...(layer.text || '')];
    text.innerHTML = chars
      .map((c, i) => `<span style="animation-delay:${Math.min(i * 12, 1800)}ms">${escapeHtml(c)}</span>`)
      .join('');
    const actions = this._el('div', 'starview-actions');
    const link = this._el('button', 'rite-ghost', '与另一颗星连成星座');
    const close = this._el('button', 'rite-next', '离开');
    link.addEventListener('click', () => onLink?.(star.id));
    close.addEventListener('click', () => this.closeStarView(onClose));
    actions.append(link, close);
    wrap.append(title, meta, text, actions);
    this.root.append(wrap);
    this._bindKey((e) => {
      if (e.key === 'Escape') this.closeStarView(onClose);
    });
  }

  closeStarView(onClose) {
    this.root.classList.remove('starview-dim');
    this.root.innerHTML = '';
    this.root.hidden = true;
    this._unbindKey();
    onClose?.();
  }
}

function visitLine(star) {
  if (!star.lastVisitAt) return '第一次重逢';
  const days = Math.floor((Date.now() - star.lastVisitAt) / 86400000);
  if (days <= 0) return '今天你曾来过';
  return `上次来访：${days} 天前`;
}

function escapeHtml(s) {
  return String(s)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function fileToDataURL(file) {
  return new Promise((resolve) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.readAsDataURL(file);
  });
}
