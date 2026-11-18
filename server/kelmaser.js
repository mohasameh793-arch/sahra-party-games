// كلمة سر: two teams. For each word, one clue giver per team sees it. Givers take turns giving one-word
// clues to their own team. Guessed on clue n = 11 - n points (10, 9, ... 1). A wrong guess, or a foul
// called by the other team, passes the turn. First team to 50 wins. Givers rotate every word.
import { shuffle, fail, splitTeams } from "./util.js";
import { KELMASER } from "./words.js";

const TARGET = 50;
const MAX_CLUES = 10;
const other = (t) => (t === "a" ? "b" : "a");

export function start(g) {
  Object.assign(g, {
    teams: splitTeams(g.ids), words: shuffle(KELMASER), index: -1, points: { a: 0, b: 0 },
    starter: "b", winner: null,
  });
  nextWord(g);
}

function nextWord(g) {
  g.index++;
  if (g.index >= g.words.length) { g.words = shuffle(KELMASER); g.index = 0; }
  const round = Math.floor(g.index);
  g.starter = other(g.starter); // the team that gives the first clue alternates
  g.givers = { a: g.teams.a[round % g.teams.a.length], b: g.teams.b[round % g.teams.b.length] };
  Object.assign(g, { phase: "play", active: g.starter, clues: 1, last: null });
}

const teamOf = (g, id) => (g.teams.a.includes(id) ? "a" : "b");

function pass(g) {
  if (g.clues >= MAX_CLUES) { g.last = { word: g.words[g.index], team: null, pts: 0 }; g.phase = "between"; return; }
  g.clues++;
  g.active = other(g.active);
}

export function step(room, p, a, host) {
  const g = room.game;
  if (!g.ids.includes(p.id)) fail("إنت مش في الجولة دي");
  const mine = teamOf(g, p.id);
  switch (a.type) {
    case "got": { // the active giver confirms their team said the word
      if (g.phase !== "play" || p.id !== g.givers[g.active]) fail("ده لمدّي الإشارة بس");
      const pts = MAX_CLUES + 1 - g.clues;
      g.points[g.active] += pts;
      g.last = { word: g.words[g.index], team: g.active, pts };
      if (g.points[g.active] >= TARGET) {
        g.winner = g.active;
        for (const pl of room.players) if (g.teams[g.winner].includes(pl.id)) pl.score += 1;
        g.phase = "result";
      } else g.phase = "between";
      return;
    }
    case "miss": // the active giver says their team guessed wrong
      if (g.phase !== "play" || p.id !== g.givers[g.active]) fail("ده لمدّي الإشارة بس");
      return pass(g);
    case "foul": // the other team says the clue broke the rules
      if (g.phase !== "play" || mine === g.active) fail("ده للفريق التاني بس");
      return pass(g);
    case "next":
      if (!host) fail("ده للمضيف بس");
      if (g.phase !== "between") fail("مش وقته");
      return nextWord(g);
    case "again":
      if (!host) fail("ده للمضيف بس");
      if (g.phase !== "result") fail("مش وقته");
      return start(g);
    default:
      fail("طلب غير معروف");
  }
}

export function view(g, p) {
  const giver = g.givers.a === p.id || g.givers.b === p.id;
  return {
    teams: g.teams, myTeam: teamOf(g, p.id), points: g.points, target: TARGET, givers: g.givers,
    active: g.active, clues: g.clues, worth: MAX_CLUES + 1 - g.clues, last: g.last, winner: g.winner,
    // only the two clue givers see the word while it is being played
    word: g.phase === "play" ? (giver ? g.words[g.index] : null) : g.last?.word ?? null,
  };
}
