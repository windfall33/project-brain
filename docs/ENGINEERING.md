# 《宿星 · 工程附录》

**版本**：v1.0  
**日期**：2026-09-11  
**对齐**：《宿星 · 产品设计白皮书》v1.0  
**用途**：开发唯一技术对照；与产品文案冲突时，产品文档优先，本附录负责把文案落成可实现的状态与结构。

---

## 0. 范围

| 阶段 | 本附录覆盖 |
|------|------------|
| P1 | 数据模型、七步存星状态机、星钥、寻星·呼唤、离开渐隐、降级矩阵、埋点 |
| P2+ | 仅给扩展位（添光/并野/星海），不展开实现 |

技术基线：**Electron + Three.js + 本地 JSON/文件**；无后端。浏览器预览可用同一渲染层 + localStorage 回退。

---

## 1. 数据模型

### 1.1 存储位置

| 环境 | 根目录 | 主文件 | 媒体 |
|------|--------|--------|------|
| Electron | `%APPDATA%/lodestar/starfield/` | `starfield.json` | `assets/` |
| 浏览器预览 | `localStorage['lodestar-starfield']` | 同一 JSON 结构 | DataURL（仅 Demo） |

### 1.2 根对象

```json
{
  "schema": 2,
  "universeId": "uf_...",
  "starKey": "猎户座-泪滴-7749",
  "createdAt": 1789050000000,
  "settings": {
    "seed": 123456,
    "sound": true,
    "leftAt": null
  },
  "stars": [],
  "links": [],
  "draft": null
}
```

### 1.3 宿星 `Star`

```ts
type EmotionKey = 'warm' | 'miss' | 'blaze' | 'joy' | 'calm' | 'dim' | 'eternal';

type MediaItem = {
  id: string;
  kind: 'photo' | 'video' | 'audio';
  file: string;      // assets 相对路径或 blob URL
  name: string;
  addedAt: number;
};

type RiteLayer = {
  // 「添光」一层 = 一圈年轮；主记忆为 layer 0
  id: string;
  text: string;              // ≤300 字
  emotion: EmotionKey;
  media: MediaItem[];        // photo≤9, video≤1s, audio≤60s
  createdAt: number;
  coAuthors?: string[];      // 悼念场景多人署名
};

type Star = {
  id: string;                // star_...
  name: string;              // ≤12 字；空则系统生成
  seedName?: string;         // 系统生成原名
  layers: RiteLayer[];       // [0] 主记忆不可改；后续为添光
  pos: { x: number; y: number; z: number };
  color: string;             // 由 emotion 决定，存 hex 便于渲染
  size: number;              // 由内容重量映射（字数/媒体）
  bornAt: number;
  lastVisitAt: number | null;
  visitCount: number;
  status: 'draft' | 'live' | 'dim';  // dim = 离开者灰光
  visibility: 'private' | 'shared';  // 并野后 shared
  isMemorial: boolean;       // 悼念
  isPublic: false;           // P3 人间星海扩展
};
```

**约束（代码强制）**

| 字段 | 规则 |
|------|------|
| `layers[0]` | 创建后只读；删除星才消失 |
| `layers[n>0]` | 与上一层间隔 `≥ 1h` |
| `text` | `trim` 后长度 ≤ 300 |
| `name` | ≤ 12；空则 `generateStarName(emotion, bornAt)` |
| `media` | photo≤9 / video≤30s / audio≤60s / 单次添光合计可裁 |
| `pos` | 由 `seed + id` 确定性生成，禁止随机覆盖 |

### 1.4 七色光谱（常量表）

