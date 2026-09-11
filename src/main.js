import { GalaxyScene } from './galaxy.js';
import { StarfieldStore } from './store.js';
import { StoreRitual } from './ritual.js';
import { RitualUI } from './ritual-ui.js';

const canvas = document.querySelector('#galaxy-canvas');
const opening = document.querySelector('#opening');
const metaLabel = document.querySelector('#meta-label');
const whisper = document.querySelector('#whisper');
const btnRing = document.querySelector('#btn-ring');
const ringMenu = document.querySelector('#ring-menu');
const findBar = document.querySelector('#find-bar');
const findInput = document.querySelector('#find-input');
const findGo = document.querySelector('#find-go');
const findClose = document.querySelector('#find-close');
const keyPanel = document.querySelector('#key-panel');
const keyValue = document.querySelector('#key-value');
const keyClose = document.querySelector('#key-close');
const hoverName = document.querySelector('#hover-name');
const ritualRoot = document.querySelector('#ritual-root');

const store = new StarfieldStore();
const ui = new RitualUI(ritualRoot);

let linkSourceId = null;
let starViewOpen = false;
let ritual = null;

function showWhisper(text, ms = 2600) {
  whisper.textContent = text;
  whisper.classList.add('show');
  clearTimeout(showWhisper._t);
  showWhisper._t = setTimeout(() => whisper.classList.remove('show'), ms);
}

function updateMeta() {
  const n = store.countLive();
  metaLabel.textContent = `你的星野 · ${n} 颗宿星`;
}

function refreshGalaxy() {
  galaxy.setMemoryStars(store.listStars());
  galaxy.setConstellationLinks(store.listLinks());
  updateMeta();
}

const galaxy = new GalaxyScene(canvas, {
  onStarClick: async (id, meta = {}) => {
    if (ritual?.busy) return;
    const star = store.getStar(id);
    if (!star) return;

    if (meta.shiftKey) {
      if (!linkSourceId) {
        linkSourceId = id;
        showWhisper('已选中起点，再 Shift+点击另一颗星');
        return;
      }
      if (linkSourceId === id) {
        linkSourceId = null;
        showWhisper('已取消');
        return;
      }
      if (store.hasLink(linkSourceId, id)) {
        linkSourceId = null;
        showWhisper('这两颗星已经连过了');
        return;
      }
      store.addLink(linkSourceId, id);
      store.log('link_add', {});
      await store.save();
      galaxy.setConstellationLinks(store.listLinks());
      linkSourceId = null;
      showWhisper('已连成星座');
      return;
    }

    // 星内态
    store.visitStar(id);
    await store.save();
    store.log('star_visit', { visitCount: store.getStar(id)?.visitCount });
    galaxy.focusStar(id);
    starViewOpen = true;
    ui.showStarView(store.getStar(id), {
      onClose: () => {
        starViewOpen = false;
      },
      onLink: () => {
        linkSourceId = id;
        starViewOpen = false;
        ui.closeStarView();
        showWhisper('再 Shift+点击另一颗星，连成星座');
      },
    });
  },
  onEmptyClick: (pos) => {
    if (ritual?.busy || starViewOpen) return;
    ritual.start(pos);
  },
  onEmptyDoubleClick: () => {},
});

ritual = new StoreRitual({
  store,
  galaxy,
  ui,
  onHint: showWhisper,
});

// ——— 环形操作 ———
btnRing.addEventListener('click', () => {
  ringMenu.hidden = !ringMenu.hidden;
});

ringMenu.addEventListener('click', async (e) => {
  const btn = e.target.closest('button[data-act]');
  if (!btn) return;
  const act = btn.dataset.act;
  ringMenu.hidden = true;

  if (act === 'store') {
    if (!ritual.busy) ritual.start(galaxy.createStarPosition());
    return;
  }
  if (act === 'find') {
    findBar.hidden = false;
    findInput.focus();
    return;
  }
  if (act === 'key') {
    keyValue.textContent = store.starKey;
    keyPanel.hidden = false;
  }
});

findGo.addEventListener('click', () => doFind());
findInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') doFind();
});
findClose.addEventListener('click', () => {
  findBar.hidden = true;
});
keyClose.addEventListener('click', () => {
  keyPanel.hidden = true;
});

function doFind() {
  const q = findInput.value.trim();
  if (!q) return;
  store.log('find_by_name', { q });
  const hit = galaxy.findStarByName(q);
  if (hit) {
    store.log('find_by_name', { hit: true });
    showWhisper(`飞往「${hit.name}」`);
  } else {
    store.log('find_by_name', { hit: false });
    showWhisper('星野里还没有这个名字');
  }
}

// 悬停星名
canvas.addEventListener('pointermove', (e) => {
  const id = galaxy.hovered;
  if (!id || ritual?.busy) {
    hoverName.hidden = true;
    return;
  }
  const star = store.getStar(id);
  if (!star) {
    hoverName.hidden = true;
    return;
  }
  hoverName.hidden = false;
  hoverName.textContent = star.name || '';
  hoverName.style.left = `${e.clientX}px`;
  hoverName.style.top = `${e.clientY}px`;
});

// ——— 离开渐隐 ———
let idleTimer = null;
function armIdle() {
  clearTimeout(idleTimer);
  idleTimer = setTimeout(async () => {
    if (ritual?.busy) return armIdle();
    store.log('idle_fade', {});
    showWhisper('宇宙会替你守着。', 4000);
    canvas.style.transition = 'filter 4s ease';
    canvas.style.filter = 'brightness(0.25)';
    setTimeout(() => {
      canvas.style.filter = 'brightness(1)';
      armIdle();
    }, 12000);
  }, 300000);
}
['pointerdown', 'keydown', 'wheel'].forEach((ev) => {
  window.addEventListener(ev, () => {
    canvas.style.filter = 'brightness(1)';
    armIdle();
  });
});

async function bootstrap() {
  await store.load();
  refreshGalaxy();
  store.log('app_open', { isNew: store.countLive() === 0 });

  // 开场引语 3s
  setTimeout(() => opening.classList.add('hide'), 2800);
  setTimeout(() => {
    opening.hidden = true;
  }, 4200);

  armIdle();
  window.__lodestar = { store, galaxy, ritual, ui };
}

bootstrap();
