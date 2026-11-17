// Run: node test.js — plays a full برا السالفة round through the logic and checks secrets never leak.
import assert from "node:assert/strict";
import * as L from "./logic.js";

const { room, player: host } = L.createRoom("مضيف", "same");
assert.match(room.code, /^\d{4}$/);
const a = L.requestJoin(room.code, "أحمد").player;
const b = L.requestJoin(room.code, "سارة").player;
const c = L.requestJoin(room.code, "ماجد").player;
assert.throws(() => L.requestJoin(room.code, "أحمد"), /هالاسم/);
assert.equal(L.view(room, a).players, undefined, "pending player sees no room data");
assert.throws(() => L.decide(room, a, b.id, true), /للمضيف/);
for (const p of [a, b, c]) L.decide(room, host, p.id, true);
assert.equal(room.players.length, 4);

assert.throws(() => L.chooseGame(room, host, "seenjeem"), /قريباً/);
L.chooseGame(room, host, "outsider");
for (const p of room.players) L.understood(room, p);
const g = room.game;
assert.equal(g.phase, "reveal");

// Secret check: outsider never sees the topic; nobody sees who the outsider is.
for (const p of room.players) {
  const v = JSON.stringify(L.view(room, p));
  assert.ok(!v.includes("outsiderId"), "nobody is told who the outsider is");
  if (p.id === g.outsiderId) assert.ok(!v.includes(g.topic), "outsider can't see topic");
  else assert.ok(v.includes(g.topic));
}

for (const p of room.players) L.gameAction(room, p, { type: "seen" });
assert.equal(g.phase, "questions");
const byId = (id) => room.players.find((p) => p.id === id);
assert.throws(() => L.gameAction(room, byId(g.turns[0][1]) === host ? a : byId(g.turns[0][1]), { type: "nextTurn" }), /دورك/);
while (g.phase === "questions") L.gameAction(room, byId(g.turns[g.turn][0]), { type: "nextTurn" });
assert.equal(g.phase, "vote");

// Everyone except the outsider votes for the outsider; outsider votes someone else.
const outsider = byId(g.outsiderId);
assert.throws(() => L.gameAction(room, outsider, { type: "vote", targetId: outsider.id }), /غير صحيح/);
for (const p of room.players) {
  const target = p === outsider ? room.players.find((x) => x !== outsider).id : outsider.id;
  L.gameAction(room, p, { type: "vote", targetId: target });
}
assert.equal(g.phase, "guess");
assert.throws(() => L.gameAction(room, host === outsider ? a : host, { type: "guess", option: g.topic }), /يخمّن/);
L.gameAction(room, outsider, { type: "guess", option: g.topic });
assert.equal(g.phase, "result");
assert.equal(outsider.score, 2);
assert.equal(room.players.filter((p) => p !== outsider).every((p) => p.score === 1), true);

L.gameAction(room, host, { type: "again" });
assert.equal(room.game.phase, "reveal");

L.removePlayer(room, host);
assert.notEqual(room.hostId, host.id, "host passes on");
assert.equal(room.game, null, "game ends when a player leaves");
// ---------- المافيا / الذيب ----------
import { evilCount } from "./nightgame.js";
assert.deepEqual([5, 6, 7, 9, 10, 13, 14, 20].map(evilCount), [1, 1, 2, 2, 3, 3, 4, 4]);

function table(gameId, n) {
  const { room, player: h } = L.createRoom("p0", "same");
  for (let i = 1; i < n; i++) L.decide(room, h, L.requestJoin(room.code, "p" + i).player.id, true);
  const small = L.createRoom("x", "same");
  assert.throws(() => L.chooseGame(small.room, small.player, gameId), /5/);
  L.chooseGame(room, h, gameId);
  L.skipHowto(room, h);
  for (const p of room.players) L.gameAction(room, p, { type: "seen" });
  return { room, h };
}
const who = (room, role) => room.players.filter((p) => room.game.roles[p.id] === role);

