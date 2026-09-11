export const EMOTION_ORDER = ['warm', 'miss', 'blaze', 'joy', 'calm', 'dim', 'eternal'];

export const EMOTIONS = {
  warm: {
    hex: '#E8C27A',
    hexDim: '#9A8B6E',
    line: '有人爱我，或我爱着谁',
    tone: 220,
  },
  miss: {
    hex: '#7EB6D9',
    hexDim: '#5E7382',
    line: '回不去的地方，忘不掉的人',
    tone: 196,
  },
  blaze: {
    hex: '#E07070',
    hexDim: '#8F5A5A',
    line: '我燃烧过，哪怕没人看见',
    tone: 262,
  },
  joy: {
    hex: '#E8A34A',
    hexDim: '#91734A',
    line: '那一天，笑到肚子疼',
    tone: 294,
  },
  calm: {
    hex: '#E8E6E0',
    hexDim: '#9A9894',
    line: '什么都不发生，也很好',
    tone: 247,
  },
  dim: {
    hex: '#9B8AAE',
    hexDim: '#6A5F74',
    line: '有些重量，说出来轻一点',
    tone: 175,
  },
  eternal: {
    hex: '#C8CED8',
    hexDim: '#8A8E98',
    line: '你不在的时间，光还在',
    tone: 165,
  },
};

export function emotionHex(key, dim = false) {
  const e = EMOTIONS[key] || EMOTIONS.calm;
  return dim ? e.hexDim : e.hex;
}

export function emotionLine(key) {
  return (EMOTIONS[key] || EMOTIONS.calm).line;
}

export function isMemorial(key) {
  return key === 'eternal';
}