```ts
const EMOTIONS: Record<EmotionKey, {
  hex: string;          // 主色
  hexDim: string;       // 灰光/悼念
  line: string;         // 一句微文案
  tone: number;         // 音高 MIDI 或频率系数
}> = {
  warm:     { hex: '#E8C27A', hexDim: '#9A8B6E', line: '有人爱我，或我爱着谁',   tone: 57 },
  miss:     { hex: '#7EB6D9', hexDim: '#5E7382', line: '回不去的地方，忘不掉的人', tone: 53 },
  blaze:    { hex: '#E07070', hexDim: '#8F5A5A', line: '我燃烧过，哪怕没人看见', tone: 64 },
  joy:      { hex: '#E8A34A', hexDim: '#91734A', line: '那一天，笑到肚子疼',     tone: 67 },
  calm:     { hex: '#E8E6E0', hexDim: '#9A9894', line: '什么都不发生，也很好',   tone: 60 },
  dim:      { hex: '#9B8AAE', hexDim: '#6A5F74', line: '有些重量，说出来轻一点', tone: 50 },
  eternal:  { hex: '#C8CED8', hexDim: '#8A8E98', line: '你不在的时间，光还在',   tone: 48 },
};
```

「恒」(`eternal`) 在 UI 光谱末端隔开；`isMemorial === (emotion === 'eternal')`。

### 1.5 星钥 `starKey`

```
格式：{星座}-{意象}-{四位数字}
例：  猎户座-泪滴-7749
```

```ts
const CONSTELLATIONS = ['猎户座', '天琴座', '天鹅座', '天鹰座', '仙女座', '英仙座', '南十字', '北极星'];
const IMAGES = ['泪滴', '琥珀', '羽絮', '潮汐', '余烬', '薄雪', '灯塔', '长夜', '初吻', '归舟'];

function generateStarKey(seed: number): string {
  const a = CONSTELLATIONS[seed % CONSTELLATIONS.length];
  const b = IMAGES[Math.floor(seed / 7) % IMAGES.length];
  const n = String((seed % 10000)).padStart(4, '0');
  return `${a}-${b}-${n}`;
}
```

- 同时作为 **星野程序种子**（背景星、装饰星布局确定性生成）  
- P1 仅展示与本地绑定；P2 云端兑现  
- 文案：「抄下它，写在纸上也可以。」

### 1.6 星座连线 `Link`（P1 仅数据，UI 可实验）

```ts
type Link = { a: string; b: string; createdAt: number; name?: string };
```

### 1.7 草稿 `draft`（书写中退出）

```ts
type Draft = {
  text: string;
  emotion: EmotionKey | null;
  media: MediaItem[];
  name: string;
  startedAt: number;
};
```

异常：恢复草稿时星位显示「未凝之星」微光（`status: 'draft'` 的占位 Star，无 layers 或 layers 仅本地）。

### 1.8 大小与重量映射

```ts
function starSize(layer0: RiteLayer): number {
  const w = Math.min(1, layer0.text.length / 300) * 0.4
          + Math.min(1, layer0.media.length / 9) * 0.6;
  return 0.55 + w * 0.55;  // 场景单位
}
```

---

## 2. 七步存星仪式 · 状态机

### 2.1 状态定义

```
Idle
  → Trigger（点空位 / 环形「存星」）
  → Write
  → Color
  → Offer（投献，可跳过）
  → Name
  → Converge（凝星，锁定输入）
  → Afterglow
  → Idle

旁路：
  Write|Color|Offer|Name --退出--> DraftSaved → Idle
  Write --30字余量变金-->（仅视觉，不改状态）
  Converge --完成--> Afterglow
```

### 2.2 状态表

| 状态 | 进入动作 | 允许输入 | 退出条件 | 锁 UI |
|------|----------|----------|----------|-------|
| `Idle` | 默认零 UI | 轨道相机、hover 记忆星 | 点空位/存星 | 否 |
| `Trigger` | 全屏压暗 40%，中心光域渐显 800ms | 无 | 动画完成 → Write | 是 |
| `Write` | 文字暖白逐字浮现；余量=光域光点 | 键入、退格、Esc→存草稿 | 提交（≥1 字且 ≤300）→ Color | 相机锁 |
| `Color` | 七色球环绕文字；hover 全场色温 800ms | 选 1 色 | 点选 → Offer | 是 |
| `Offer` | 媒体可拖入「光球」；「就这些，也很好」 | 添加/跳过 | 确认 → Name | 是 |
| `Name` | 单行；可空 | 输入 ≤12 | 确认/回车 → Converge | 是 |
| `Converge` | 5s 不可交互；粒子上升凝聚飞向 `pos` | 无 | 动画结束 → Afterglow | 是 |
| `Afterglow` | 镜头缓拉 3s；无按钮无 Toast | 无 | 结束 → Idle；写 `lastVisitAt` | 否 |

