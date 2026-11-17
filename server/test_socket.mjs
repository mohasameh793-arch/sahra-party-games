// Run: node test_socket.mjs — starts the real server on a spare port and checks the audit fixes.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
const require = createRequire(new URL("../app/package.json", import.meta.url));
const { io } = require("socket.io-client");

const PORT = 3900 + Math.floor(Math.random() * 90);
const srv = spawn(process.execPath, ["index.js"], { cwd: new URL(".", import.meta.url), env: { ...process.env, PORT: String(PORT), TRUST_PROXY: "" } });
await new Promise((r) => srv.stdout.once("data", r));
const url = `http://localhost:${PORT}`;
const connect = (headers = {}) => new Promise((r) => { const s = io(url, { transports: ["websocket"], extraHeaders: headers, forceNew: true }); s.on("connect", () => r(s)); });
const call = (s, ev, d) => new Promise((r) => s.emit(ev, d, r));
const states = (s) => { const box = { last: null }; s.on("state", (x) => { box.last = x; }); return box; };

try {
  // 1. Creating a second room on the same socket releases the first one.
  const a = await connect();
  const ha = states(a);
  const first = await call(a, "create", { name: "مضيف", mode: "same" });
  const watcher = await connect();
  const w = states(watcher);
  await call(watcher, "join", { code: first.code, name: "مراقب" });
  await new Promise((r) => setTimeout(r, 200));
  await call(a, "decide", { id: ha.last.pending[0].id, accept: true });
  await new Promise((r) => setTimeout(r, 200));
  assert.equal(w.last.players.find((p) => p.isHost).connected, true);
  const second = await call(a, "create", { name: "مضيف", mode: "same" });
  assert.ok(second.ok && second.code !== first.code);
  await new Promise((r) => setTimeout(r, 300));
  assert.equal(w.last.players.find((p) => p.isHost).connected, false, "room 1's host is released after creating room 2");
  a.close(); watcher.close();

  // 2. A client-chosen X-Forwarded-For no longer gives a fresh rate-limit bucket.
  let refused = 0;
  for (let i = 0; i < 25; i++) {
    const s = await connect({ "x-forwarded-for": `10.0.0.${i}` });
    const r = await call(s, "create", { name: "x" + i, mode: "same" });
    if (r.error) refused++;
    s.close();
  }
  assert.ok(refused > 0, "spoofed X-Forwarded-For must not bypass the 20/min limit");
  console.log(`socket checks passed (rotating X-Forwarded-For: ${refused} of 25 refused)`);
} finally {
  srv.kill();
}
