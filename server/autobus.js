// أتوبيس كومبليت: a letter, 7 boxes, first to fill all calls it, everyone locks 3 s later.
// Then everyone sees all answers and can 👎 fakes; unique = 10, shared = 5, empty/wrong = 0. Five letters.
import { shuffle, fail } from "./util.js";
import { norm, firstLetter } from "./arabic.js";

export const CATS = ["boy", "girl", "animal", "plant", "thing", "country", "food"];
const LETTERS = [..."ابتجحخدرزسشصطعفقكلمنهوي"];
const ROUNDS = 5;
const WRITE_SECONDS = 150;
const STOP_GRACE = 3000;

export function start(g) {
  Object.assign(g, { letters: shuffle(LETTERS).slice(0, ROUNDS), round: -1, total: {} });
  newRound(g);
}

function newRound(g) {
  g.round++;
  if (g.round >= g.letters.length) { g.phase = "result"; return; }
  Object.assign(g, {
    phase: "write", letter: g.letters[g.round], endsAt: Date.now() + WRITE_SECONDS * 1000,
    stopAt: null, stoppedBy: null, answers: {}, downs: {}, points: null,
  });
}

const valid = (g, id, cat) => {
  const t = g.answers[id]?.[cat];
  if (!t || firstLetter(t) !== g.letter) return false;
  const others = g.ids.length - 1;
  return (g.downs[`${id}|${cat}`]?.length || 0) * 2 <= others; // more than half of the others said 👎 → out
};

function score(g, players) {
  const pts = {};
  for (const id of g.ids) pts[id] = {};
  for (const cat of CATS) {
    const seen = {};
    for (const id of g.ids) if (valid(g, id, cat)) { const k = norm(g.answers[id][cat]); seen[k] = (seen[k] || 0) + 1; }
    for (const id of g.ids) pts[id][cat] = valid(g, id, cat) ? (seen[norm(g.answers[id][cat])] > 1 ? 5 : 10) : 0;
  }
  for (const p of players) {
    if (!pts[p.id]) continue;
    const sum = Object.values(pts[p.id]).reduce((a, b) => a + b, 0);
    p.score += sum;
    g.total[p.id] = (g.total[p.id] || 0) + sum;
  }
  g.points = pts;
  g.phase = "score";
}

const deadline = (g) => g.stopAt ?? g.endsAt;

export function step(room, p, a, host) {
  const g = room.game;
  const me = p.id;
  if (!g.ids.includes(me)) fail("إنت مش في الجولة دي");
  switch (a.type) {
    case "save": {
      if (g.phase !== "write" || Date.now() > deadline(g) + 500) return; // late saves are dropped quietly
      const clean = {};
      for (const cat of CATS) clean[cat] = String(a.answers?.[cat] ?? "").trim().slice(0, 24);
      g.answers[me] = clean;
      return;
    }
    case "stop":
      if (g.phase !== "write" || g.stopAt) fail("مش وقته");
      if (!CATS.every((c) => g.answers[me]?.[c])) fail("كمّل كل الخانات الأول");
      g.stopAt = Date.now() + STOP_GRACE;
      g.stoppedBy = me;
      return;
    case "timeup":
      if (g.phase === "write" && Date.now() >= deadline(g) - 300) g.phase = "review";
      return;
    case "down": {
      if (g.phase !== "review") fail("مش وقته");
      if (a.id === me || !g.ids.includes(a.id) || !CATS.includes(a.cat)) fail("مينفعش");
      const k = `${a.id}|${a.cat}`;
      const list = (g.downs[k] ||= []);
      g.downs[k] = list.includes(me) ? list.filter((x) => x !== me) : [...list, me];
      return;
    }
    case "score":
      if (!host) fail("ده للمضيف بس");
      if (g.phase === "write") { g.phase = "review"; return; }
      if (g.phase !== "review") fail("مش وقته");
      return score(g, room.players);
    case "next":
      if (!host) fail("ده للمضيف بس");
      if (g.phase !== "score") fail("مش وقته");
      return newRound(g);
    case "again":
      if (!host) fail("ده للمضيف بس");
      if (g.phase !== "result") fail("مش وقته");
      return start(g);
    default:
      fail("طلب غير معروف");
  }
}

export function view(g, p) {
  const v = { round: g.round, rounds: g.letters.length, total: g.total, cats: CATS };
  if (g.phase === "result") return v;
  v.letter = g.letter;
  if (g.phase === "write") Object.assign(v, {
    msLeft: Math.max(0, deadline(g) - Date.now()), stopped: !!g.stopAt, stoppedBy: g.stoppedBy, mine: g.answers[p.id] ?? null,
  });
  else Object.assign(v, {
    answers: g.answers,
    // per answer: how many 👎, did I 👎 it, and does it start with the letter
    downs: Object.fromEntries(Object.entries(g.downs).map(([k, l]) => [k, { n: l.length, mine: l.includes(p.id) }])),
    wrongLetter: Object.fromEntries(g.ids.flatMap((id) => CATS.filter((c) => g.answers[id]?.[c] && firstLetter(g.answers[id][c]) !== g.letter).map((c) => [`${id}|${c}`, true]))),
    points: g.points,
  });
  return v;
}
