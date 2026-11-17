// المافيا (Egypt) and الذيب (Saudi): one night/day engine, two role sets.
// Flow: reveal → night → [hunter] → day → vote → [hunter] → verdict → night … → result
import { shuffle, randomInt, fail } from "./util.js";

const SETS = {
  mafia: { evil: "mafia", protect: "doctor", check: "detective", plain: "citizen", hunter: null, checkShowsRole: false },
  dheeb: { evil: "wolf", protect: "guard", check: "seer", plain: "villager", hunter: "hunter", checkShowsRole: true },
};

/** How many mafia/wolves for n players (≈ 1 per 3–4 players). */
export const evilCount = (n) => (n <= 6 ? 1 : n <= 9 ? 2 : n <= 13 ? 3 : 4);

export function start(g) {
  const set = SETS[g.gameId];
  const n = g.ids.length;
  const roles = [...Array(evilCount(n)).fill(set.evil), set.protect, set.check];
  if (set.hunter && n >= 7) roles.push(set.hunter);
  while (roles.length < n) roles.push(set.plain);
  const dealt = shuffle(roles);
  Object.assign(g, {
    phase: "reveal", seen: [],
    roles: Object.fromEntries(g.ids.map((id, i) => [id, dealt[i]])),
    alive: [...g.ids], round: 0, lastProtect: null, checks: {},
    night: null, votes: {}, news: [], hunterId: null, afterHunter: null, winner: null,
  });
}

const set = (g) => SETS[g.gameId];
const isEvil = (g, id) => g.roles[id] === set(g).evil;
const alive = (g, id) => g.alive.includes(id);
const holder = (g, role) => g.alive.find((id) => g.roles[id] === role) || null;

function startNight(g) {
  g.phase = "night";
  g.round++;
  g.night = { kill: {}, protect: null, check: null };
}

function nightDone(g) {
  const s = set(g);
  const evils = g.alive.filter((id) => isEvil(g, id));
  return evils.every((id) => g.night.kill[id]) &&
    (!holder(g, s.protect) || g.night.protect) &&
    (!holder(g, s.check) || g.night.check);
}

function die(g, id, kind) {
  g.alive = g.alive.filter((x) => x !== id);
  g.news.push({ kind, id, role: g.roles[id] });
}

/** Ends the game if a side has won; returns true when it did. */
function checkWin(g, players) {
  const evil = g.alive.filter((id) => isEvil(g, id)).length;
  const others = g.alive.length - evil;
  if (evil && evil < others) return false;
  g.winner = evil ? "evil" : "town";
  for (const p of players) if (g.ids.includes(p.id) && isEvil(g, p.id) === (g.winner === "evil")) p.score += 1;
  g.phase = "result";
  return true;
}

function after(g, players, next) {
  if (checkWin(g, players)) return;
  if (next === "night") startNight(g);
  else g.phase = next;
}

function resolveNight(g, players) {
  const s = set(g);
  g.news = [];
  // The pack's target is the most-picked player; a tie is broken at random.
  const count = {};
  for (const t of Object.values(g.night.kill)) count[t] = (count[t] || 0) + 1;
  const max = Math.max(0, ...Object.values(count));
  const top = Object.keys(count).filter((k) => count[k] === max);
  const target = top.length ? top[randomInt(top.length)] : null;
  if (g.night.check) {
    const checker = holder(g, s.check);
    const t = g.night.check;
    (g.checks[checker] ||= []).push({ id: t, result: s.checkShowsRole ? g.roles[t] : isEvil(g, t) ? s.evil : "innocent" });
  }
  g.lastProtect = g.night.protect;
  if (target && target !== g.night.protect) die(g, target, "night");
  else g.news.push({ kind: "night", id: null, saved: !!target });
  if (target && target !== g.night.protect && g.roles[target] === s.hunter) return hunter(g, target, "day");
  after(g, players, "day");
}

function hunter(g, id, next) {
  g.phase = "hunter";
  g.hunterId = id;
  g.afterHunter = next;
}

function tallyVote(g, players) {
  g.news = [];
  const count = {};
  for (const t of Object.values(g.votes)) if (t) count[t] = (count[t] || 0) + 1;
  const max = Math.max(0, ...Object.values(count));
  const top = Object.keys(count).filter((k) => count[k] === max);
  const out = top.length === 1 ? top[0] : null; // tie or nobody voted = nobody leaves
  if (out) die(g, out, "vote");
  else g.news.push({ kind: "vote", id: null });
  g.lastVotes = { ...g.votes };
  if (out && g.roles[out] === set(g).hunter) return hunter(g, out, "verdict");
  after(g, players, "verdict");
}

