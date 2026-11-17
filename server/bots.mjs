// Dev helper: `node bots.mjs <code> [count] [skip]` adds bot players that auto-play every ready game, for testing with one browser.
import { createRequire } from "node:module";
const require = createRequire(new URL("../app/package.json", import.meta.url));
const { io } = require("socket.io-client");

const [code, count = 2, skip = 0] = process.argv.slice(2);
const names = ["أحمد", "سارة", "ماجد", "نورة", "خالد", "سلمان", "ريم"];
for (let i = Number(skip); i < Number(skip) + Number(count); i++) {
  const s = io(process.env.SERVER || "http://localhost:3005", { transports: ["websocket"] });
  const name = names[i];
  s.on("connect", () => s.emit("join", { code, name }, (r) => console.log(name, "join", r.error || "requested")));
  s.on("state", (st) => {
    const g = st.game;
    if (!g || !g.playing) return;
    const later = (ev, d) => setTimeout(() => s.emit(ev, d, (r) => r?.error && console.log(name, ev, r.error)), 600);
    if (g.phase === "howto" && !g.understood.includes(st.you.id)) later("understood");
    if (g.phase === "reveal" && g.seen && !g.seen.includes(st.you.id)) later("action", { type: "seen" });
    // المافيا / الذيب
    const me = st.you.id, alive = g.alive || [], pick = (ids) => ids[Math.floor(Math.random() * ids.length)];
    if (g.phase === "night" && alive.includes(me) && !g.myPick && ["mafia", "wolf", "doctor", "guard", "detective", "seer"].includes(g.role)) {
      const ids = g.team ? alive.filter((x) => !g.team.includes(x)) : g.role === "doctor" || g.role === "guard" ? alive.filter((x) => x !== g.lastProtect) : alive.filter((x) => x !== me);
      later("action", { type: "night", targetId: pick(ids) });
    }
    if (g.gameId !== "outsider" && g.phase === "vote" && alive.includes(me) && g.myVote === undefined) later("action", { type: "vote", targetId: pick(alive.filter((x) => x !== me)) });
    if (g.phase === "hunter" && g.hunterId === me) later("action", { type: "shoot", targetId: pick(alive.filter((x) => x !== me)) });
    if (g.gameId === "hazzoura" && g.phase === "ask" && !g.answered.includes(me)) later("action", { type: "answer", text: ["مشط", "قلم", "ما أدري", "باب"][Math.floor(Math.random() * 4)] });
    if (g.gameId === "autobus" && g.phase === "write" && !g.mine) later("action", { type: "save", answers: Object.fromEntries(g.cats.map((c, k) => [c, k % 3 ? g.letter + "ـ" + name.slice(0, 2) + k : ""])) });
    if (g.gameId === "saraha" && g.phase === "answer" && g.mine === null) later("action", { type: "answer", value: g.kind === "pick" ? pick(g.ids) : `${name} يقول: بصراحة مش عارف` });
    if (g.gameId !== "outsider") return;
    if (g.phase === "questions" && g.turn.asker === st.you.id) later("action", { type: "nextTurn" });
    if (g.phase === "vote" && !g.myVote) later("action", { type: "vote", targetId: g.ids.find((x) => x !== st.you.id) });
    if (g.phase === "guess" && g.options) later("action", { type: "guess", option: g.options[0] });
  });
}
