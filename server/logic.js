// Pure room + game logic. No sockets here, so test.js can drive it directly.
// Every secret lives only on the server; view() builds what ONE player may see.
import { OUTSIDER_TOPICS } from "./words.js";
import { id, shuffle, randomInt, GameError, fail } from "./util.js";
import * as Night from "./nightgame.js";
import * as Hazzoura from "./hazzoura.js";
import * as Autobus from "./autobus.js";
import * as Saraha from "./saraha.js";
import * as SeenJeem from "./seenjeem.js";
import * as KelmaSer from "./kelmaser.js";

// Every game except برا السالفة is a module with start(g), step(room, p, action, isHost), view(g, p, isHost).
const IMPL = { mafia: Night, dheeb: Night, hazzoura: Hazzoura, autobus: Autobus, saraha: Saraha, seenjeem: SeenJeem, kelmaser: KelmaSer };

export { GameError };
export const MAX_PLAYERS = 20;
const MAX_PENDING = 10;

// ponytail: rooms live in memory, a server restart ends all games. Move to Redis if we run more than one server.
export const rooms = new Map();

export function cleanName(name) {
  const n = String(name ?? "").replace(/\s+/g, " ").trim().slice(0, 20);
  if (!n) fail("اكتب اسمك");
  return n;
}

function newCode() {
  for (let i = 0; i < 50; i++) {
    const c = String(randomInt(10000)).padStart(4, "0");
    if (!rooms.has(c)) return c;
  }
  fail("السيرفر مشغول، جرّب بعد شوي");
}

export function createRoom(name, mode) {
  if (mode !== "same" && mode !== "remote") fail("اختر نوع الجلسة");
  const host = { id: id(4), token: id(16), name: cleanName(name), score: 0, connected: true };
  const room = { code: newCode(), mode, hostId: host.id, players: [host], pending: [], game: null, emptySince: null };
  rooms.set(room.code, room);
  return { room, player: host };
}

export function getRoom(code) {
  const room = rooms.get(String(code ?? ""));
  if (!room) fail("ما فيه غرفة بهالرقم");
  return room;
}

export function requestJoin(code, name) {
  const room = getRoom(code);
  const n = cleanName(name);
  if (room.players.length >= MAX_PLAYERS) fail("الغرفة ممتلئة");
  if (room.pending.length >= MAX_PENDING) fail("فيه طلبات كثيرة، انتظر شوي");
  if ([...room.players, ...room.pending].some((p) => p.name === n)) fail("هالاسم موجود، اختر اسم ثاني");
  const p = { id: id(4), token: id(16), name: n, score: 0, connected: true };
  room.pending.push(p);
  return { room, player: p };
}

/** Finds a player (or a pending one) by its secret token. */
export function byToken(room, token) {
  return room.players.find((p) => p.token === token) || room.pending.find((p) => p.token === token) || null;
}

const isHost = (room, p) => room.hostId === p.id;
const needHost = (room, p) => { if (!isHost(room, p)) fail("هذا للمضيف فقط"); };
const inRoom = (room, p) => { if (!room.players.includes(p)) fail("انتظر المضيف يقبلك"); };

export function decide(room, host, pendingId, accept) {
  needHost(room, host);
  const i = room.pending.findIndex((p) => p.id === pendingId);
  if (i < 0) fail("الطلب غير موجود");
  if (accept && room.players.length >= MAX_PLAYERS) fail("الغرفة ممتلئة"); // check before removing the request
  const [p] = room.pending.splice(i, 1);
  if (accept) room.players.push(p);
  return p;
}

export function removePlayer(room, p) {
  room.pending = room.pending.filter((x) => x !== p);
  const i = room.players.indexOf(p);
  if (i < 0) return;
  room.players.splice(i, 1);
  if (room.hostId === p.id && room.players[0]) room.hostId = room.players[0].id;
  // A game can't continue fairly without one of its players.
  if (room.game?.ids.includes(p.id)) room.game = null;
  if (!room.players.length) rooms.delete(room.code);
}