### 2.3 伪代码

```ts
type RitualStep =
  | 'idle' | 'trigger' | 'write' | 'color'
  | 'offer' | 'name' | 'converge' | 'afterglow';

class StoreRitual {
  step: RitualStep = 'idle';
  draft: Draft;
  targetPos: Vec3;

  enterTrigger(pos: Vec3) {
    this.targetPos = pos;
    this.draft = { text: '', emotion: null, media: [], name: '', startedAt: Date.now() };
    ui.fadeUniverse(0.6);           // 压暗
    ui.showLightDomain(800);
    this.step = 'trigger';
    after(800, () => this.enterWrite());
  }

  enterWrite() {
    this.step = 'write';
    ui.bindText({
      max: 300,
      onInput: (t) => {
        this.draft.text = t;
        ui.updateLightPoints(300 - t.length, goldWhen: 30);
      },
      onSubmit: (t) => {
        if (t.trim().length === 0) return;
        this.enterColor();
      },
    });
  }

  enterColor() {
    this.step = 'color';
    ui.showOrbitEmotions(EMOTIONS, {
      onHover: (k) => ui.nightTemperature(k, 800),
      onPick: (k) => { this.draft.emotion = k; this.enterOffer(); },
    });
  }

  enterOffer() {
    this.step = 'offer';
    ui.showOffer({
      limits: { photo: 9, videoSec: 30, audioSec: 60 },
      onDone: () => this.enterName(),
    });
  }

  enterName() {
    this.step = 'name';
    ui.showName({
      max: 12,
      placeholder: '给它一个只有你懂的名字',
      onConfirm: (n) => {
        this.draft.name = n.trim();
        this.enterConverge();
      },
    });
  }

  async enterConverge() {
    this.step = 'converge';
    ui.lockAll();
    const star = buildStar(this.draft, this.targetPos);
    await fx.convergeToStar(star, 5000);  // 粒子凝聚 + 定音
    store.save(star);
    this.enterAfterglow(star);
  }

  enterAfterglow(star: Star) {
    this.step = 'afterglow';
    ui.restoreUniverse(3000);
    camera.pullBack(3000);
    after(3000, () => {
      this.step = 'idle';
      ui.zeroUI();
    });
  }

  abortToDraft() {
    if (['write','color','offer','name'].includes(this.step)) {
      store.saveDraft(this.draft);
      // 星位留「未凝之星」
      fx.leaveUnformed(this.targetPos);
      this.step = 'idle';
    }
  }
}
```

### 2.4 悼念分支（P3，结构预留）

- `emotion === 'eternal'`：凝星改为 **先沉降后升起**（1.2× 时长）  
- 关闭欢快音色，只用低音定音  
- UI 无「分享 / 邀请 / 再存一颗」引导  

### 2.5 异常文案映射

| 事件 | 产品文案 | 工程动作 |
|------|----------|----------|
| 保存成功 | （不说话，星亮起） | 无 Toast |
| 网络错误 | 星光暂时抵达不了你 | P1 仅本地，几乎不触发 |
| 上传失败 | 这段记忆太沉了，轻一点再试 | 重试/移除媒体 |
| 字数到限 | 光点耗尽（视觉） | 禁止继续输入 |
| 书写中退出 | — | `draft` 落盘 |

---

## 3. 相机与接近逻辑

### 3.1 呼呼唤寻星

```
input name
  → filter stars (name / seedName)
  → camera.flyTo(star.pos, 2800ms, expo)
  → 到达前 600ms：envColor.tempShift(star.color)
  → hover：1 行星名，无卡片
```

### 3.2 循色 / 溯时（P1 可砍，接口留）

```ts
find.byEmotion(key): flashMatching(1200)  // 同色脉动
find.byTime(range): revealByCreatedAt(range)
```

### 3.3 接近感知