{ // Mafia: secrets, doctor save, detective, vote out, town win
  const { room, h } = table("mafia", 6);
  const g = room.game;
  assert.equal(g.phase, "night");
  const [m] = who(room, "mafia"), [doc] = who(room, "doctor"), [det] = who(room, "detective");
  const citizens = who(room, "citizen");
  for (const p of room.players) {
    const v = L.view(room, p).game;
    assert.equal(v.roles, undefined, "nobody sees all roles mid-game");
    if (p !== m) assert.equal(v.team, undefined, "only mafia sees the team");
  }
  assert.throws(() => L.gameAction(room, citizens[0], { type: "night", targetId: m.id }), /دور/);
  L.gameAction(room, m, { type: "night", targetId: citizens[0].id });
  L.gameAction(room, doc, { type: "night", targetId: citizens[0].id });
  L.gameAction(room, det, { type: "night", targetId: m.id });
  assert.equal(g.phase, "day");
  assert.equal(g.alive.length, 6, "doctor saved the target");
  assert.deepEqual(L.view(room, det).game.checks, [{ id: m.id, result: "mafia" }]);
  L.gameAction(room, h, { type: "toVote" });
  for (const p of room.players) L.gameAction(room, p, { type: "vote", targetId: p === m ? det.id : m.id });
  assert.equal(g.phase, "result");
  assert.equal(g.winner, "town");
  assert.equal(m.score, 0);
  assert.equal(det.score, 1);
}

{ // Wolf: guard can't repeat, hunter takes someone, wolves win on parity
  const { room, h } = table("dheeb", 7);
  const g = room.game;
  const wolves = who(room, "wolf"), [guard] = who(room, "guard"), [seer] = who(room, "seer"), [hun] = who(room, "hunter");
  assert.equal(wolves.length, 2);
  assert.ok(hun, "7 players get a hunter");
  for (const w of wolves) L.gameAction(room, w, { type: "night", targetId: hun.id });
  L.gameAction(room, guard, { type: "night", targetId: seer.id });
  L.gameAction(room, seer, { type: "night", targetId: wolves[0].id });
  assert.equal(g.phase, "hunter");
  assert.deepEqual(L.view(room, seer).game.checks, [{ id: wolves[0].id, result: "wolf" }]);
  assert.throws(() => L.gameAction(room, seer, { type: "shoot", targetId: guard.id }), /وقته/);
  L.gameAction(room, hun, { type: "shoot", targetId: guard.id });
  assert.equal(g.phase, "day");
  assert.equal(g.alive.length, 5);
  assert.equal(L.view(room, seer).game.dead[hun.id], "hunter", "dead roles are public");
  L.gameAction(room, h, { type: "toVote" });
  const villagers = who(room, "villager").filter((p) => g.alive.includes(p.id));
  for (const id of g.alive) L.gameAction(room, room.players.find((p) => p.id === id), { type: "vote", targetId: id === seer.id ? villagers[0].id : seer.id });
  // seer voted out → 2 wolves vs 2 villagers → wolves win
  assert.equal(g.phase, "result");
  assert.equal(g.winner, "evil");
}

// ---------- حزورة / أتوبيس كومبليت / صراحة ----------
import { norm, firstLetter } from "./arabic.js";
assert.equal(norm("الإبرة"), norm("ابره"));
assert.equal(norm("حرف الكاف"), norm("حرف كاف"));
assert.equal(firstLetter("السعودية"), "س");
assert.equal(firstLetter("أحمد"), "ا");

function quick(gameId, n) {
  const { room, player: h } = L.createRoom("h", "same");
  for (let i = 1; i < n; i++) L.decide(room, h, L.requestJoin(room.code, "q" + i).player.id, true);
  L.chooseGame(room, h, gameId);
  L.skipHowto(room, h);
  return { room, h, ps: room.players };
}