export function kick(room, host, targetId) {
  needHost(room, host);
  const t = room.players.find((p) => p.id === targetId);
  if (!t || t === host) fail("ما تقدر تطرد هذا اللاعب");
  removePlayer(room, t);
  return t;
}

// ---------- games ----------
export const GAMES = {
  outsider: { category: "saudi", min: 3, ready: true },
  dheeb: { category: "saudi", min: 5, ready: true },
  seenjeem: { category: "saudi", min: 2, ready: true },
  hazzoura: { category: "saudi", min: 2, ready: true },
  mafia: { category: "saudi", min: 5, ready: true },
  autobus: { category: "egypt", min: 2, ready: true },
  kelmaser: { category: "egypt", min: 4, ready: true },
  saraha: { category: "egypt", min: 3, ready: true },
};

export function chooseGame(room, host, gameId) {
  needHost(room, host);
  const g = Object.hasOwn(GAMES, gameId) ? GAMES[gameId] : null;
  if (!g) fail("لعبة غير معروفة");
  if (!g.ready) fail("هذي اللعبة قريباً");
  if (room.players.length < g.min) fail(`تحتاج ${g.min} لاعبين على الأقل`);
  // Everyone reads the "how to play" card first.
  room.game = { gameId, phase: "howto", ids: room.players.map((p) => p.id), understood: [] };
}

export function understood(room, p) {
  inRoom(room, p);
  const g = room.game;
  if (!g || g.phase !== "howto" || !g.ids.includes(p.id)) fail("مو وقته");
  if (!g.understood.includes(p.id)) g.understood.push(p.id);
  if (g.understood.length === g.ids.length) startGame(room);
}

export function skipHowto(room, host) {
  needHost(room, host);
  if (room.game?.phase !== "howto") fail("مو وقته");
  startGame(room);
}

const startGame = (room) => (room.game.gameId === "outsider" ? startOutsider(room) : IMPL[room.game.gameId].start(room.game));

export function endGame(room, host) {
  needHost(room, host);
  room.game = null;
}

// ---------- برا السالفة ----------
function startOutsider(room) {
  const g = room.game;
  const category = shuffle(Object.keys(OUTSIDER_TOPICS))[0];
  const topics = OUTSIDER_TOPICS[category];
  const topic = topics[randomInt(topics.length)];
  const order = shuffle(g.ids);
  // Each player asks the next one in a shuffled circle, twice around.
  const turns = [];
  for (let r = 0; r < 2; r++) for (let i = 0; i < order.length; i++) turns.push([order[i], order[(i + 1) % order.length]]);
  const options = shuffle([topic, ...shuffle(topics.filter((t) => t !== topic)).slice(0, 5)]);
  Object.assign(g, {
    phase: "reveal", category, topic, options,
    outsiderId: g.ids[randomInt(g.ids.length)],
    seen: [], turns, turn: 0, votes: {}, guess: null, result: null,
  });
}

function outsiderStep(room, p, action) {
  const g = room.game;
  if (!g || g.gameId !== "outsider") fail("ما فيه لعبة");
  if (!g.ids.includes(p.id)) fail("أنت مو في هالجولة");
  const host = isHost(room, p);
  switch (action.type) {
    case "seen":
      if (g.phase !== "reveal") fail("مو وقته");
      if (!g.seen.includes(p.id)) g.seen.push(p.id);
      if (g.seen.length === g.ids.length) g.phase = "questions";
      return;
    case "nextTurn": {
      if (g.phase !== "questions") fail("مو وقته");
      const [asker] = g.turns[g.turn];
      if (p.id !== asker && !host) fail("مو دورك");
      g.turn++;
      if (g.turn >= g.turns.length) g.phase = "vote";
      return;
    }
    case "toVote":
      needHost(room, p);
      if (g.phase !== "questions") fail("مو وقته");
      g.phase = "vote";
      return;
    case "vote": {
      if (g.phase !== "vote") fail("مو وقته");
      if (action.targetId === p.id || !g.ids.includes(action.targetId)) fail("اختيار غير صحيح");
      g.votes[p.id] = action.targetId;
      if (Object.keys(g.votes).length === g.ids.length) tallyOutsider(room);
      return;
    }
    case "guess":
      if (g.phase !== "guess") fail("مو وقته");
      if (p.id !== g.outsiderId) fail("بس اللي برا السالفة يخمّن");
      if (!g.options.includes(action.option)) fail("اختيار غير صحيح");
      g.guess = action.option;
      finishOutsider(room);
      return;
    case "again":
      needHost(room, p);
      if (g.phase !== "result") fail("مو وقته");
      g.phase = "howto"; // skipped straight away: everyone already knows the rules
      startOutsider(room);
      return;
    default:
      fail("طلب غير معروف");
  }
}

