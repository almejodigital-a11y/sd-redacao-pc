// Teste na nuvem: cria um vídeo HEVC (como os de celular), passa pelo motor e confere o resultado.
const fs = require("fs"), os = require("os"), path = require("path"), { execFileSync } = require("child_process");
const ff = require("ffmpeg-static"), fp = require("ffprobe-static").path, motor = require("./motor");
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "t-")), ent = path.join(tmp, "celular.mp4");
execFileSync(ff, ["-y", "-v", "error", "-f", "lavfi", "-i", "testsrc2=s=1920x1080:r=30:d=6", "-f", "lavfi", "-i", "sine=f=440:d=6", "-c:v", "libx265", "-tag:v", "hvc1", "-c:a", "aac", ent]);
const png = (nome, s, cor) => { const f = path.join(tmp, nome); execFileSync(ff, ["-y", "-v", "error", "-f", "lavfi", "-i", `color=c=${cor}:s=${s},format=rgba`, "-frames:v", "1", f]); return "data:image/png;base64," + fs.readFileSync(f).toString("base64"); };
const h = {}, ipc = { handle: (n, f) => h[n] = f }, app = { getPath: () => tmp }, ev = [];
motor.registrar(ipc, () => ({ isDestroyed: () => false, webContents: { send: (_c, d) => ev.push(d.dados.p) } }), { app, dialog: {}, shell: {} });
(async () => {
  const r = await h["pc:gerar"](null, { uri: ent, largura: 1080, altura: 1920, buraco: { x: 40, y: 500, w: 1000, h: 1000 }, camadas: [png("a.png", "1080x1920", "red@0.3"), png("b.png", "1080x1920", "blue@0.3")],
    faixa: { x: 0, y: 1700, volta: 900, imagem: png("f.png", "2000x60", "white") }, segundos: 2, bitrate: 6e6, nome: "saida.mp4" });
  if (r.__erro) { console.error("ERRO:", r.__erro); process.exit(1); }
  const p = JSON.parse(execFileSync(fp, ["-v", "error", "-print_format", "json", "-show_streams", "-show_format", r.arquivo]));
  const v = p.streams.find((s) => s.codec_type === "video"), a = p.streams.find((s) => s.codec_type === "audio");
  console.log("ok", r.ms + "ms", v.codec_name, v.width + "x" + v.height, "som:", !!a, "dur:", p.format.duration, "progresso:", ev.slice(-3));
  if (v.codec_name !== "h264" || v.width !== 1080 || !a || Math.abs(p.format.duration - 6) > .5) process.exit(1);
})();
