// Teste na nuvem: abre o programa de verdade e tira foto da abertura e do painel.
const { app, BrowserWindow } = require("electron"), fs = require("fs");
app.whenReady().then(() => setTimeout(async () => {
  const fotos = async (n) => { for (const w of BrowserWindow.getAllWindows()) if (w.isVisible()) { const i = await w.webContents.capturePage(); fs.writeFileSync(`${n}-${w.getTitle().replace(/\W+/g, "")}.png`, i.toPNG()); } };
  await fotos("1"); setTimeout(async () => { await fotos("2"); app.exit(0); }, 9000);
}, 1400));
require("./main.js");
