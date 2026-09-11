# 宿星 · Lodestar Memory

把重要的记忆封存成一颗会发光的星。Electron + Three.js 桌面应用。

## 你自己怎么打开（推荐）

### 方式一：双击（最省事）

在项目文件夹 `D:\mimo project` 里双击：

**`启动宿星.bat`**

脚本会自动：检查依赖 → 起 Vite（若未运行）→ 打开桌面窗口。

### 方式二：PowerShell

```powershell
cd "D:\mimo project"
.\启动宿星.ps1
```

若提示执行策略，可：

```powershell
powershell -ExecutionPolicy Bypass -File "D:\mimo project\启动宿星.ps1"
```

### 方式三：npm

```powershell
cd "D:\mimo project"
npm run app
```

仅浏览器预览（无本地文件 API）：

```powershell
npm run dev
# 打开 http://127.0.0.1:5173
```

## 首次安装依赖

只需一次：

```powershell
cd "D:\mimo project"
npm install
```

若 Electron 下载失败，再执行：

```powershell
node node_modules\electron\install.js
```

## 怎么玩

1. 等开场引语（约 3 秒）
2. **双击星野空白**，或点右下光点 →「存星」
3. 七步：书写 → 选七色 → 可选投献 → 命名 → 凝星
4. 点击宿星重逢；Shift+点击两颗星可连星座
5. 右下光点：存星 / 寻星 / 星钥

## 数据在哪

| 环境 | 路径 |
|------|------|
| 桌面 | `%APPDATA%\lodestar\starfield\starfield.json` |
| 浏览器 | `localStorage` 的 `lodestar-starfield` |

## 常见问题

| 现象 | 处理 |
|------|------|
| 双击 bat 闪退 | 在项目目录打开 PowerShell，看 `vite.log` / 报错 |
| 端口 5173 被占 | 关掉旧 Vite/其它服务，或改 `vite.config.js` 端口后再改 `启动宿星.bat` |
| 窗口开了但一片黑 | 等开场 3 秒；仍黑则看 DevTools（开发模式会开） |
| 依赖没了 | `npm install` |

## 工程文档

- 产品：见对话中的《宿星 · 产品设计白皮书》
- 技术：`docs/ENGINEERING.md`
