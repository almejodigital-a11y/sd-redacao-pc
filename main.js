/* SD Redação para computador — Almejo Digital (Claude, 11/11/2026).
   A janela abre o painel online: toda melhoria do painel chega sozinha, sem instalar de novo.
   O que é do computador (motor de vídeo ffmpeg, salvar arquivos, YouTube) fica aqui e se atualiza sozinho pelo GitHub. */
const { app, BrowserWindow, ipcMain, dialog, shell, Menu, nativeImage } = require("electron");
const path = require("path");
const motor = require("./motor");
const PAINEL = "https://sd-redacao.pages.dev/painel/";
const ICONE = nativeImage.createFromPath(path.join(__dirname, "icone.png"));
let janela, abertura;

if (!app.requestSingleInstanceLock()) app.quit();
app.on("second-instance", () => { if (janela) { if (janela.isMinimized()) janela.restore(); janela.focus(); } });
app.setAppUserModelId("com.almejo.sdredacao.pc");

function criar() {
  Menu.setApplicationMenu(null);
  abertura = new BrowserWindow({ width: 520, height: 340, frame: false, transparent: true, resizable: false, center: true, show: false, alwaysOnTop: true, skipTaskbar: true, icon: ICONE, webPreferences: { sandbox: true } });
  abertura.loadFile("abertura.html"); abertura.once("ready-to-show", () => abertura.show());
  const inicio = Date.now();

  janela = new BrowserWindow({ width: 1320, height: 860, minWidth: 380, minHeight: 600, show: false, backgroundColor: "#050b18", icon: ICONE, title: "SD Redação",
    webPreferences: { preload: path.join(__dirname, "preload.js"), contextIsolation: true, sandbox: false, spellcheck: true } });
  // o Google não deixa entrar por "programas": nos apresentamos como o Chrome normal
  janela.webContents.setUserAgent(janela.webContents.getUserAgent().replace(/\s?Electron\/\S+/, "").replace(/\s?sd-redacao\/\S+/i, ""));
  janela.webContents.session.setSpellCheckerLanguages(["pt-BR"]);
  janela.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("https://accounts.google.com") || url.startsWith(PAINEL)) return { action: "allow" };
    shell.openExternal(url); return { action: "deny" };
  });
  janela.webContents.on("did-fail-load", (_e, cod, _d, url, principal) => { if (principal && cod !== -3) janela.loadFile("offline.html"); });
  janela.webContents.session.on("will-download", (_e, item) => {   // downloads do navegador vão direto para Downloads
    item.setSavePath(path.join(app.getPath("downloads"), item.getFilename()));
    item.once("done", (_x, st) => { if (st === "completed") shell.showItemInFolder(item.getSavePath()); });
  });
  janela.loadURL(PAINEL);
  janela.once("ready-to-show", () => setTimeout(() => {
    janela.maximize(); janela.show();
    if (abertura && !abertura.isDestroyed()) abertura.close();
  }, Math.max(0, 2600 - (Date.now() - inicio))));
  motor.registrar(ipcMain, () => janela, { app, dialog, shell });
  ipcMain.handle("pc:recarregar", () => janela.loadURL(PAINEL));
}

app.whenReady().then(() => {
  criar();
  try { const { autoUpdater } = require("electron-updater"); autoUpdater.checkForUpdatesAndNotify().catch(() => {}); setInterval(() => autoUpdater.checkForUpdatesAndNotify().catch(() => {}), 6 * 36e5); } catch (_) {}
});
app.on("window-all-closed", () => app.quit());
