// سين جيم: two teams, a board of 6 categories × 200/400/600. The team whose turn it is picks a cell
// (optionally with الحفرة), answers out loud or passes to the other team, then the answer is revealed
// and the host judges who got it. Helpers once per team: اتصل بصديق, جاوب جوابين, الحفرة.
import { shuffle, randomInt, fail, splitTeams } from "./util.js";
import { SEENJEEM } from "./words.js";

const TIERS = [200, 400, 600];
const SECONDS = 60;
const other = (t) => (t === "a" ? "b" : "a");

export function start(g) {
  const cats = shuffle(Object.keys(SEENJEEM)).slice(0, 6);
  Object.assign(g, {
    teams: splitTeams(g.ids),
    turn: "a",
    board: cats.map((cat) => ({ cat, cells: TIERS.map((pts) => { const qs = SEENJEEM[cat][pts]; const [q, a] = qs[randomInt(qs.length)]; return { pts, q, a, used: false, winner: null }; }) })),
    points: { a: 0, b: 0 },
    helpers: { a: { friend: true, two: true, pit: true }, b: { friend: true, two: true, pit: true } },
    phase: "board", cur: null,
  });
}

const teamOf = (g, id) => (g.teams.a.includes(id) ? "a" : "b");

function finishIfDone(g, players) {
  if (g.board.some((c) => c.cells.some((x) => !x.used))) { g.phase = "board"; return; }
  g.phase = "result";
  const w = g.points.a === g.points.b ? null : g.points.a > g.points.b ? "a" : "b";
  g.winner = w;
  if (w) for (const p of players) if (g.teams[w].includes(p.id)) p.score += 1;
}

export function step(room, p, a, host) {
  const g = room.game;
  if (!g.ids.includes(p.id)) fail("أنت مو في هالجولة");
  const mine = teamOf(g, p.id);
  switch (a.type) {
    case "pick": {
      if (g.phase !== "board") fail("مو وقته");
      if (mine !== g.turn) fail("مو دور فريقك");
      const col = g.board[a.col];
      const cell = Number.isInteger(a.col) && Number.isInteger(a.row) && col?.cells[a.row];
      if (!cell || cell.used) fail("اختر سؤال ثاني");
      const pit = !!a.pit;
      if (pit && !g.helpers[mine].pit) fail("استخدمتوا الحفرة");
      if (pit) g.helpers[mine].pit = false;
      g.cur = { col: a.col, row: a.row, pit, passed: false, two: false, friend: false, endsAt: Date.now() + SECONDS * 1000 };
      g.phase = "question";
      return;
    }
    case "helper": {
      if (g.phase !== "question" || mine !== g.turn) fail("مو وقته");
      if (a.name !== "friend" && a.name !== "two") fail("وسيلة غير معروفة");
      if (!g.helpers[mine][a.name]) fail("استخدمتوها قبل");
      g.helpers[mine][a.name] = false;
      g.cur[a.name] = true;
      if (a.name === "friend") g.cur.endsAt += 30_000;
      return;
    }
    case "pass": // turn team gives up; the other team may answer
      if (g.phase !== "question" || g.cur.passed) fail("مو وقته");
      if (mine !== g.turn && !host) fail("مو دور فريقك");
      g.cur.passed = true;
      g.cur.endsAt = Date.now() + 30_000;
      return;
    case "reveal":
      if (g.phase !== "question") fail("مو وقته");
      g.phase = "reveal";
      return;
    case "judge": { // host only: who answered correctly?
      if (!host) fail("هذا للمضيف فقط");
      if (g.phase !== "reveal") fail("مو وقته");
      const cell = g.board[g.cur.col].cells[g.cur.row];
      let w = a.winner === "turn" ? g.turn : a.winner === "other" && g.cur.passed ? other(g.turn) : null;
      if (a.winner === "other" && !g.cur.passed) fail("الفريق الثاني ما جاوب");
      cell.used = true;
      cell.winner = w;
      if (w) g.points[w] += cell.pts;
      if (w === g.turn && g.cur.pit) g.points[other(g.turn)] -= cell.pts; // الحفرة
      g.turn = other(g.turn);
      g.cur = null;
      finishIfDone(g, room.players);
      return;
    }
    case "again":
      if (!host) fail("هذا للمضيف فقط");
      if (g.phase !== "result") fail("مو وقته");
      return start(g);
    default:
      fail("طلب غير معروف");
  }
}

export function view(g, p) {
  const cur = g.cur && g.board[g.cur.col].cells[g.cur.row];
  return {
    teams: g.teams, myTeam: teamOf(g, p.id), turn: g.turn, points: g.points, helpers: g.helpers, winner: g.winner ?? null,
    board: g.board.map((c) => ({ cat: c.cat, cells: c.cells.map((x) => ({ pts: x.pts, used: x.used, winner: x.winner })) })),
    cur: g.cur && {
      cat: g.board[g.cur.col].cat, pts: cur.pts, pit: g.cur.pit, passed: g.cur.passed, two: g.cur.two, friend: g.cur.friend,
      msLeft: Math.max(0, g.cur.endsAt - Date.now()),
      q: g.phase === "question" || g.phase === "reveal" ? cur.q : null,
      a: g.phase === "reveal" ? cur.a : null, // the answer reaches phones only after "reveal"
    },
  };
}
