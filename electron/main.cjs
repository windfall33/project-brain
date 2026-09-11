const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const { pathToFileURL } = require('node:url');

const isDev = process.argv.includes('--dev') || !app.isPackaged;
let mainWindow = null;

function userDataRoot() {
  return path.join(app.getPath('userData'), 'lodestar', 'starfield');
}

function memoriesPath() {
  return path.join(userDataRoot(), 'starfield.json');
}

function assetsDir() {
  return path.join(userDataRoot(), 'assets');
}

function ensureStorage() {
  const root = userDataRoot();
  const assets = assetsDir();
  if (!fs.existsSync(root)) fs.mkdirSync(root, { recursive: true });
  if (!fs.existsSync(assets)) fs.mkdirSync(assets, { recursive: true });
  const file = memoriesPath();
  if (!fs.existsSync(file)) {
    fs.writeFileSync(file, JSON.stringify({
      schema: 2,
      universeId: `uf_${Date.now().toString(36)}`,
      starKey: '',
      createdAt: Date.now(),
      settings: { seed: Date.now() % 1e9, sound: true, leftAt: null },
      stars: [],
      links: [],
      draft: null,
      logs: [],
    }, null, 2), 'utf8');
  }
}

function readMemories() {
  ensureStorage();
  const raw = fs.readFileSync(memoriesPath(), 'utf8');
  return JSON.parse(raw);
}

function writeMemories(data) {
  ensureStorage();
  fs.writeFileSync(memoriesPath(), JSON.stringify(data, null, 2), 'utf8');
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1600,
    height: 1000,
    minWidth: 960,
    minHeight: 600,
    title: '宿星',
    backgroundColor: '#050510',
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  mainWindow.setMenuBarVisibility(false);
  mainWindow.maximize();

  mainWindow.once('ready-to-show', () => mainWindow.show());

  mainWindow.webContents.on('console-message', (_event, level, message, line, sourceId) => {
    if (isDev) console.log(`[renderer:${level}] ${message} (${sourceId}:${line})`);
  });

  if (isDev) {
    mainWindow.loadURL('http://127.0.0.1:5173');
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function registerIpc() {
  ipcMain.handle('memories:load', async () => {
    return readMemories();
  });

  ipcMain.handle('memories:save', async (_event, data) => {
    writeMemories(data);
    return { ok: true };
  });

  ipcMain.handle('assets:importImage', async (_event, { arrayBuffer, fileName }) => {
    ensureStorage();
    const safe = String(fileName || 'image').replace(/[^\w.-]+/g, '_');
    const name = `${Date.now()}_${safe}`;
    const dest = path.join(assetsDir(), name);
    fs.writeFileSync(dest, Buffer.from(arrayBuffer));
    return { ok: true, id: name, url: pathToFileURL(dest).href };
  });

  ipcMain.handle('assets:pickImage', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: '选择图片',
      filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp'] }],
      properties: ['openFile', 'multiSelections'],
    });
    if (result.canceled || !result.filePaths.length) return { ok: false, files: [] };

    ensureStorage();
    const files = [];
    for (const src of result.filePaths) {
      const base = path.basename(src);
      const name = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}_${base.replace(/[^\w.-]+/g, '_')}`;
      const dest = path.join(assetsDir(), name);
      fs.copyFileSync(src, dest);
      files.push({ id: name, url: pathToFileURL(dest).href, name: base });
    }
    return { ok: true, files };
  });

  ipcMain.handle('assets:pickVideo', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: '选择视频',
      filters: [{ name: 'Videos', extensions: ['mp4', 'webm', 'mov'] }],
      properties: ['openFile'],
    });
    if (result.canceled || !result.filePaths.length) return { ok: false, file: null };

    ensureStorage();
    const src = result.filePaths[0];
    const base = path.basename(src);
    const name = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}_${base.replace(/[^\w.-]+/g, '_')}`;
    const dest = path.join(assetsDir(), name);
    fs.copyFileSync(src, dest);
    return { ok: true, file: { id: name, url: pathToFileURL(dest).href, name: base } };
  });
}

app.whenReady().then(() => {
  ensureStorage();
  registerIpc();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