function tallyOutsider(room) {
  const g = room.game;
  const count = {};
  for (const t of Object.values(g.votes)) count[t] = (count[t] || 0) + 1;
  const max = Math.max(...Object.values(count));
  const top = Object.keys(count).filter((k) => count[k] === max);
  g.accusedId = top.length === 1 ? top[0] : null; // a tie means nobody is caught
  g.caught = g.accusedId === g.outsiderId;
  if (g.caught) g.phase = "guess";
  else finishOutsider(room);
}

function finishOutsider(room) {
  const g = room.game;
  const points = {};
  for (const [voter, target] of Object.entries(g.votes)) if (target === g.outsiderId && voter !== g.outsiderId) points[voter] = 1;
  if (!g.caught) points[g.outsiderId] = 3;
  else if (g.guess === g.topic) points[g.outsiderId] = 2;
  for (const p of room.players) p.score += points[p.id] || 0;
  g.result = { points };
  g.phase = "result";
}

export function gameAction(room, p, action) {
  inRoom(room, p);
  if (!action || typeof action.type !== "string") fail("طلب غير معروف");
  if (room.game?.gameId === "outsider") outsiderStep(room, p, action);
  else if (room.game) IMPL[room.game.gameId].step(room, p, action, isHost(room, p));
  else fail("ما فيه لعبة");
}

// ---------- what one player may see ----------
export function view(room, p) {
  const accepted = room.players.includes(p);
  const base = {
    code: room.code, mode: room.mode,
    you: { id: p.id, name: p.name, isHost: isHost(room, p), waiting: !accepted },
  };
  if (!accepted) return base;
  const g = room.game;
  return {
    ...base,
    players: room.players.map((x) => ({ id: x.id, name: x.name, score: x.score, connected: x.connected, isHost: isHost(room, x) })),
    pending: isHost(room, p) ? room.pending.map((x) => ({ id: x.id, name: x.name })) : [],
    game: g ? gameView(g, p, isHost(room, p)) : null,
  };
}

function gameView(g, p, host) {
  const v = { gameId: g.gameId, phase: g.phase, playing: g.ids.includes(p.id), ids: g.ids };
  if (g.phase === "howto") return { ...v, understood: g.understood };
  if (g.gameId !== "outsider") return { ...v, ...IMPL[g.gameId].view(g, p, host) };
  const me = p.id === g.outsiderId;
  Object.assign(v, {
    category: g.category,
    secret: v.playing ? (me ? { outsider: true } : { outsider: false, topic: g.topic }) : null,
    seen: g.seen,
  });
  if (g.phase === "questions") v.turn = { index: g.turn, total: g.turns.length, asker: g.turns[g.turn][0], target: g.turns[g.turn][1] };
  if (g.phase === "vote") v.voted = Object.keys(g.votes), v.myVote = g.votes[p.id] || null;
  if (g.phase === "guess") Object.assign(v, { accusedId: g.accusedId, options: me ? g.options : null });
  if (g.phase === "result") Object.assign(v, {
    outsiderId: g.outsiderId, topic: g.topic, votes: g.votes, accusedId: g.accusedId,
    caught: g.caught, guess: g.guess, points: g.result.points,
  });
  return v;
}
