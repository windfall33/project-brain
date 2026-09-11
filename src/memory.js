const EMPTY_STORE = {
  version: 1,
  stars: [],
  links: [],
  createdAt: Date.now(),
};

function hasDesktopAPI() {
  return Boolean(window.galaxyAPI?.loadMemories);
}

function normalizeStore(raw) {
  return {
    version: raw.version || 1,
    stars: Array.isArray(raw.stars) ? raw.stars : [],
    links: Array.isArray(raw.links) ? raw.links : [],
    createdAt: raw.createdAt || Date.now(),
  };
}

export class MemoryStore {
  constructor() {
    this.data = structuredClone(EMPTY_STORE);
    this.dirty = false;
  }

  async load() {
    if (hasDesktopAPI()) {
      const data = await window.galaxyAPI.loadMemories();
      this.data = normalizeStore(data);
      return this.data;
    }

    try {
      const raw = localStorage.getItem('memory-galaxy-store');
      if (raw) {
        this.data = normalizeStore(JSON.parse(raw));
        return this.data;
      }
    } catch {
      // ignore corrupt local cache
    }

    this.data = structuredClone(EMPTY_STORE);
    return this.data;
  }

  async save() {
    if (hasDesktopAPI()) {
      await window.galaxyAPI.saveMemories(this.data);
    } else {
      localStorage.setItem('memory-galaxy-store', JSON.stringify(this.data));
    }
    this.dirty = false;
    return this.data;
  }

  listStars() {
    return this.data.stars;
  }

  listLinks() {
    return this.data.links;
  }

  getStar(id) {
    return this.data.stars.find((s) => s.id === id) || null;
  }

  linkKey(a, b) {
    return a < b ? `${a}::${b}` : `${b}::${a}`;
  }

  hasLink(a, b) {
    const key = this.linkKey(a, b);
    return this.data.links.some((l) => this.linkKey(l.a, l.b) === key);
  }

  addLink(a, b) {
    if (!a || !b || a === b) return false;
    if (this.hasLink(a, b)) return false;
    this.data.links.push({ a, b });
    this.dirty = true;
    return true;
  }

  removeLinksForStar(id) {
    const before = this.data.links.length;
    this.data.links = this.data.links.filter((l) => l.a !== id && l.b !== id);
    if (this.data.links.length !== before) this.dirty = true;
  }

  upsertStar(star) {
    const idx = this.data.stars.findIndex((s) => s.id === star.id);
    const next = {
      ...star,
      updatedAt: Date.now(),
      createdAt: star.createdAt || Date.now(),
    };
    if (idx >= 0) this.data.stars[idx] = next;
    else this.data.stars.push(next);
    this.dirty = true;
    return next;
  }

  removeStar(id) {
    const before = this.data.stars.length;
    this.data.stars = this.data.stars.filter((s) => s.id !== id);
    if (this.data.stars.length !== before) this.dirty = true;
    this.removeLinksForStar(id);
  }

  replaceAll(stars) {
    this.data.stars = stars.map((s) => ({ ...s }));
    this.dirty = true;
  }

  createDraft(partial = {}) {
    return {
      id: `star-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      title: '',
      text: '',
      photos: [],
      video: null,
      createdAt: Date.now(),
      ...partial,
    };
  }
}

export async function importPhotos(files) {
  if (!files?.length) return [];

  if (hasDesktopAPI()) {
    const out = [];
    for (const file of files) {
      const arrayBuffer = await file.arrayBuffer();
      const result = await window.galaxyAPI.importImage({
        arrayBuffer,
        fileName: file.name || 'photo.jpg',
      });
      if (result.ok) {
        out.push({ id: result.id, url: result.url, name: file.name || 'photo' });
      }
    }
    return out;
  }

  return Promise.all(
    files.map(
      (file) =>
        new Promise((resolve) => {
          const reader = new FileReader();
          reader.onload = () =>
            resolve({
              id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
              url: reader.result,
              name: file.name || 'photo',
            });
          reader.readAsDataURL(file);
        }),
    ),
  );
}
