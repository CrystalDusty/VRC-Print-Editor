const { app, BrowserWindow, dialog, ipcMain } = require('electron');
const fs = require('fs/promises');
const path = require('path');

function createWindow() {
  const win = new BrowserWindow({
    width: 1580,
    height: 980,
    minWidth: 1280,
    minHeight: 760,
    backgroundColor: '#07090f',
    title: 'VRC Print Remix Studio',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  win.loadFile(path.join(__dirname, 'src/index.html'));
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

ipcMain.handle('dialog:openImage', async () => {
  const res = await dialog.showOpenDialog({
    title: 'Select a VRChat print image',
    properties: ['openFile'],
    filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp', 'bmp'] }],
  });
  if (res.canceled || !res.filePaths[0]) return null;
  return res.filePaths[0];
});

ipcMain.handle('dialog:openProject', async () => {
  const res = await dialog.showOpenDialog({
    title: 'Open Remix Project',
    properties: ['openFile'],
    filters: [{ name: 'VRC Remix Project', extensions: ['vrcprint.json', 'json'] }],
  });
  if (res.canceled || !res.filePaths[0]) return null;
  return res.filePaths[0];
});

ipcMain.handle('dialog:saveProject', async () => {
  const res = await dialog.showSaveDialog({
    title: 'Save Remix Project',
    defaultPath: 'project.vrcprint.json',
    filters: [{ name: 'VRC Remix Project', extensions: ['vrcprint.json'] }],
  });
  if (res.canceled || !res.filePath) return null;
  return res.filePath;
});

ipcMain.handle('dialog:savePng', async () => {
  const res = await dialog.showSaveDialog({
    title: 'Export edited print',
    defaultPath: 'edited-print.png',
    filters: [{ name: 'PNG', extensions: ['png'] }],
  });
  if (res.canceled || !res.filePath) return null;
  return res.filePath;
});

ipcMain.handle('file:readText', async (_e, filePath) => fs.readFile(filePath, 'utf-8'));
ipcMain.handle('file:writeText', async (_e, filePath, content) => fs.writeFile(filePath, content, 'utf-8'));
ipcMain.handle('file:readBuffer', async (_e, filePath) => {
  const data = await fs.readFile(filePath);
  return data.toString('base64');
});
ipcMain.handle('file:writeBuffer', async (_e, filePath, base64) => {
  const buffer = Buffer.from(base64, 'base64');
  await fs.writeFile(filePath, buffer);
  return true;
});