export function step(room, p, a, host) {
  const g = room.game;
  const s = set(g);
  const players = room.players;
  const me = p.id;
  const target = a.targetId;
  const needAlive = () => { if (!alive(g, me)) fail("أنت طالع من اللعبة"); };
  const validTarget = () => { if (!alive(g, target)) fail("اختيار غير صحيح"); };
  if (!g.ids.includes(me)) fail("أنت مو في هالجولة");

  switch (a.type) {
    case "seen":
      if (g.phase !== "reveal") fail("مو وقته");
      if (!g.seen.includes(me)) g.seen.push(me);
      if (g.seen.length === g.ids.length) startNight(g);
      return;
    case "night": {
      if (g.phase !== "night") fail("مو وقته");
      needAlive();
      validTarget();
      const role = g.roles[me];
      if (role === s.evil) {
        if (isEvil(g, target)) fail("ما تقدر تختار واحد من فريقك");
        g.night.kill[me] = target;
      } else if (role === s.protect) {
        if (target === g.lastProtect) fail("ما تقدر تحمي نفس الشخص ليلتين ورا بعض");
        g.night.protect = target;
      } else if (role === s.check) {
        if (target === me) fail("اختر واحد غيرك");
        g.night.check = target;
      } else fail("ما عندك دور بالليل");
      if (nightDone(g)) resolveNight(g, players);
      return;
    }
    case "toVote":
      if (!host) fail("هذا للمضيف فقط");
      if (g.phase !== "day") fail("مو وقته");
      g.phase = "vote";
      g.votes = {};
      return;
    case "vote":
      if (g.phase !== "vote") fail("مو وقته");
      needAlive();
      if (target !== null) { validTarget(); if (target === me) fail("ما تقدر تصوّت على نفسك"); }
      g.votes[me] = target;
      if (g.alive.every((id) => id in g.votes)) tallyVote(g, players);
      return;
    case "shoot":
      if (g.phase !== "hunter" || me !== g.hunterId) fail("مو وقته");
      validTarget();
      die(g, target, "hunter");
      g.hunterId = null;
      after(g, players, g.afterHunter);
      return;
    case "force": // host unblocks a night or vote stuck on a player who left the table
      if (!host) fail("هذا للمضيف فقط");
      if (g.phase === "night") return resolveNight(g, players);
      if (g.phase === "vote") return tallyVote(g, players);
      if (g.phase === "hunter") { g.hunterId = null; return after(g, players, g.afterHunter); } // hunter left: no shot
      fail("مو وقته");
      return;
    case "toNight":
      if (!host) fail("هذا للمضيف فقط");
      if (g.phase !== "verdict") fail("مو وقته");
      startNight(g);
      return;
    case "again":
      if (!host) fail("هذا للمضيف فقط");
      if (g.phase !== "result") fail("مو وقته");
      start(g);
      return;
    default:
      fail("طلب غير معروف");
  }
}

/** What one player may see. Roles of the living stay hidden; the dead are revealed. */
export function view(g, p) {
  const me = p.id;
  const s = set(g);
  const role = g.roles[me];
  const v = {
    role: role ?? null,
    alive: g.alive,
    round: g.round,
    dead: Object.fromEntries(g.ids.filter((id) => !alive(g, id)).map((id) => [id, g.roles[id]])),
    seen: g.seen,
    news: g.news,
  };
  if (role === s.evil) v.team = g.ids.filter((id) => isEvil(g, id));
  if (role === s.check) v.checks = g.checks[me] || [];
  if (role === s.protect) v.lastProtect = g.lastProtect;
  if (g.phase === "night") {
    const mine = role === s.evil ? g.night.kill[me] : role === s.protect ? g.night.protect : role === s.check ? g.night.check : null;
    v.myPick = mine ?? null;
    if (role === s.evil) v.teamPicks = g.night.kill;
  }
  if (g.phase === "vote") Object.assign(v, { voted: Object.keys(g.votes), myVote: me in g.votes ? g.votes[me] : undefined });
  if (g.phase === "verdict") v.votes = g.lastVotes;
  if (g.phase === "hunter") v.hunterId = g.hunterId;
  if (g.phase === "result") Object.assign(v, { winner: g.winner, roles: g.roles });
  return v;
}
