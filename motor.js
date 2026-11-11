/* MOTOR DO COMPUTADOR — ffmpeg embutido: abre qualquer vídeo (HEVC/H.265 do celular, MOV, MKV...), monta a moldura
   e salva em Vídeos/SD Notícias. Mesmo resultado do app do celular (mesmas camadas). */
const { spawn } = require("child_process");
const fs = require("fs"), os = require("os"), path = require("path"), https = require("https");
const bin = (p) => p.replace("app.asar", "app.asar.unpacked");
const FFMPEG = bin(require("ffmpeg-static")), FFPROBE = bin(require("ffprobe-static").path);
let atual = null;

function rodar(exe, args, aoLinha) {
  return new Promise((ok, falha) => {
    const p = spawn(exe, args, { windowsHide: true }); let err = "", buf = "";
    p.stdout.on("data", (d) => { buf += d; const ls = buf.split(/\r?\n/); buf = ls.pop(); if (aoLinha) ls.forEach(aoLinha); else err += d; });
    p.stderr.on("data", (d) => { err = (err + d).slice(-4000); });
    p.on("error", falha); p.on("close", (c) => c === 0 ? ok(err) : falha(new Error(err.split("\n").filter(Boolean).slice(-3).join(" ") || "código " + c)));
    if (exe === FFMPEG) atual = p;
  });
}
async function info(arq) {
  const s = await new Promise((ok, falha) => { const p = spawn(FFPROBE, ["-v", "error", "-print_format", "json", "-show_format", "-show_streams", arq], { windowsHide: true }); let o = "";
    p.stdout.on("data", (d) => o += d); p.on("error", falha); p.on("close", () => { try { ok(JSON.parse(o)); } catch (e) { falha(new Error("Não consegui ler este arquivo.")); } }); });
  const v = (s.streams || []).find((x) => x.codec_type === "video"), a = (s.streams || []).find((x) => x.codec_type === "audio");
  if (!v) throw new Error("Esse arquivo não tem vídeo.");
  return { duracao: +s.format.duration || +v.duration || 0, largura: v.width, altura: v.height, codec: v.codec_name, som: !!a };
}
const deBase64 = (d) => Buffer.from(String(d).slice(String(d).indexOf(",") + 1), "base64");
const pasta = (app, tipo) => { const p = path.join(app.getPath(tipo), "SD Notícias"); fs.mkdirSync(p, { recursive: true }); return p; };
const livre = (dir, nome) => { let f = path.join(dir, nome), k = 1; while (fs.existsSync(f)) f = path.join(dir, nome.replace(/(\.\w+)$/, `-${++k}$1`)); return f; };

