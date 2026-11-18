# سهرة — Party Games App (working name)

## 1. What it is
Arabic party-games app for friends. The host creates a room → 4-digit code → friends type it → the host accepts each one → the host picks a category (Saudi / Egyptian) and a game → every phone shows a "how to play" card → the game runs, with each phone getting only its own secret.
- Android = real APK (not built yet). iPhone = home-screen web app (Safari → Share → Add to Home Screen; full screen, own icon). The user won't pay Apple's $99/yr.
- Arabic only (Saudi dialect in Saudi games, Egyptian in Egyptian games). Built-in voice for "everyone at home" mode is planned (not built).
- **Works now (6 of 8 games):** rooms, code, join requests, accept/reject/kick, host hand-over, reconnect after refresh, how-to cards for all 8 games; playable (all 8): **برا السالفة**, **الذيب**, **حزورة**, **المافيا**, **سين جيم** (Saudi) and **أتوبيس كومبليت**, **صراحة**, **كلمة سر** (Egyptian).
- **LIVE:** https://mohasameh793-arch.github.io/sahra-party-games/ (app, GitHub Pages) → game server https://158-101-253-75.sslip.io (Oracle). Full game verified over the internet 2026-11-18.
- **Not done:** voice for "everyone at home" mode.

## 2. Where everything lives
- `C:\Users\Majesty\Desktop\party_games_app\`
  - `BLUEPRINT.md`: full product plan + rules of all 8 games.
  - `server/`: Node game server (socket.io). `logic.js` = rooms + برا السالفة + `view()` (what one player may see), `nightgame.js` = shared المافيا/الذيب engine (role sets, night/day/vote/hunter), `util.js` = helpers, `index.js` = sockets + serves `app/dist`, `words.js` = برا السالفة topics, `test.js` = self-check, `bots.mjs <code> [count] [skip]` = test bots that play every ready game.
  - `app/src/Night.tsx`: المافيا + الذيب screens (one file, dialect text from `TALK` in content.ts). `Hazzoura.tsx`, `Autobus.tsx`, `Saraha.tsx`: the other games. `ui.tsx` has `useCountdown` (server sends msLeft, phone counts locally) and `GameTop`.
  - `server/hazzoura.js` (riddles 3/2/1), `server/autobus.js` (letter, STOP, thumbs-down review, 10/5/0), `server/saraha.js` (anonymous answers, host check), `server/arabic.js` (answer normalisation); riddles + صراحة questions in `words.js`.
  - `server/test_socket.mjs`: starts the real server and checks the security-audit fixes.
  - Security audit run 1: `C:\Users\Majesty\security-audit-skill\party_games_app\run-1\` (read `REPORT.md`).
  - `app/`: Expo SDK 58 app (own nested git repo from create-expo-app). `App.tsx` picks the screen from server state; `src/net.ts` socket; `src/ui.tsx` look; `src/screens.tsx` Home/Waiting/Lobby/HowTo; `src/Outsider.tsx` برا السالفة; `src/content.ts` game list + how-to text; `public/` iPhone home-screen manifest/icons.
  - `scripts/make_icon.py`: draws the Sadu icon into app/assets + app/public.
- GitHub: https://github.com/mohasameh793-arch/sahra-party-games (PRIVATE for now), branches `main` and `six-games` (same commit). User wants it public + GitHub Pages for the app; blocked on rewriting the first commit's author email (personal Gmail) before going public.
- Game server host (planned): Oracle VM `whatsapp-agent` 158.101.253.75 (1 GB, Ubuntu 24.04), `ssh -i ~/.ssh/oracle_wa ubuntu@158.101.253.75`. Needs Node + Caddy (HTTPS via 158-101-253-75.sslip.io, no domain) and ports 80/443 opened in Oracle's security list (console) + iptables. Don't touch the WhatsApp services there.

## 3. Stack & services
- Expo / React Native (one codebase → Android APK + web for iPhone), socket.io-client, AsyncStorage (session token), expo-localization (forced RTL), fonts Reem Kufi (headings) + IBM Plex Sans Arabic (UI).
- Node 25 + socket.io 4 (server). Rooms live in memory.
- Planned: LiveKit for voice; Cloudflare/Oracle VM for public hosting (needs HTTPS for iPhone mic).

## 4. How to run, build, deploy
Easy way (local test):
1. `cd server && npm start` (port 3005)
2. `cd app && npx expo start --web --port 8081` → open http://localhost:8081 (dev uses `.env.development` → server on :3005)
3. Fake players: `node server/bots.mjs <room code> 2`
4. Check rules: `cd server && npm test`
Build the iPhone/web version: `cd app && npx expo export -p web` → `app/dist`, served by the game server at http://localhost:3005.
Hard way: same commands one by one; server reads `PORT` env; native app reads `EXPO_PUBLIC_NATIVE_SERVER_URL`.
Deploy: not done yet.

## 5. Decisions & gotchas
- **Own Node server instead of Supabase** (changed during the build): roles and secrets must be decided on the server and sent one player at a time; a small socket.io server does this directly and needs no account. `view(room, player)` is the only thing sent to a phone.
- No Expo Router: screens follow server state, not URLs.
- Look (antialgorithm skill): tent-black ground; Saudi = Sadu red + wool white with a triangle band; Egyptian = ahwa teal + tea-glass amber with lozenges. Secrets show only while the finger holds the card.
- iPhone one-tap install without $99/yr is impossible (researched): App Store/TestFlight need it, sideloading expires in 7 days, alternative stores are EU/JP/BR only → home-screen web app.
- Mafia roles: 1 mafia per 3–4 players (5–6p: 1, 7–9p: 2, 10–13p: 3, 14–20p: 4).
- A hook once wrote a stray file `server/C:Users…state` (bare-hands state, broken path). It was moved to scratch; if it appears again, the hook's path is wrong.
- Node 25 crashes on unhandled errors in the http handler → bad %-encoding is caught (fixed).
- Mafia/Wolf rules: mafia = mafia/doctor/detective/citizen (detective sees mafia or not); wolf = wolf/guard/seer/hunter(7+ players)/villager (seer sees the exact role). Protector can't pick the same person two nights running (self allowed). Wolves' split picks → random among the most-picked. Tie vote → nobody out. Dead players' roles are public. Winners' team +1 point.
- At night EVERY phone shows the same full list of the living (a wolf's shorter list leaked them); taps a role can't make are ignored silently. Non-acting roles pick locally only.
- Host escape hatches: "كمّل الليل", "سكّر التصويت", "كمّل بدون رمية" unblock a phase stuck on a player who left.
- Metro (Expo dev server) on this PC does NOT pick up file edits: restart it with `--clear` after changing app code. `TaskStop` on the npx wrapper leaves node holding port 8081; kill the `expo start` node process.

## 6. Log
### 2026-11-17 — project started
Researched games + Mafia app UX/tech. Drafted blueprint.
### 2026-11-17 — game list approved, BLUEPRINT.md written
8 games (Egypt: المافيا, أتوبيس كومبليت, كلمة سر, صراحة · Saudi: الذيب, برا السالفة, سين جيم, حزورة) + easy how-to card per game.
### 2026-11-17 — design skill installed
antialgorithm cloned to `~/.claude/skills/antialgorithm`; rsvg-convert installed via MSYS2. iPhone → home-screen web app (no $99).
### 2026-11-17 — first build
Server (rooms, approval, برا السالفة) + Expo app (all screens, RTL, Sadu look, icon, iPhone home-screen setup). Tested a full round in the browser with 2 bots; built web version served from :3005. open-code-review: fixed a crash on malformed URLs and the "seen" button staying unlocked between rounds.
### 2026-11-17 — design approved
User approved the design sheet (`out/design.png`) as is.
### 2026-11-17 — المافيا + الذيب
Added `nightgame.js` + `Night.tsx`. Server self-check covers doctor save, detective, guard, hunter shot, both win sides, and that no phone sees living players' roles. Played full games of both in the browser with 5–6 bots (`out/design_mafia_wolf.png`). Review fixes: same night list on every phone, host can skip a stuck hunter turn.
### 2026-11-17 — حزورة, أتوبيس كومبليت, صراحة
Added the three games (server modules + screens + self-checks), played each in the browser with bots (`out/design_3games.png`). Riddle answers now show the correct spelling first.
### 2026-11-17 — security audit (quick profile)
2 hunters + 1 critic + 2 verifiers, source-only (no OS sandbox on Windows; skill validators can't run here, so the run is marked incomplete). Confirmed (medium): rooms never released when one socket creates/joins again → room-code exhaustion; fixed with `release()` in index.js. Needs validation: rate limit trusted client X-Forwarded-For; now only trusted with `TRUST_PROXY=1` (set it ONLY behind a proxy that overwrites the header). Hardening applied: saraha index check, decide order, Object.hasOwn. Deferred: no throttle on in-game events. `node server/test_socket.mjs` passes.
### 2026-11-17 — GitHub + Pages
Commit author switched to GitHub no-reply email (history rewritten with user's OK). Repo made PUBLIC (user's choice). `.github/workflows/pages.yml` builds the web app (EXPO_BASE_URL=/sahra-party-games, EXPO_PUBLIC_SERVER_URL=https://158-101-253-75.sslip.io) and deploys to https://mohasameh793-arch.github.io/sahra-party-games/ on every push to main. `app/app.config.js` sets baseUrl from env. NOT DONE: Oracle game server (install Node+Caddy, systemd service with HOST=127.0.0.1 TRUST_PROXY=1, iptables 80/443, user opens 80/443 in Oracle console). Until then the Pages app shows "disconnected".
### 2026-11-17 — Oracle game server installed
On whatsapp-agent VM: nodejs 18 (apt) + Caddy 2.11 (official apt repo). Server copied to `~/sahra/server` (tar over ssh, incl. node_modules). systemd `sahra-game.service` (PORT=3005, HOST=127.0.0.1, TRUST_PROXY=1, MemoryMax=200M). `/etc/caddy/Caddyfile`: `158-101-253-75.sslip.io { reverse_proxy 127.0.0.1:3005 }` (Caddy replaces client X-Forwarded-For, so TRUST_PROXY is safe). iptables 80/443 opened and saved to /etc/iptables/rules.v4. BLOCKED: Oracle VCN security list must allow TCP 80+443 from 0.0.0.0/0 (user, console). Update server later: `tar -czf - server | ssh ... 'tar -xzf - -C ~/sahra' && sudo systemctl restart sahra-game`.
### 2026-11-18 — live
Opened TCP 80,443 from 0.0.0.0/0 in Oracle VCN `vcn-20260906-2236` → Default Security List (done through the user's Chrome via cua-driver; user typed the password). Caddy got its certificate; https://158-101-253-75.sslip.io answers. Played a full برا السالفة round from the GitHub Pages app with 2 bots connecting over the internet.
### 2026-11-18 — المافيا moved to Saudi
User: Mafia is a Saudi game, not Egyptian. Moved it to the Saudi category (content.ts + server GAMES), rewrote its how-to, roles and narration in Saudi dialect, and gave it the Sadu red look (Night.tsx cat = saudi).
### 2026-11-18 — سين جيم + كلمة سر (all 8 games)
`server/seenjeem.js` (2 teams via `splitTeams`, board 6 of 8 categories × 200/400/600 from `SEENJEEM` in words.js, pick (+الحفرة), helpers friend +30 s / two answers, pass = steal, answer reaches phones only after reveal, host judges turn/other/none, pit subtracts from the other team) and `server/kelmaser.js` (2 teams, one giver per team sees the word, rotating givers, clue n = 11-n points, miss/foul pass the turn, first to 50). Screens `SeenJeem.tsx`, `KelmaSer.tsx`. Self-checks added; full games played with bots. Deployed to Oracle + Pages.
### 2026-11-18 — Android APK
`npx expo prebuild -p android` (android/ is git-ignored, regenerated) → `android/local.properties` sdk.dir → `gradlew assembleRelease -PreactNativeArchitectures=arm64-v8a` with JAVA_HOME = JDK 21 (`C:/Program Files/Microsoft/jdk-21.0.11.10-hotspot`), ANDROID_HOME = `%LOCALAPPDATA%/Android/Sdk`, EXPO_PUBLIC_NATIVE_SERVER_URL=https://158-101-253-75.sslip.io. Release is signed with the template's debug key (fine for sideloading, not for Play Store). Log: `out/gradle_build.log`.
