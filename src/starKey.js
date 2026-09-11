const CONSTELLATIONS = ['猎户座', '天琴座', '天鹅座', '天鹰座', '仙女座', '英仙座', '南十字', '北极星'];
const IMAGES = ['泪滴', '琥珀', '羽絮', '潮汐', '余烬', '薄雪', '灯塔', '长夜', '初吻', '归舟'];

export function seedFromKey(starKey) {
  let h = 2166136261;
  const s = String(starKey || '');
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function generateStarKey(seed = Date.now()) {
  const a = CONSTELLATIONS[seed % CONSTELLATIONS.length];
  const b = IMAGES[Math.floor(seed / 7) % IMAGES.length];
  const n = String(seed % 10000).padStart(4, '0');
  return `${a}-${b}-${n}`;
}

export function generateUniverseId() {
  return `uf_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/** 系统生成宿星名：情绪·年·季节/时分 */
export function generateStarName(emotion, bornAt = Date.now()) {
  const d = new Date(bornAt);
  const season = ['冬', '春', '夏', '秋'][Math.floor(((d.getMonth() + 1) % 12) / 3)];
  const labels = {
    warm: '暖',
    miss: '念',
    blaze: '炽',
    joy: '欢',
    calm: '静',
    dim: '黯',
    eternal: '恒',
  };
  const label = labels[emotion] || '星';
  return `${label}·${d.getFullYear()}·${season}`;
}

export { CONSTELLATIONS, IMAGES };
