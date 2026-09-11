import { emotionHex } from './emotions.js';
import { generateStarKey, generateUniverseId, seedFromKey, generateStarName } from './starKey.js';

function hasDesktopAPI() {
  return Boolean(window.galaxyAPI?.loadMemories || window.galaxyAPI?.loadStarfield);
}

function emptyStore() {
  const now = Date.now();
  const starKey = generateStarKey(now);
  return {
    schema: 2,
    universeId: generateUniverseId(),
    starKey,
    createdAt: now,
    settings: { seed: seedFromKey(starKey), sound: true, leftAt: null },
    stars: [],
    links: [],
    draft: null,
    logs: [],
  };
}

function migrate(raw) {
  if (!raw || typeof raw !== 'object') return emptyStore();
  if (raw.schema >= 2) {
    return {
      schema: 2,
      universeId: raw.universeId || generateUniverseId(),
      starKey: raw.starKey || generateStarKey(raw.createdAt || Date.now()),
      createdAt: raw.createdAt || Date.now(),
      settings: raw.settings || { seed: Date.now() % 1e9, sound: true, leftAt: null },
      stars: Array.isArray(raw.stars) ? raw.stars : [],
      links: Array.isArray(raw.links) ? raw.links : [],
      draft: raw.draft || null,
      logs: Array.isArray(raw.logs) ? raw.logs : [],
    };
  }

  // schema 1 → 2
  const now = raw.createdAt || Date.now();
  const starKey = generateStarKey(now);
  const stars = (raw.stars || []).map((s) => {
    const emotion = 'warm';
    const text = s.text || '';
    return {
      id: s.id,
      name: s.title || generateStarName(emotion, s.createdAt || now),
      seedName: generateStarName(emotion, s.createdAt || now),
      layers: [
        {
          id: `L_${s.id}`,
          text,
          emotion,
          media: Array.isArray(s.photos)
            ? s.photos.map((p) => ({ id: p.id, kind: 'photo', file: p.url, name: p.name, addedAt: now }))
            : [],
          createdAt: s.createdAt || now,
        },
      ],
      pos: { x: s.x || 0, y: s.y || 0, z: s.z || 0 },
      color: emotionHex(emotion),
      size: s.size || 0.8,
      bornAt: s.createdAt || now,
      lastVisitAt: null,
      visitCount: 0,
      status: 'live',
      visibility: 'private',
      isMemorial: false,
      isPublic: false,
    };
  });

  return {
    schema: 2,
    universeId: generateUniverseId(),
    starKey,
    createdAt: now,
    settings: { seed: seedFromKey(starKey), sound: true, leftAt: null },
    stars,
    links: (raw.links || []).map((l) => ({ ...l, createdAt: l.createdAt || now })),
    draft: null,
    logs: [],
  };
}

export function starSizeFromLayer(layer) {
  const w = Math.min(1, (layer.text || '').length / 300) * 0.4;
  return 0.55 + w * 0.55;
}

export class StarfieldStore {
  constructor() {
    this.data = emptyStore();
  }

  async load() {
    if (window.galaxyAPI?.loadStarfield) {
      this.data = migrate(await window.galaxyAPI.loadStarfield());
      if (!this.data.starKey || !this.data.settings?.seed) {
        this.data.starKey = this.data.starKey || generateStarKey(this.data.createdAt);
        this.data.settings = {
          ...this.data.settings,
          seed: seedFromKey(this.data.starKey),
        };
      }
      return this.data;
    }

    try {
      const raw = localStorage.getItem('lodestar-starfield');
      if (raw) {
        this.data = migrate(JSON.parse(raw));
        return this.data;
      }
    } catch {
      // ignore
    }

    // try old store once
    try {
      const legacy = localStorage.getItem('memory-galaxy-store');
      if (legacy) {
        this.data = migrate(JSON.parse(legacy));
        await this.save();
        return this.data;
      }
    } catch {
      // ignore
    }

    this.data = emptyStore();
    return this.data;
  }

  async save() {
    if (window.galaxyAPI?.saveStarfield) {
      await window.galaxyAPI.saveStarfield(this.data);
    } else if (window.galaxyAPI?.saveMemories) {
      await window.galaxyAPI.saveMemories(this.data);
    } else {
      localStorage.setItem('lodestar-starfield', JSON.stringify(this.data));
    }
    return this.data;
  }

  listStars() {
    return this.data.stars.filter((s) => s.status === 'live' || s.status === 'dim');
  }

  listLinks() {
    return this.data.links;
  }

  getStar(id) {
    return this.data.stars.find((s) => s.id === id) || null;
  }

  get starKey() {
    return this.data.starKey;
  }

  get seed() {
    return this.data.settings?.seed || seedFromKey(this.data.starKey);
  }

  countLive() {
    return this.data.stars.filter((s) => s.status === 'live').length;
  }

  hasLink(a, b) {
    const key = a < b ? `${a}::${b}` : `${b}::${a}`;
    return this.data.links.some((l) => (l.a < l.b ? `${l.a}::${l.b}` : `${l.b}::${l.a}`) === key);
  }

  addLink(a, b) {
    if (!a || !b || a === b || this.hasLink(a, b)) return false;
    this.data.links.push({ a, b, createdAt: Date.now() });
    return true;
  }

  saveDraft(draft) {
    this.data.draft = draft ? { ...draft } : null;
  }

  getDraft() {
    return this.data.draft;
  }

  clearDraft() {
    this.data.draft = null;
  }

  createStar({ text, emotion, name, pos, media = [] }) {
    const now = Date.now();
    const em = emotion || 'warm';
    const layer = {
      id: `L_${now}_${Math.random().toString(36).slice(2, 6)}`,
      text: (text || '').slice(0, 300),
      emotion: em,
      media,
      createdAt: now,
    };
    const seedName = generateStarName(em, now);
    const star = {
      id: `star_${now}_${Math.random().toString(36).slice(2, 8)}`,
      name: (name || '').trim().slice(0, 12) || seedName,
      seedName,
      layers: [layer],
      pos: {
        x: pos?.x ?? 0,
        y: pos?.y ?? 0,
        z: pos?.z ?? 0,
      },
      color: emotionHex(em),
      size: starSizeFromLayer(layer),
      bornAt: now,
      lastVisitAt: null,
      visitCount: 0,
      status: 'live',
      visibility: 'private',
      isMemorial: em === 'eternal',
      isPublic: false,
    };
    this.data.stars.push(star);
    return star;
  }

  visitStar(id) {
    const star = this.getStar(id);
    if (!star) return null;
    star.lastVisitAt = Date.now();
    star.visitCount = (star.visitCount || 0) + 1;
    return star;
  }

  removeStar(id) {
    this.data.stars = this.data.stars.filter((s) => s.id !== id);
    this.data.links = this.data.links.filter((l) => l.a !== id && l.b !== id);
  }

  log(event, props) {
    this.data.logs.push({ e: event, t: Date.now(), p: props });
    if (this.data.logs.length > 5000) this.data.logs = this.data.logs.slice(-4000);
  }

  replaceAllStars(stars) {
    // keep live user stars; used only for demo seed if needed
    const user = this.data.stars.filter((s) => !s.id.startsWith('demo-'));
    this.data.stars = [...user, ...stars];
  }
}