function registrar(ipc, janela, { app, dialog, shell }) {
  const enviar = (evento, dados) => { const j = janela(); if (j && !j.isDestroyed()) j.webContents.send("pc:evento", { evento, dados }); };
  const h = (nome, fn) => ipc.handle("pc:" + nome, async (_e, o) => { try { return await fn(o || {}); } catch (e) { return { __erro: String(e.message || e) }; } });

  h("disponivel", async () => ({ ok: true }));
  h("escolher", async (o) => {
    const r = await dialog.showOpenDialog(janela(), { title: "Escolha o vídeo", properties: ["openFile"], filters: [{ name: "Vídeos", extensions: ["mp4", "mov", "m4v", "mkv", "avi", "webm", "3gp", "hevc"] }, { name: "Todos", extensions: ["*"] }] });
    if (r.canceled || !r.filePaths[0]) throw new Error("cancelado");
    const arq = r.filePaths[0], i = await info(arq), mini = path.join(os.tmpdir(), "sd-mini-" + Date.now() + ".jpg");
    let miniatura = null;
    try { await rodar(FFMPEG, ["-y", "-v", "error", "-ss", String(Math.min(1, i.duracao / 4)), "-i", arq, "-frames:v", "1", "-vf", "scale=720:-2", "-q:v", "4", mini]);
      miniatura = "data:image/jpeg;base64," + fs.readFileSync(mini).toString("base64"); fs.unlinkSync(mini); } catch (_) {}
    return { uri: arq, nome: path.basename(arq), tamanho: fs.statSync(arq).size, mime: "video/*", duracao: i.duracao, miniatura, largura: i.largura, altura: i.altura };
  });

  h("gerar", async (o) => {
    const t0 = Date.now(), W = o.largura, H = o.altura, b = o.buraco, seg = Math.max(1, o.segundos || 4), i = await info(o.uri);
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "sd-")), ins = ["-y", "-v", "error", "-progress", "pipe:1", "-nostats", "-i", o.uri];
    const camadas = (o.camadas || []).map((d, k) => { const f = path.join(tmp, `c${k}.png`); fs.writeFileSync(f, deBase64(d)); return f; });
    let fx = null; if (o.faixa && o.faixa.imagem) { fx = path.join(tmp, "faixa.png"); fs.writeFileSync(fx, deBase64(o.faixa.imagem)); }
    const ent = []; if (fx) ent.push(fx); ent.push(...camadas);
    ent.forEach((f) => ins.push("-loop", "1", "-framerate", "30", "-i", f));
    const g = [`color=c=black:s=${W}x${H}:r=30[bg]`, `[0:v]scale=${b.w}:${b.h}:force_original_aspect_ratio=increase,crop=${b.w}:${b.h},setsar=1,fps=30[v]`, `[bg][v]overlay=${b.x}:${b.y}:shortest=1[s0]`];
    let n = 0, ult = "s0", idx = 1;
    if (fx) { const px = 110 * W / 1080, volta = o.faixa.volta || 1000;    // a faixa corre por baixo da moldura (mesma velocidade do celular)
      g.push(`[${ult}][${idx}:v]overlay=x='${o.faixa.x}-mod(t*${px.toFixed(3)}\\,${volta})':y=${o.faixa.y}:eval=frame:shortest=1[s${++n}]`); ult = "s" + n; idx++; }
    const tot = seg * camadas.length;
    camadas.forEach((_, k) => { const en = camadas.length > 1 ? `:enable='gte(mod(t\\,${tot})\\,${k * seg})*lt(mod(t\\,${tot})\\,${(k + 1) * seg})'` : "";
      g.push(`[${ult}][${idx + k}:v]overlay=0:0:shortest=1${en}[s${++n}]`); ult = "s" + n; });
    const saida = livre(pasta(app, "videos"), o.nome || `sdnoticias-video-${Date.now()}.mp4`);
    const args = [...ins, "-filter_complex", g.join(";"), "-map", `[${ult}]`, "-map", "0:a?", "-t", String(i.duracao || 600),
      "-c:v", "libx264", "-preset", "veryfast", "-b:v", String(o.bitrate || 8e6), "-maxrate", String(Math.round((o.bitrate || 8e6) * 1.5)), "-bufsize", String((o.bitrate || 8e6) * 2),
      "-pix_fmt", "yuv420p", "-profile:v", "high", "-c:a", "aac", "-b:a", "160k", "-movflags", "+faststart", saida];
    let ultP = -1;
    await rodar(FFMPEG, args, (l) => { const m = l.match(/^out_time_(?:us|ms)=(\d+)/); if (m && i.duracao) { const p = Math.min(99, Math.floor(+m[1] / 1e6 / i.duracao * 100)); if (p !== ultP) { ultP = p; enviar("progresso", { p }); } } })
      .finally(() => { atual = null; fs.rmSync(tmp, { recursive: true, force: true }); });
    enviar("progresso", { p: 100 });
    return { uri: saida, arquivo: saida, ms: Date.now() - t0, tamanho: fs.statSync(saida).size, pasta: path.dirname(saida) };
  });
  h("cancelar", async () => { if (atual) atual.kill(); return {}; });

  h("salvarImagem", async (o) => { const f = livre(pasta(app, "pictures"), o.nome || `sdnoticias-${Date.now()}.jpg`); fs.writeFileSync(f, deBase64(o.dados)); return { uri: f, arquivo: f, pasta: path.dirname(f) }; });
  h("compartilhar", async (o) => { shell.showItemInFolder(o.arquivo); return {}; });   // no PC: abre a pasta com o arquivo marcado

  h("enviarYouTube", async (o) => {
    const tam = fs.statSync(o.arquivo).size, meta = JSON.stringify({ snippet: { title: String(o.titulo || "").slice(0, 95), description: o.descricao || "", categoryId: "25" }, status: { privacyStatus: o.privacidade || "public", selfDeclaredMadeForKids: false } });
    const sessao = await new Promise((ok, falha) => { const r = https.request("https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status", { method: "POST",
      headers: { authorization: "Bearer " + o.token, "content-type": "application/json; charset=UTF-8", "x-upload-content-type": "video/mp4", "x-upload-content-length": tam } }, (res) => {
        let t = ""; res.on("data", (d) => t += d); res.on("end", () => res.statusCode === 200 ? ok(res.headers.location) : falha(new Error(`O YouTube recusou (${res.statusCode}): ${t.slice(0, 300)}`))); });
      r.on("error", falha); r.end(meta); });
    return await new Promise((ok, falha) => { const r = https.request(sessao, { method: "PUT", headers: { "content-type": "video/mp4", "content-length": tam } }, (res) => {
        let t = ""; res.on("data", (d) => t += d); res.on("end", () => { try { const j = JSON.parse(t); if (j.id) ok({ id: j.id }); else falha(new Error(t.slice(0, 300))); } catch (_) { falha(new Error("Resposta estranha do YouTube: " + t.slice(0, 200))); } }); });
      r.on("error", falha); let env = 0, ultP = -1;
      fs.createReadStream(o.arquivo).on("data", (d) => { env += d.length; const p = Math.floor(env / tam * 100); if (p !== ultP) { ultP = p; enviar("envio", { p }); } }).pipe(r); });
  });
}
module.exports = { registrar, info };
