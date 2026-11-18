// Games made from YouTube videos: the shared store, the submit pipeline (limits, duplicates, AI), and one
// generic engine that plays any saved definition (roles / secret_word / prompts / trivia).
import { readFileSync, writeFileSync, renameSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { id as rid, shuffle, randomInt, fail } from "./util.js";
import { norm } from "./arabic.js";
import * as AI from "./ai.js";
import { parseVideoLink, download } from "./videolink.js";

const FILE = process.env.CUSTOM_GAMES_FILE || join(dirname(fileURLToPath(import.meta.url)), "data", "custom-games.json");
const MAX_GAMES = 300;
const PER_IP_HOUR = 3;
const PER_DAY = 40;
const MAX_INFLIGHT = 2;

let store = { games: [], rejected: {} };
try { store = JSON.parse(readFileSync(FILE, "utf8")); } catch {}

function save() {
  mkdirSync(dirname(FILE), { recursive: true });
  writeFileSync(FILE + ".tmp", JSON.stringify(store));
  renameSync(FILE + ".tmp", FILE); // atomic swap, a crash never leaves half a file
}

// Built-in games and the other names they go by, for the duplicate check.
const BUILTIN = {
  "برا السالفة": ["برا السالفة", "مين برا السالفة", "imposter", "impostor", "spyfall", "سباي فول", "الجاسوس", "outsider"],
  "الذيب": ["الذيب", "werewolf", "werewolves", "المستذئب", "الذئب", "ذيب"],
  "المافيا": ["المافيا", "mafia", "مافيا"],
  "سين جيم": ["سين جيم", "jeopardy", "seen jeem"],
  "حزورة": ["حزورة", "حزاير", "riddles", "فوازير"],
  "أتوبيس كومبليت": ["أتوبيس كومبليت", "اسم حيوان نبات جماد", "stop", "scattergories", "ستوب"],
  "كلمة سر": ["كلمة سر", "كلمة السر", "password"],
  "صراحة": ["صراحة", "truth", "صارحني"],
};
const key = (s) => norm(String(s).toLowerCase());

/** Name of an existing game this definition duplicates, or null. */
export function findDuplicate(def) {
  const mine = new Set([def.name, ...(def.aliases || [])].map(key).filter(Boolean));
  for (const [name, aliases] of Object.entries(BUILTIN)) if (aliases.some((a) => mine.has(key(a)))) return name;
  for (const gm of store.games) if ([gm.def.name, ...(gm.def.aliases || [])].some((a) => mine.has(key(a)))) return gm.def.name;
  return null;
}

export const get = (id) => store.games.find((x) => x.id === id) || null;
const publicInfo = (x) => ({ id: x.id, category: x.category, name: x.def.name, line: x.def.line, steps: x.def.steps, minPlayers: x.def.minPlayers, mechanic: x.def.mechanic });
export const publicList = () => store.games.map(publicInfo);

// ponytail: limits live in memory and reset with the server; fine for one small server.
const perIp = new Map();
let day = { date: "", count: 0 };
const inflight = new Set();

/** Full pipeline for one submitted link. Resolves {ok, game} or {error}. Never throws for user input. */
export async function submit({ url, category, ip }) {
  const link = parseVideoLink(url);
  if (!link) return { error: "حط رابط فيديو من يوتيوب، انستقرام، تيك توك، X، فيسبوك أو سناب" };
  const videoId = link.key;
  if (category !== "saudi" && category !== "egypt") return { error: "اختر قسم" };
  const known = store.games.find((x) => x.videoId === videoId);
  if (known) return { error: `اللعبة موجودة باسم «${known.def.name}»` };
  if (store.rejected[videoId]) return { error: store.rejected[videoId] };
  if (store.games.length >= MAX_GAMES) return { error: "وصلنا الحد الأعلى للألعاب" };
  if (inflight.has(ip)) return { error: "عندك فيديو يتحلل الحين، انتظر" };
  if (inflight.size >= MAX_INFLIGHT) return { error: "فيه فيديوهات تتحلل الحين، جرّب بعد دقيقة" };
  const now = Date.now();
  const hits = (perIp.get(ip) || []).filter((t) => now - t < 3_600_000);
  if (hits.length >= PER_IP_HOUR) return { error: "وصلت الحد: ٣ فيديوهات بالساعة" };
  const today = new Date().toISOString().slice(0, 10);
  if (day.date !== today) day = { date: today, count: 0 };
  if (day.count >= PER_DAY) return { error: "خلصت تحليلات اليوم، جرّب بكرة" };
  hits.push(now); perIp.set(ip, hits); day.count++;
  inflight.add(ip);
  try {
    let source = { youtubeId: link.youtubeId };
    if (!link.youtubeId) {
      const d = await download(link);
      if (d.error) return { error: d.error };
      source = d;
    }
    const r = await AI.analyze(source, category);
    if (!r.ok) {
      if (!/مشغولة/.test(r.reason)) { store.rejected[videoId] = r.reason; save(); }
      return { error: r.reason };
    }
    if (store.games.some((x) => x.videoId === videoId)) return { error: "اللعبة انضافت قبل شوي" };
    const dup = findDuplicate(r.def);
    if (dup) return { error: `اللعبة موجودة باسم «${dup}»` };
    const game = { id: "c_" + rid(5), videoId, category, def: r.def, createdAt: new Date().toISOString() };
    store.games.push(game);
    save();
    return { ok: true, game: publicInfo(game) };
  } catch (e) {
    console.error("custom submit failed:", e?.name);
    return { error: "صار خطأ، جرّب مرة ثانية" };
  } finally {
    inflight.delete(ip);
  }
}

// ---------- the generic engine ----------
export function start(g) {
  const def = get(g.customId)?.def;
  if (!def) fail("اللعبة انحذفت");
  const n = g.ids.length;
  const order = shuffle(g.ids);
  Object.assign(g, { secrets: {}, seen: [], alive: [...g.ids], votes: {}, out: [], round: (g.round || 0) + 1, endsAt: Date.now() + def.timerSeconds * 1000 });
  if (def.mechanic === "roles") {
    const deck = [];
    for (const r of def.roles) if (r.count > 0) for (let i = 0; i < r.count && deck.length < n; i++) deck.push(r);
    const rest = def.roles.find((r) => r.count === 0) || def.roles[def.roles.length - 1];
    while (deck.length < n) deck.push(rest);
    shuffle(deck).forEach((r, i) => { g.secrets[g.ids[i]] = { title: r.name, text: r.what }; });
    g.phase = "reveal";
  } else if (def.mechanic === "secret_word") {
    const word = def.words[randomInt(def.words.length)];
    const imp = new Set(order.slice(0, Math.min(def.impostors, Math.max(1, Math.floor((n - 1) / 2)))));
    for (const id of g.ids) g.secrets[id] = imp.has(id) ? { title: "أنت ما تعرف الكلمة", text: def.impostorText, impostor: true } : { title: word, text: "الكلمة السرية" };
    g.phase = "reveal";
  } else if (def.mechanic === "prompts") {
    Object.assign(g, { phase: "play", order, turn: 0, deck: shuffle(def.prompts.map((_, i) => i)), card: 0 });
  } else {
    Object.assign(g, { phase: "play", deck: shuffle(def.questions.map((_, i) => i)), card: 0, shown: false, total: {} });
  }
}

export function step(room, p, a, host) {
  const g = room.game;
  const def = get(g.customId)?.def;
  if (!def) fail("اللعبة انحذفت");
  const me = p.id;
  if (!g.ids.includes(me)) fail("أنت مو في هالجولة");
  const needHost = () => { if (!host) fail("هذا للمضيف فقط"); };
  switch (a.type) {
    case "seen":
      if (g.phase !== "reveal") fail("مو وقته");
      if (!g.seen.includes(me)) g.seen.push(me);
      if (g.seen.length === g.ids.length) { g.phase = "play"; g.endsAt = Date.now() + def.timerSeconds * 1000; }
      return;
    case "timer":
      needHost();
      g.endsAt = Date.now() + def.timerSeconds * 1000;
      return;
    case "toVote":
      needHost();
      if (!def.voting || g.phase !== "play" || !g.secrets[me]) fail("مو وقته");
      g.phase = "vote"; g.votes = {};
      return;
    case "vote": {
      if (g.phase !== "vote" || !g.alive.includes(me)) fail("مو وقته");
      if (a.targetId !== null && (!g.alive.includes(a.targetId) || a.targetId === me)) fail("اختيار غير صحيح");
      g.votes[me] = a.targetId;
      if (g.alive.every((id) => id in g.votes)) {
        const count = {};
        for (const t of Object.values(g.votes)) if (t) count[t] = (count[t] || 0) + 1;
        const max = Math.max(0, ...Object.values(count));
        const top = Object.keys(count).filter((k) => count[k] === max);
        if (top.length === 1) { g.alive = g.alive.filter((x) => x !== top[0]); g.out.push(top[0]); }
        g.lastOut = top.length === 1 ? top[0] : null;
        g.phase = "play";
        g.endsAt = Date.now() + def.timerSeconds * 1000;
      }
      return;
    }
    case "next": // prompts: the current player (or host) moves to the next player and card
      if (def.mechanic !== "prompts" || g.phase !== "play") fail("مو وقته");
      if (me !== g.order[g.turn % g.order.length] && !host) fail("مو دورك");
      g.turn++; g.card = (g.card + 1) % g.deck.length;
      g.endsAt = Date.now() + def.timerSeconds * 1000;
      return;
    case "show": // trivia
      needHost();
      if (def.mechanic !== "trivia" || g.phase !== "play") fail("مو وقته");
      g.shown = true;
      return;
    case "point": { // trivia: host gives the point (or nobody) and moves on
      needHost();
      if (def.mechanic !== "trivia" || !g.shown) fail("مو وقته");
      if (a.id) {
        if (!g.ids.includes(a.id)) fail("اختيار غير صحيح");
        g.total[a.id] = (g.total[a.id] || 0) + 1;
        const pl = room.players.find((x) => x.id === a.id);
        if (pl) pl.score += 1;
      }
      g.card++; g.shown = false;
      if (g.card >= g.deck.length) g.phase = "result";
      return;
    }
    case "end":
      needHost();
      if (g.phase === "howto" || g.phase === "result" || !g.secrets) fail("مو وقته"); // audit fix: never end an unstarted game
      g.phase = "result";
      return;
    case "again":
      needHost();
      if (g.phase !== "result") fail("مو وقته");
      return start(g);
    default:
      fail("طلب غير معروف");
  }
}

export function view(g, p) {
  const def = get(g.customId)?.def;
  if (!def) return { missing: true };
  const v = { mechanic: def.mechanic, name: def.name, voting: def.voting, round: g.round, msLeft: Math.max(0, g.endsAt - Date.now()) };
  if (def.mechanic === "roles" || def.mechanic === "secret_word") {
    Object.assign(v, { secret: g.secrets[p.id] ?? null, seen: g.seen, alive: g.alive, out: g.out, lastOut: g.lastOut ?? null });
    if (g.phase === "vote") Object.assign(v, { voted: Object.keys(g.votes), myVote: p.id in g.votes ? g.votes[p.id] : undefined });
    // eliminated players' secrets are public; everyone's is shown at the end
    // In secret-word games an eliminated non-impostor's card IS the word, so show only their side until the end.
    const label = (id) => (g.phase === "result" || def.mechanic === "roles" ? g.secrets[id]?.title : g.secrets[id]?.impostor ? "الدخيل" : "كان يعرف الكلمة");
    v.revealed = Object.fromEntries((g.phase === "result" ? g.ids : g.out).map((id) => [id, label(id)]));
  }
  if (def.mechanic === "prompts") Object.assign(v, { player: g.order[g.turn % g.order.length], prompt: def.prompts[g.deck[g.card]], count: g.turn + 1 });
  if (def.mechanic === "trivia" && g.phase !== "result") {
    const q = def.questions[g.deck[g.card]];
    Object.assign(v, { q: q.q, a: g.shown ? q.a : null, number: g.card + 1, of: g.deck.length });
  }
  if (def.mechanic === "trivia") v.total = g.total;
  return v;
}
