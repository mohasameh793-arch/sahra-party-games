// حزورة: 10 riddles, 30 s each, one private answer per player. Fastest correct answers score 3 / 2 / 1.
import { shuffle, fail } from "./util.js";
import { RIDDLES } from "./words.js";
import { norm } from "./arabic.js";

const COUNT = 10;
const SECONDS = 30;

export function start(g) {
  Object.assign(g, { riddles: shuffle(RIDDLES).slice(0, COUNT), index: -1, total: {} });
  next(g);
}

function next(g) {
  g.index++;
  if (g.index >= g.riddles.length) { g.phase = "result"; return; }
  Object.assign(g, { phase: "ask", endsAt: Date.now() + SECONDS * 1000, answers: {}, points: {} });
}

function reveal(g, players) {
  const correct = Object.entries(g.answers).filter(([, a]) => a.ok).sort((x, y) => x[1].at - y[1].at);
  correct.forEach(([id], i) => { g.points[id] = i === 0 ? 3 : i === 1 ? 2 : 1; });
  for (const p of players) if (g.points[p.id]) { p.score += g.points[p.id]; g.total[p.id] = (g.total[p.id] || 0) + g.points[p.id]; }
  g.phase = "reveal";
}

export function step(room, p, a, host) {
  const g = room.game;
  if (!g.ids.includes(p.id)) fail("أنت مو في هالجولة");
  switch (a.type) {
    case "answer": {
      if (g.phase !== "ask") fail("خلص الوقت");
      if (Date.now() > g.endsAt + 1000) fail("خلص الوقت");
      if (g.answers[p.id]) fail("جاوبت خلاص");
      const text = String(a.text ?? "").trim().slice(0, 40);
      if (!text) fail("اكتب جوابك");
      const [, ...accepted] = g.riddles[g.index];
      g.answers[p.id] = { text, at: Date.now(), ok: accepted.some((x) => norm(x) === norm(text)) };
      if (g.ids.every((id) => g.answers[id])) reveal(g, room.players);
      return;
    }
    case "timeup": // sent by phones when their countdown ends; ignored if it comes early
      if (g.phase === "ask" && Date.now() >= g.endsAt - 500) reveal(g, room.players);
      return;
    case "next":
      if (!host) fail("هذا للمضيف فقط");
      if (g.phase === "ask") return reveal(g, room.players);
      if (g.phase !== "reveal") fail("مو وقته");
      return next(g);
    case "again":
      if (!host) fail("هذا للمضيف فقط");
      if (g.phase !== "result") fail("مو وقته");
      return start(g);
    default:
      fail("طلب غير معروف");
  }
}

export function view(g, p) {
  const v = { index: g.index, count: g.riddles.length, total: g.total };
  if (g.phase === "result") return v;
  const [riddle, answer] = g.riddles[g.index];
  Object.assign(v, { riddle, answered: Object.keys(g.answers) });
  if (g.phase === "ask") Object.assign(v, { msLeft: Math.max(0, g.endsAt - Date.now()), myAnswer: g.answers[p.id]?.text ?? null });
  if (g.phase === "reveal") Object.assign(v, {
    answer,
    answers: g.ids.map((id) => ({ id, text: g.answers[id]?.text ?? null, ok: !!g.answers[id]?.ok, points: g.points[id] || 0 })),
  });
  return v;
}
