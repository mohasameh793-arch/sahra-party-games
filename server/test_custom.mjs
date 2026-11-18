// Run: node test_custom.mjs — checks AI output validation, duplicate detection and the generic engine,
// with a throwaway games file (no AI call, no network).
import assert from "node:assert/strict";
import { writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const file = join(mkdtempSync(join(tmpdir(), "sahra-test-")), "games.json");
const base = { ok: true, reason: "", line: "سطر", steps: ["خطوة ١", "خطوة ٢", "خطوة ٣"], minPlayers: 3, maxPlayers: 10, voting: true, timerSeconds: 60 };
const { validate } = await import("./ai.js");
const defs = {
  roles: validate({ ...base, name: "قاتل وشرطي", mechanic: "roles", roles: [{ name: "قاتل", what: "اقتل", count: 1 }, { name: "شرطي", what: "اكشف", count: 1 }, { name: "مواطن", what: "صوّت", count: 0 }] }),
  word: validate({ ...base, name: "الدخيل", mechanic: "secret_word", words: ["تفاح", "موز", "عنب", "خوخ", "رمان", "تين"], impostors: 1 }),
  prompts: validate({ ...base, name: "تحدي", mechanic: "prompts", prompts: Array.from({ length: 10 }, (_, i) => `تحدي ${i}`) }),
  trivia: validate({ ...base, name: "اسئلة", mechanic: "trivia", questions: Array.from({ length: 6 }, (_, i) => ({ q: `س${i}`, a: `ج${i}` })) }),
};
for (const [k, r] of Object.entries(defs)) assert.ok(r.ok, k);
assert.equal(validate({ ...base, ok: false, reason: "مو لعبة" }).ok, false);
assert.equal(validate({ ...base, name: "x", mechanic: "eval" }).ok, false, "unknown mechanic refused");
assert.equal(validate({ ...base, name: "x‮<script>", mechanic: "prompts", prompts: ["a"] }).ok, false, "too few prompts refused");
assert.ok(!validate({ ...base, name: "اسم‮مقلوب", mechanic: "prompts", prompts: Array(9).fill("x") }).def.name.includes("‮"), "bidi tricks stripped");

writeFileSync(file, JSON.stringify({ games: Object.entries(defs).map(([k, r], i) => ({ id: "c_test" + i, videoKey: k, videoId: "youtube:" + k, category: "saudi", def: r.def })), rejected: {} }));
process.env.CUSTOM_GAMES_FILE = file;
const C = await import("./customgame.js");
const L = await import("./logic.js");

assert.equal(C.findDuplicate({ name: "Werewolf", aliases: [] }), "الذيب");
assert.equal(C.findDuplicate({ name: "شي ثاني", aliases: ["المافيا"] }), "المافيا");
assert.equal(C.findDuplicate({ name: "تحدي", aliases: [] }), "تحدي", "existing custom game");
assert.equal(C.findDuplicate({ name: "لعبة جديدة تماما", aliases: ["brand new"] }), null);
assert.equal((await C.submit({ url: "https://evil.com/x", category: "saudi", ip: "t" })).error.includes("يوتيوب"), true);
assert.match((await C.submit({ url: "https://youtu.be/AAAAAAAAAAA", category: "saudi", ip: "t" })).error ?? "", /.+/); // no key in tests → fails safely
assert.match((await C.submit({ url: "https://www.youtube.com/watch?v=roles123456", category: "saudi", ip: "t2" })).error ?? "", /.+/);

function table(id, n) {
  const { room, player: h } = L.createRoom("h", "same");
  for (let i = 1; i < n; i++) L.decide(room, h, L.requestJoin(room.code, "p" + i).player.id, true);
  L.chooseGame(room, h, id);
  L.skipHowto(room, h);
  return { room, h, ps: room.players };
}

{ // roles: each phone sees only its own role; vote out one; all roles shown at the end
  const { room, h, ps } = table("c_test0", 5);
  const g = room.game;
  const roles = ps.map((p) => L.view(room, p).game.secret.title);
  assert.deepEqual(roles.filter((r) => r === "قاتل").length, 1);
  for (const p of ps) { const v = JSON.stringify(L.view(room, p).game); for (const q of ps) if (q !== p && g.secrets[q.id].title !== g.secrets[p.id].title) assert.ok(!v.includes(`"${q.id}":{"title"`)); }
  for (const p of ps) L.gameAction(room, p, { type: "seen" });
  L.gameAction(room, h, { type: "toVote" });
  for (const p of ps) L.gameAction(room, p, { type: "vote", targetId: p === ps[1] ? ps[2].id : ps[1].id });
  assert.deepEqual(g.out, [ps[1].id]);
  assert.equal(Object.keys(L.view(room, ps[3]).game.revealed).length, 1, "only the eliminated role is public");
  L.gameAction(room, h, { type: "end" });
  assert.equal(Object.keys(L.view(room, ps[3]).game.revealed).length, 5);
}
{ // secret word: impostor never sees the word
  const { room, ps } = table("c_test1", 4);
  const g = room.game;
  const imp = ps.filter((p) => g.secrets[p.id].impostor);
  assert.equal(imp.length, 1);
  const word = g.secrets[ps.find((p) => !g.secrets[p.id].impostor).id].title;
  assert.ok(!JSON.stringify(L.view(room, imp[0]).game).includes(word));
}
{ // prompts: only the current player (or host) moves on
  const { room, h, ps } = table("c_test2", 3);
  const g = room.game;
  const cur = g.order[0];
  const notCur = ps.find((p) => p.id !== cur && p.id !== h.id);
  if (notCur) assert.throws(() => L.gameAction(room, notCur, { type: "next" }), /دورك/);
  L.gameAction(room, h, { type: "next" });
  assert.equal(g.turn, 1);
}
{ // trivia: answer hidden until host shows it; host gives points
  const { room, h, ps } = table("c_test3", 3);
  const g = room.game;
  assert.equal(L.view(room, ps[1]).game.a, null);
  assert.throws(() => L.gameAction(room, ps[1], { type: "show" }), /للمضيف/);
  L.gameAction(room, h, { type: "show" });
  L.gameAction(room, h, { type: "point", id: ps[1].id });
  assert.equal(g.total[ps[1].id], 1);
}
{ // audit fix: "end" before the game started is refused, and views keep working
  const { room, player: h } = L.createRoom("h", "same");
  for (let i = 1; i < 3; i++) L.decide(room, h, L.requestJoin(room.code, "x" + i).player.id, true);
  L.chooseGame(room, h, "c_test0");
  assert.throws(() => L.gameAction(room, h, { type: "end" }), /وقته/);
  assert.throws(() => L.gameAction(room, h, { type: "again" }), /وقته/);
  for (const p of room.players) L.view(room, p); // must not throw
}
{ // code-review fix: voting out a word-holder must not reveal the word to the impostor
  const { room, h, ps } = table("c_test1", 5);
  const g = room.game;
  for (const p of ps) L.gameAction(room, p, { type: "seen" });
  const word = g.secrets[ps.find((p) => !g.secrets[p.id].impostor).id].title;
  const victim = ps.find((p) => !g.secrets[p.id].impostor && p !== h);
  L.gameAction(room, h, { type: "toVote" });
  for (const p of ps) L.gameAction(room, p, { type: "vote", targetId: p === victim ? h.id : victim.id });
  const imp = ps.find((p) => g.secrets[p.id].impostor);
  assert.ok(!JSON.stringify(L.view(room, imp).game).includes(word), "word stays secret after a vote-out");
}
console.log("custom game checks passed");