```ts
onApproach(starId, distance) {
  if (distance < approachRadius) {
    audio.crossfade(star.emotion, 1.5);
    ui.warmIfNear(star.color, 0.25);
  }
}
```

---

## 4. 声音 v0

| 层 | 实现 | 规格 |
|----|------|------|
| 底噪 | 循环低频噪声 + 缓慢 LFO | -28dB，常驻可关 |
| 凝星定音 | 正弦 + 泛音，1.8s 尾音 | 按 `emotion.tone` |
| 七音色 | 短 blip，hover 不播放 | 仅进入星内态一次 |

禁止 UI 点击声。P1 可先只做底噪 + 定音。

---

## 5. 离开渐隐

```
idleTimer 5min
  → t=0    暗场 4s，镜头后拉
  → t=4s   文案「宇宙会替你守着。」
  → t=12s  渐隐
  → t=30s  全黑；星钥微光呼吸
  → 任意输入 → 恢复星野
```

实现：`scheduleIdle(300000)`；`settings.leftAt` 仅诊断用，不强制登出。

---

## 6. 渲染与降级矩阵

### 6.1 质量档

| 档 | 目标机 | 粒子 | 体积雾 | 分辨率 | DPR | 目标 FPS |
|----|--------|------|--------|--------|-----|----------|
| L0 Ultra | 桌面独显 | 120k | 高 | 1.0 | ≤2 | 60 |
| L1 High | 桌面核显 | 60k | 中 | 0.9 | ≤1.5 | 60 |
| L2 Mid | 高端手机 | 30k | 低 | 0.8 | ≤2 | 30–45 |
| L3 Low | 中端手机 | 15k | 关 | 0.7 | 1 | 30 |
| L4 Safe | 老设备 | 8k | 关 | 0.6 | 1 | 24+ |

### 6.2 启动探测（简版）

```ts
function pickQuality(): Quality {
  const dpr = window.devicePixelRatio || 1;
  const mobile = /Android|iPhone|iPad/i.test(navigator.userAgent);
  const cores = navigator.hardwareConcurrency || 4;
  if (!mobile && cores >= 8) return 'L0';
  if (!mobile) return 'L1';
  if (cores >= 6) return 'L2';
  if (cores >= 4) return 'L3';
  return 'L4';
}
```

### 6.3 运行时降级（防掉帧）

| 条件 | 动作 |
|------|------|
| 连续 2s FPS < 目标*0.8 | 降一档粒子/雾 |
| FPS 恢复 > 目标*0.95 持续 10s | 最多回升一档（L0 不回升） |
| `prefers-reduced-motion` | 关自动旋转、缩短凝星、减粒子 50% |
| WebGL 失败 | 2D 星点海报 + 纯 DOM 仪式流 |

### 6.4 P1 视觉底线（可验收）

- 首屏 **≤3s** 出现可交互星野（工程：并行加载 JS + 粒子缓冲）  
- 桌面 L0/L1：**60fps** 空闲漫游  
- 凝星 5s 期间 **不掉到 30fps 以下**（粒子与主星池分离）  

---

## 7. 埋点（P1 北极星 + 仪式漏斗）

原则：**无第三方追踪**；本地环形日志 + 可选导出。字段极简。

### 7.1 事件表

| event | 何时 | props |
|-------|------|-------|
| `app_open` | 启动 | `quality`, `isNew` |
| `first_star_born` | 第一颗 star live | `emotion`, `textLen`, `hasMedia` |
| `ritual_step` | 每步进入 | `step`, `starId?`, `ts` |
| `ritual_abort` | 存草稿退出 | `step` |
| `ritual_complete` | afterglow 结束 | `durationMs`, `emotion` |
| `second_star_intent` | 第二次进 Write | — |
| `second_star_born` | 第二颗 live | — |
| `find_by_name` | 呼唤成功/失败 | `hit` |
| `star_visit` | 进入星内态 | `daysSince`, `visitCount` |
| `link_add` | Shift 连星 | — |
| `idle_fade` | 离开渐隐触发 | — |
| `quality_drop` | 运行时降档 | `from`, `to`, `fps` |

### 7.2 北极星指标

