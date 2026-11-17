// صراحة: everyone answers the same question privately; the host may hide answers (still without names),
// then everyone sees them shuffled and nameless. Answers of a question are dropped when the next one starts.
import { shuffle, fail } from "./util.js";
import { SARAHA } from "./words.js";

export function start(g) {
  Object.assign(g, { questions: shuffle(SARAHA), index: -1 });
  next(g);
}

function next(g) {
  g.index++;
  if (g.index >= g.questions.length) { g.phase = "result"; return; }
  Object.assign(g, { phase: "answer", answers: {}, list: null });
}

function toCheck(g) {
  // Authors are dropped here: the list keeps only the content, in random order.
  g.list = shuffle(Object.values(g.answers)).map((value) => ({ value, hidden: false }));
  g.answers = {};
  g.phase = "check";
}

export function step(room, p, a, host) {
  const g = room.game;
  if (!g.ids.includes(p.id)) fail("إنت مش في الجولة دي");
  const [kind] = g.questions[g.index] ?? [];
  switch (a.type) {
    case "answer": {
      if (g.phase !== "answer") fail("مش وقته");
      if (g.answers[p.id] !== undefined) fail("جاوبت خلاص");
      let value;
      if (kind === "pick") {
        if (!g.ids.includes(a.value)) fail("اختار حد من اللي قاعدين");
        value = a.value;
      } else {
        value = String(a.value ?? "").trim().slice(0, 140);
        if (!value) fail("اكتب إجابتك");
      }
      g.answers[p.id] = value;
      if (g.ids.every((id) => g.answers[id] !== undefined)) toCheck(g);
      return;
    }
    case "force":
      if (!host) fail("ده للمضيف بس");
      if (g.phase !== "answer" || !Object.keys(g.answers).length) fail("مفيش إجابات لسه");
      return toCheck(g);
    case "hide":
      if (!host) fail("ده للمضيف بس");
      if (g.phase !== "check" || !Number.isInteger(a.index) || !g.list[a.index]) fail("مش وقته");
      g.list[a.index].hidden = !g.list[a.index].hidden;
      return;
    case "show":
      if (!host) fail("ده للمضيف بس");
      if (g.phase !== "check") fail("مش وقته");
      g.phase = "show";
      return;
    case "next":
      if (!host) fail("ده للمضيف بس");
      if (g.phase !== "show") fail("مش وقته");
      return next(g);
    case "again":
      if (!host) fail("ده للمضيف بس");
      return start(g);
    default:
      fail("طلب غير معروف");
  }
}

export function view(g, p, host) {
  if (g.phase === "result") return {};
  const [kind, question] = g.questions[g.index];
  const v = { kind, question, number: g.index + 1 };
  if (g.phase === "answer") Object.assign(v, { answered: Object.keys(g.answers).length, mine: g.answers[p.id] ?? null });
  if (g.phase === "check") v.list = host ? g.list : null;
  if (g.phase === "show") v.list = g.list.filter((x) => !x.hidden).map((x) => x.value);
  return v;
}
