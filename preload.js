/* Faz o painel enxergar o computador como enxerga o app do celular (mesmos comandos do plugin "Moldura"). */
const { contextBridge, ipcRenderer } = require("electron");
const ouvir = (nome, cb) => { const f = (_e, d) => { if (d && d.evento === nome) cb(d.dados); }; ipcRenderer.on("pc:evento", f); return { remove: () => ipcRenderer.removeListener("pc:evento", f) }; };
const chamar = (m) => async (o) => { const r = await ipcRenderer.invoke("pc:" + m, o || {}); if (r && r.__erro) throw new Error(r.__erro); return r; };
const Moldura = { disponivel: chamar("disponivel"), escolher: chamar("escolher"), gerar: chamar("gerar"), cancelar: chamar("cancelar"), salvarImagem: chamar("salvarImagem"),
  compartilhar: chamar("compartilhar"), enviarYouTube: chamar("enviarYouTube"), addListener: async (nome, cb) => ouvir(nome, cb) };
contextBridge.exposeInMainWorld("Capacitor", { isNativePlatform: () => true, getPlatform: () => "pc", Plugins: { Moldura } });
contextBridge.exposeInMainWorld("SD_PC", { versao: process.env.npm_package_version || "", plataforma: process.platform, recarregar: () => ipcRenderer.invoke("pc:recarregar") });