{ // حزورة: answers stay private, fastest correct gets 3, early timeup ignored
  const { room, h, ps } = quick("hazzoura", 3);
  const g = room.game;
  const right = g.riddles[0][1];
  L.gameAction(room, ps[1], { type: "answer", text: right });
  assert.ok(!JSON.stringify(L.view(room, ps[2])).includes(right), "nobody sees answers before the reveal");
  L.gameAction(room, ps[1], { type: "timeup" });
  assert.equal(g.phase, "ask", "early timeup ignored");
  assert.throws(() => L.gameAction(room, ps[1], { type: "answer", text: "x" }), /خلاص/);
  L.gameAction(room, ps[2], { type: "answer", text: "غلط أكيد" });
  L.gameAction(room, h, { type: "answer", text: "ال" + right });
  assert.equal(g.phase, "reveal");
  assert.deepEqual([ps[1], ps[2], h].map((p) => g.points[p.id] || 0), [3, 0, 2]);
  for (let i = 0; i < 9; i++) { L.gameAction(room, h, { type: "next" }); L.gameAction(room, h, { type: "next" }); }
  L.gameAction(room, h, { type: "next" });
  assert.equal(g.phase, "result");
}

{ // أتوبيس كومبليت: stop needs all boxes, scoring 10/5/0, 👎 majority, wrong letter
  const { room, h, ps } = quick("autobus", 3);
  const g = room.game;
  const L1 = g.letter;
  const full = (w) => Object.fromEntries(["boy", "girl", "animal", "plant", "thing", "country", "food"].map((c) => [c, L1 + w]));
  assert.throws(() => L.gameAction(room, h, { type: "stop" }), /الخانات/);
  L.gameAction(room, h, { type: "save", answers: full("مشترك") });
  L.gameAction(room, ps[1], { type: "save", answers: { ...full("مشترك"), food: L1 + "تاني" } });
  L.gameAction(room, ps[2], { type: "save", answers: { boy: "زززز" + L1, girl: L1 + "فيك" } });
  L.gameAction(room, h, { type: "stop" });
  assert.ok(g.stopAt);
  L.gameAction(room, h, { type: "score" }); // host moves to review
  assert.equal(g.phase, "review");
  L.gameAction(room, h, { type: "down", id: ps[2].id, cat: "girl" });
  L.gameAction(room, ps[1], { type: "down", id: ps[2].id, cat: "girl" });
  L.gameAction(room, h, { type: "score" });
  assert.equal(g.points[h.id].boy, 5, "shared answer = 5");
  assert.equal(g.points[ps[1].id].food, 10, "unique answer = 10");
  assert.equal(g.points[ps[2].id].boy, 0, "wrong first letter = 0");
  assert.equal(g.points[ps[2].id].girl, 0, "voted fake by 2 of 2 others = 0");
  assert.equal(g.points[ps[2].id].food, 0, "empty = 0");
}

{ // صراحة: host sees answers without names, hidden ones never shown
  const { room, h, ps } = quick("saraha", 3);
  const g = room.game;
  while (g.questions[g.index][0] !== "text") { g.index++; }
  for (const [i, p] of ps.entries()) L.gameAction(room, p, { type: "answer", value: "سر" + i });
  assert.equal(g.phase, "check");
  const hostList = L.view(room, h).game.list;
  assert.equal(hostList.length, 3);
  assert.ok(!JSON.stringify(hostList).match(new RegExp(ps.map((p) => p.id).join("|"))), "no author ids reach the host");
  assert.equal(L.view(room, ps[1]).game.list, null, "players wait while host checks");
  const hideIdx = hostList.findIndex((x) => x.value === "سر2");
  L.gameAction(room, h, { type: "hide", index: hideIdx });
  L.gameAction(room, h, { type: "show" });
  assert.deepEqual(L.view(room, ps[1]).game.list.sort(), ["سر0", "سر1"]);
}

console.log("all checks passed");
