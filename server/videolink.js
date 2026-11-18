// Accepts links ONLY from known video sites and downloads them safely for the AI (agent-reach's video
// route: yt-dlp). Security: hosts are allow-listed, the URL is rebuilt from parsed parts (no user string
// is passed through), yt-dlp runs without a shell, without config files, restricted to the matching
// extractor (no generic extractor = it cannot be pointed at internal addresses), with size, duration and
// time limits, into a private temp folder that is always deleted.
import { execFile } from "node:child_process";
import { mkdtemp, readdir, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const SITES = [
  { site: "youtube", hosts: ["youtube.com", "youtu.be"], extractor: "youtube" },
  { site: "instagram", hosts: ["instagram.com"], extractor: "instagram" },
  { site: "tiktok", hosts: ["tiktok.com", "vm.tiktok.com", "vt.tiktok.com"], extractor: "tiktok,vm.tiktok" },
  { site: "x", hosts: ["x.com", "twitter.com"], extractor: "twitter" },
  { site: "facebook", hosts: ["facebook.com", "fb.watch"], extractor: "facebook,facebook:reel" },
  { site: "snapchat", hosts: ["snapchat.com"], extractor: "snapchat:spotlight" },
];
const CANONICAL = {
  "instagram.com": "www.instagram.com", "tiktok.com": "www.tiktok.com", "vm.tiktok.com": "vm.tiktok.com", "vt.tiktok.com": "vt.tiktok.com",
  "x.com": "x.com", "twitter.com": "x.com", "facebook.com": "www.facebook.com", "fb.watch": "fb.watch", "snapchat.com": "www.snapchat.com",
};
const MAX_BYTES = 18 * 1024 * 1024; // must fit one inline Gemini request
const MAX_SECONDS = 900;
const SAFE_PATH = /^\/[A-Za-z0-9._~\-\/@:%]{1,200}$/;

/**
 * Parses a pasted link. Returns {site, key, url, youtubeId?} for a supported video site, or null.
 * `key` identifies the video for duplicate checks; `url` is rebuilt, never the raw input.
 */
export function parseVideoLink(input) {
  let u;
  try { u = new URL(String(input ?? "").trim().slice(0, 400)); } catch { return null; }
  if (u.protocol !== "https:" && u.protocol !== "http:") return null;
  if (u.username || u.password || u.port) return null; // no tricks like https://evil@instagram.com
  const host = u.hostname.toLowerCase().replace(/^(www\.|m\.|mobile\.|music\.|web\.)/, "");
  const s = SITES.find((x) => x.hosts.includes(host));
  if (!s) return null;
  if (s.site === "youtube") {
    let id = null;
    if (host === "youtu.be") id = u.pathname.split("/")[1];
    else if (u.pathname === "/watch") id = u.searchParams.get("v");
    else { const m = u.pathname.match(/^\/(shorts|embed|live)\/([^/]+)/); id = m && m[2]; }
    if (!id || !/^[A-Za-z0-9_-]{11}$/.test(id)) return null;
    return { site: "youtube", key: `youtube:${id}`, youtubeId: id, url: `https://www.youtube.com/watch?v=${id}` };
  }
  const path = u.pathname.replace(/\/+$/, "");
  if (!SAFE_PATH.test(path)) return null;
  // Facebook watch links keep their ?v= id; everything else drops the query string.
  const v = s.site === "facebook" && u.searchParams.get("v");
  const query = v && /^\d{1,25}$/.test(v) ? `?v=${v}` : "";
  const url = `https://${CANONICAL[host]}${path}${query}`;
  return { site: s.site, key: `${s.site}:${host}${path}${query}`.toLowerCase(), url, extractor: s.extractor };
}

const run = (cmd, args, opts) => new Promise((resolve, reject) => {
  execFile(cmd, args, { timeout: 90_000, maxBuffer: 1024 * 1024, env: { PATH: process.env.PATH, HOME: opts.home }, ...opts }, (err, stdout, stderr) =>
    err ? reject(Object.assign(err, { stderr: String(stderr).slice(-400) })) : resolve(stdout));
});

/** Downloads a small low-quality copy. Resolves {data: Buffer, mime} or {error}. */
export async function download(link) {
  const dir = await mkdtemp(join(tmpdir(), "sahra-vid-"));
  try {
    await run(process.env.YTDLP || "yt-dlp", [
      "--ignore-config", "--no-playlist", "--no-cache-dir", "--no-part", "--quiet", "--no-warnings",
      "--use-extractors", link.extractor,
      "--max-filesize", String(MAX_BYTES), "--match-filter", `duration <= ${MAX_SECONDS}`,
      "-f", "worst[ext=mp4][vcodec!=none][acodec!=none]/worst[ext=mp4]/worst",
      "--socket-timeout", "20", "--retries", "2",
      "-o", join(dir, "v.%(ext)s"), "--", link.url,
    ], { cwd: dir, home: dir });
    const files = (await readdir(dir)).filter((f) => f.startsWith("v."));
    if (!files.length) return { error: "ما قدرنا ننزّل الفيديو (يمكن طويل أو خاص)" };
    const file = join(dir, files[0]);
    if ((await stat(file)).size > MAX_BYTES) return { error: "الفيديو كبير مرة" };
    const ext = files[0].split(".").pop();
    return { data: await readFile(file), mime: ext === "webm" ? "video/webm" : "video/mp4" };
  } catch (e) {
    const msg = String(e.stderr || "");
    if (/login|private|cookies|rate.?limit|not available/i.test(msg)) return { error: "الموقع رفض التحميل (الفيديو خاص أو يحتاج تسجيل دخول). جرّب رابط يوتيوب أو تيك توك" };
    return { error: "ما قدرنا ننزّل الفيديو، جرّب رابط ثاني" };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
