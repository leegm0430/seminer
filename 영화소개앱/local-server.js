// REELVAULT 로컬 정적 서버 (Node.js 내장 모듈만 사용, 별도 설치 불필요)
// 사용법: node local-server.js  →  http://localhost:8000
const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = 8000;

// .env 파일을 읽어 KEY=VALUE 객체로 반환 (파일이 없으면 빈 객체)
function loadEnv() {
  const env = {};
  try {
    const text = fs.readFileSync(path.join(__dirname, ".env"), "utf-8");
    for (const line of text.split(/\r?\n/)) {
      const m = line.match(/^\s*([\w.]+)\s*=\s*(.*?)\s*$/);
      if (m && !line.trim().startsWith("#")) env[m[1]] = m[2];
    }
  } catch (e) { /* .env 없음 — 키 미설정 안내 모달이 표시됨 */ }
  return env;
}

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js":   "text/javascript; charset=utf-8",
  ".css":  "text/css; charset=utf-8",
  ".json": "application/json",
  ".png":  "image/png",
  ".jpg":  "image/jpeg",
  ".svg":  "image/svg+xml",
  ".ico":  "image/x-icon",
  ".mp4":  "video/mp4",
};

http.createServer((req, res) => {
  let file = decodeURIComponent(req.url.split("?")[0]);
  if (file === "/") file = "/index.html";
  // .env의 키를 브라우저에 주입하는 가상 파일 (.env 자체는 절대 서빙하지 않음)
  if (file === "/env.js") {
    const env = loadEnv();
    res.writeHead(200, { "Content-Type": MIME[".js"] });
    res.end("window.__ENV__ = " + JSON.stringify({ TMDB_API_KEY: env.TMDB_API_KEY || "" }) + ";");
    return;
  }
  if (path.basename(file).startsWith(".env")) { res.writeHead(403); res.end("Forbidden"); return; }
  const full = path.normalize(path.join(__dirname, file));
  if (!full.startsWith(__dirname)) { res.writeHead(403); res.end("Forbidden"); return; }
  fs.readFile(full, (err, data) => {
    if (err) { res.writeHead(404); res.end("Not Found"); return; }
    res.writeHead(200, { "Content-Type": MIME[path.extname(full).toLowerCase()] || "application/octet-stream" });
    res.end(data);
  });
}).listen(PORT, () => {
  console.log("REELVAULT local server running: http://localhost:" + PORT);
});
