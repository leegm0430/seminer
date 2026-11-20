const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

if (typeof process.loadEnvFile === "function") {
  try {
    process.loadEnvFile(".env");
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
}

const root = __dirname;
const statePath = path.join(root, "server-state.json");
const port = Number(process.env.PORT || 3000);
const mimeTypes = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".json": "application/json; charset=utf-8", ".svg": "image/svg+xml" };
let state = readState();

function readState() {
  try {
    return JSON.parse(fs.readFileSync(statePath, "utf8"));
  } catch {
    return { users: {}, sent: {} };
  }
}

function saveState() {
  fs.writeFileSync(statePath, JSON.stringify(state, null, 2));
}

function sendJson(response, status, body) {
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  response.end(JSON.stringify(body));
}

async function readBody(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > 1_000_000) throw new Error("Request too large");
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function dateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function money(amount) {
  return `₩${Number(amount).toLocaleString("ko-KR")}`;
}

async function sendPush(userId, item, today) {
  const key = `${userId}:${item.id}:${dateKey(today)}`;
  if (state.sent[key]) return;
  const response = await fetch("https://api.onesignal.com/notifications", {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8", Authorization: `Key ${process.env.ONESIGNAL_REST_API_KEY}` },
    body: JSON.stringify({
      app_id: process.env.ONESIGNAL_APP_ID,
      target_channel: "push",
      include_aliases: { external_id: [userId] },
      headings: { ko: "내일 구독료가 결제돼요" },
      contents: { ko: `내일 ${item.name} 구독료 ${money(item.price)} 결제 예정이에요.` },
      web_url: "/",
    }),
  });
  if (!response.ok) {
    console.error(`OneSignal send failed with status ${response.status}`);
    return;
  }
  state.sent[key] = true;
  saveState();
}

async function checkDueReminders() {
  if (!process.env.ONESIGNAL_APP_ID || !process.env.ONESIGNAL_REST_API_KEY) return;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const key = dateKey(today);
  for (const [userId, user] of Object.entries(state.users)) {
    if (!user.enabled || !Array.isArray(user.items)) continue;
    for (const item of user.items) {
      if (item.cancelAfter && key > item.cancelAfter) continue;
      if (!Number.isInteger(Number(item.due)) || Number(item.due) < 1 || Number(item.due) > 31) continue;
      const paymentDate = (year, month) => new Date(year, month, Math.min(Number(item.due), new Date(year, month + 1, 0).getDate()));
      let nextPayment;
      if (item.cycle === "yearly") {
        const month = Number(item.dueMonth) - 1;
        if (!Number.isInteger(month) || month < 0 || month > 11) continue;
        nextPayment = paymentDate(today.getFullYear(), month);
        if (nextPayment <= today) nextPayment = paymentDate(today.getFullYear() + 1, month);
      } else {
        nextPayment = paymentDate(today.getFullYear(), today.getMonth());
        if (nextPayment <= today) nextPayment = paymentDate(today.getFullYear(), today.getMonth() + 1);
      }
      if (item.cancelAt && dateKey(nextPayment) > item.cancelAt) continue;
      const reminderDay = new Date(nextPayment);
      reminderDay.setDate(reminderDay.getDate() - 1);
      if (dateKey(reminderDay) === key) await sendPush(userId, item, today);
    }
  }
}

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url, `http://${request.headers.host || "localhost"}`);
  if (url.pathname === "/api/config" && request.method === "GET") {
    return sendJson(response, 200, { configured: Boolean(process.env.ONESIGNAL_APP_ID && process.env.ONESIGNAL_REST_API_KEY), appId: process.env.ONESIGNAL_APP_ID || "" });
  }
  if (url.pathname === "/api/reminders" && request.method === "POST") {
    try {
      const body = await readBody(request);
      if (typeof body.userId !== "string" || body.userId.length > 180 || !Array.isArray(body.items)) return sendJson(response, 400, { error: "Invalid reminder settings" });
      state.users[body.userId] = { enabled: Boolean(body.enabled), items: body.items.map((item) => ({ id: String(item.id), name: String(item.name).slice(0, 100), price: Number(item.price), due: Number(item.due), dueMonth: Number(item.dueMonth), cycle: item.cycle === "yearly" ? "yearly" : "monthly", cancelAt: /^\d{4}-\d{2}-\d{2}$/.test(item.cancelAt || "") ? item.cancelAt : "", cancelAfter: /^\d{4}-\d{2}-\d{2}$/.test(item.cancelAfter || "") ? item.cancelAfter : "" })).slice(0, 200) };
      saveState();
      return sendJson(response, 200, { saved: true });
    } catch {
      return sendJson(response, 400, { error: "Invalid request" });
    }
  }
  if (url.pathname.startsWith("/api/")) return sendJson(response, 404, { error: "Not found" });

  let requested;
  try {
    requested = url.pathname === "/" ? "/index.html" : decodeURIComponent(url.pathname);
  } catch {
    response.writeHead(400);
    return response.end("Bad request");
  }
  if (!["/index.html", "/styles.css", "/app-refresh.css", "/profile-menu.css", "/subscription-detail.css", "/detail-date.css", "/chart-and-details.css", "/subscription-polish.css", "/topbar-back.css", "/settings.css", "/settings-extra.css", "/cancel-date-field.css", "/service-manage-link.css", "/subscription-rows.css", "/subscription-share.css", "/app.js", "/OneSignalSDKWorker.js", "/__preview-bridge.js"].includes(requested)) {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    return response.end("Not found");
  }
  const filePath = path.resolve(root, `.${requested}`);
  if (!filePath.startsWith(`${root}${path.sep}`) || !fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    return response.end("Not found");
  }
  response.writeHead(200, { "Content-Type": mimeTypes[path.extname(filePath)] || "application/octet-stream", "Cache-Control": "no-cache" });
  fs.createReadStream(filePath).pipe(response);
});

server.listen(port, "0.0.0.0", () => console.log(`MOA server listening on ${port}`));
setInterval(() => void checkDueReminders(), 60_000);
void checkDueReminders();
