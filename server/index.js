// Socket wiring + static hosting of the built web app (app/dist) for iPhone home-screen installs.
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize, dirname, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { Server } from "socket.io";
import * as L from "./logic.js";

const PORT = Number(process.env.PORT || 3005);
const TRUST_PROXY = process.env.TRUST_PROXY === "1";
const WEB = join(dirname(fileURLToPath(import.meta.url)), "..", "app", "dist");
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".json": "application/json",
  ".png": "image/png", ".ico": "image/x-icon", ".svg": "image/svg+xml", ".ttf": "font/ttf", ".webmanifest": "application/manifest+json" };
const HEADERS = { "X-Content-Type-Options": "nosniff", "Referrer-Policy": "no-referrer", "X-Frame-Options": "DENY" };

const http = createServer(async (req, res) => {
  let path;
  try {
    path = normalize(decodeURIComponent(new URL(req.url, "http://x").pathname)).replace(/^([/\\])+/, "");
  } catch {
    return res.writeHead(400, HEADERS).end(); // malformed %-encoding must not crash the server
  }
  const file = join(WEB, path);
  if (file !== WEB && !file.startsWith(WEB + sep)) return res.writeHead(400, HEADERS).end();
  for (const f of [file, join(WEB, "index.html")]) {
    try {
      const body = await readFile(f);
      return res.writeHead(200, { ...HEADERS, "Content-Type": TYPES[extname(f)] || "application/octet-stream" }).end(body);
    } catch {}
  }
  res.writeHead(404, HEADERS).end("not built yet");
});

// CORS: the Android app and Expo dev server connect from other origins. The server holds no cookies,
// identity is a secret token sent in each message, so allowing origins does not leak sessions.
const io = new Server(http, { cors: { origin: true }, maxHttpBufferSize: 4096 });

// ponytail: per-IP limit in memory, fine for one server.
const hits = new Map();
function limited(ip, max = 20) {
  const now = Date.now();
  const h = (hits.get(ip) || []).filter((t) => now - t < 60_000);
  h.push(now);
  hits.set(ip, h);
  return h.length > max;
}

function broadcast(room) {
  for (const p of [...room.players, ...room.pending]) if (p.socketId) io.to(p.socketId).emit("state", L.view(room, p));
}

/**
 * Lets go of the room this socket is bound to: a pending request is dropped, a player is marked
 * disconnected, and a room with nobody connected starts its 15-minute countdown to deletion.
 * (Audit fix: without this, a socket that created/joined again left its old rooms "connected" forever.)
 */
function release(socket) {
  const { code, token } = socket.data || {};
  const room = L.rooms.get(code);
  const p = room && L.byToken(room, token);
  if (!p || p.socketId !== socket.id) return;
  if (room.pending.includes(p)) L.removePlayer(room, p);
  else p.connected = false;
  if (!room.players.some((x) => x.connected)) room.emptySince = Date.now();
  broadcast(room);
}

function attach(socket, room, p) {
  if (socket.data?.token !== p.token) release(socket); // one room per socket
  p.socketId = socket.id;
  p.connected = true;
  room.emptySince = null;
  socket.data = { code: room.code, token: p.token };
}

io.on("connection", (socket) => {
  // The client can write any X-Forwarded-For value, so it is only trusted when the server runs behind
  // our own reverse proxy that overwrites it (set TRUST_PROXY=1 there). Otherwise use the real socket address.
  const ip = (TRUST_PROXY && socket.handshake.headers["x-forwarded-for"]?.split(",")[0].trim()) || socket.handshake.address;

  // Wraps a handler: catches game errors and always answers through the ack callback.
  const on = (event, fn, { limit } = {}) => socket.on(event, (data = {}, ack) => {
    const reply = typeof ack === "function" ? ack : () => {};
    if (limit && limited(ip)) return reply({ error: "محاولات كثيرة، انتظر دقيقة" });
    try {
      reply({ ok: true, ...(fn(data) || {}) });
    } catch (e) {
      if (!(e instanceof L.GameError)) console.error(e);
      reply({ error: e instanceof L.GameError ? e.message : "صار خطأ، جرّب مرة ثانية" });
    }
  });

  const current = () => {
    const { code, token } = socket.data || {};
    const room = L.getRoom(code);
    const p = L.byToken(room, token);
    if (!p) throw new L.GameError("انتهت الجلسة");
    return { room, p };
  };

  on("create", ({ name, mode }) => {
    const { room, player } = L.createRoom(name, mode);
    attach(socket, room, player);
    broadcast(room);
    return { code: room.code, token: player.token };
  }, { limit: true });

  on("join", ({ code, name }) => {
    const { room, player } = L.requestJoin(code, name);
    attach(socket, room, player);
    broadcast(room);
    return { code: room.code, token: player.token };
  }, { limit: true });

  on("resume", ({ code, token }) => {
    const room = L.getRoom(code);
    const p = L.byToken(room, String(token ?? ""));
    if (!p) throw new L.GameError("انتهت الجلسة");
    attach(socket, room, p);
    broadcast(room);
  }, { limit: true });

  const act = (event, fn) => on(event, (d) => { const { room, p } = current(); fn(room, p, d); broadcast(room); });

  act("decide", (room, p, d) => L.decide(room, p, d.id, !!d.accept));
  act("kick", (room, p, d) => {
    const t = L.kick(room, p, d.id);
    if (t.socketId) io.to(t.socketId).emit("kicked");
  });
  act("chooseGame", (room, p, d) => L.chooseGame(room, p, d.gameId));
  act("understood", (room, p) => L.understood(room, p));
  act("skipHowto", (room, p) => L.skipHowto(room, p));
  act("endGame", (room, p) => L.endGame(room, p));
  act("action", (room, p, d) => L.gameAction(room, p, d));

  on("leave", () => {
    const { room, p } = current();
    L.removePlayer(room, p);
    socket.data = {};
    broadcast(room);
  });

  socket.on("disconnect", () => release(socket));
});

// Close rooms nobody has been connected to for 15 minutes.
setInterval(() => {
  for (const [code, r] of L.rooms) if (r.emptySince && Date.now() - r.emptySince > 15 * 60_000) L.rooms.delete(code);
  hits.clear();
}, 60_000).unref();

http.listen(PORT, () => console.log(`party server on :${PORT}`));