| 指标 | 定义 | P1 目标 |
|------|------|---------|
| **NS2（存第二颗）** | 首颗后 7 日内 `second_star_born` / `first_star_born` | ≥ 35%（假设，待测） |
| 仪式完成率 | `ritual_complete` / 首次进入 `write` | ≥ 70% |
| 首颗耗时 | trigger→afterglow | 中位 3–6 分钟 |
| 无声传播 | （定性）是否有人主动截图/录屏 | 10 人测 ≥3 人 |

### 7.3 日志结构

```ts
type LogEvent = { e: string; t: number; p?: Record<string, unknown> };
// 持久化：starfield/logs.jsonl，环形 cap 5000 条
```

---

## 8. 模块边界（Electron）

```
electron/
  main.cjs          # 窗口、IPC、userData 路径
  preload.cjs       # contextBridge: starfield.*
src/
  main.js           # 应用编排
  galaxy.js         # Three 场景、粒子、相机、射线
  ritual.js         # 七步状态机（纯逻辑，可测）
  store.js          # 读写 starfield.json + draft
  starKey.js        # 星钥与 seed
  emotions.js       # 七色常量
  audio.js          # 底噪/定音
  quality.js        # 档位与降级
  ui/               # 光域/环形操作/文字浮现（DOM/WebGL 混合）
```

**IPC 面（最小）**

| channel | 方向 | payload |
|---------|------|---------|
| `store.load` | R→M | — |
| `store.save` | R→M | `Starfield` |
| `store.exportKeyPack` | R→M | 导出 zip/json 星钥包 |
| `app.quality` | M→R | 启动档位 |

---

## 9. 错误与文案路由

```ts
function uiError(code: string): string {
  const map = {
    NET: '星光暂时抵达不了你',
    MEDIA_HEAVY: '这段记忆太沉了，轻一点再试',
    STORAGE_FULL: '宇宙装不下了，先熄灭一些光',
    UNKNOWN: '星光暂时抵达不了你',
  };
  return map[code] || map.UNKNOWN;
}
```

禁止：`保存成功` / `上传中` / `请稍候` / 任何 Toast 确认条。

---

## 10. P1 验收清单（工程）

- [ ] 首屏 3s 内可见可转星野（目标机）  
- [ ] 七步全部可走通，中途 Esc/关窗 → 草稿可恢复  
- [ ] 文字 300、名 12、余量 30 变金  
- [ ] 凝星 5s 锁输入 + 定音  
- [ ] 星钥生成且决定背景 seed  
- [ ] 呼唤：命中飞星、未命中低声文案  
- [ ] 星内态：文字星尘 +「N 天前」  
- [ ] 离开渐隐 5min 可触发、可唤醒  
- [ ] 埋点落盘且 NS2 可算  
- [ ] L1 桌面 60fps；L3 可跑 30fps  
- [ ] 无英文 UI、无粗黑体、无卡片式面板  

---

## 11. 与现有 Memory Galaxy 代码映射

| 白皮书概念 | 现有实现 | P1 改造 |
|------------|----------|---------|
| 星野 | `GalaxyScene` 粒子场 | 保留渲染；seed 改星钥 |
| 宿星 | `setMemoryStars` + 本地 stars | 改 `layers` 模型 + 七色 |
| 私有星座 | `links` + Shift | 数据层保留；UI 延后 |
| 存星 | 右侧面板表单 | 重做为 `ritual.js` 七步 |
| 星钥 | 无 | 新增生成 + 展示演出 |
| 添光 | 无 | P3；模型已留 `layers[]` |
| 人间星海 | 无 | 不做 |

---

## 12. 待产品确认（阻塞项）

1. P1 是否必须含**声音**？若必须，只做底噪+定音是否接受？  
2. 星钥**是否需要可恢复文件**（导出）在 P1？建议要。  
3. 「未凝之星」草稿保留 **多少天**？建议 30 天后熄灭微光。  
4. NS2 35% 是否作为 P1 **硬门槛**还是观察项？  

---

*附录结束。实现时以 §2 状态机与 §1 模型为源；文案以白皮书第六章为准。*
