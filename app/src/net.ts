// One socket for the whole app. The server sends a personal "state" after every change;
// screens only render it, so a phone can never show a secret the server didn't send it.
import { useEffect, useState } from "react";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { io } from "socket.io-client";

const URL =
  (Platform.OS === "web" ? process.env.EXPO_PUBLIC_SERVER_URL || window.location.origin : process.env.EXPO_PUBLIC_NATIVE_SERVER_URL) ||
  "http://localhost:3005";

const socket = io(URL, { transports: ["websocket"] });
const KEY = "party-session";

export type Player = { id: string; name: string; score: number; connected: boolean; isHost: boolean };
export type RoomState = {
  code: string;
  mode: "same" | "remote";
  you: { id: string; name: string; isHost: boolean; waiting: boolean };
  players?: Player[];
  pending?: { id: string; name: string }[];
  game?: any;
};

export type CustomGame = { id: string; category: "saudi" | "egypt"; name: string; line: string; steps: string[]; minPlayers: number; mechanic: string };

let state: RoomState | null = null;
let customGames: CustomGame[] = [];
let kicked = false;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

socket.on("state", (s: RoomState) => { state = s; kicked = false; notify(); });
socket.on("kicked", () => { state = null; kicked = true; AsyncStorage.removeItem(KEY); notify(); });
socket.on("connect", async () => {
  const saved = await AsyncStorage.getItem(KEY);
  if (!saved) return;
  const res = await send("resume", JSON.parse(saved));
  if (res.error) { await AsyncStorage.removeItem(KEY); state = null; notify(); }
});
socket.on("customGames", (list: CustomGame[]) => { customGames = list; notify(); });
socket.on("connect", async () => { const r = await send("listCustom"); if (r.games) { customGames = r.games; notify(); } });
socket.on("disconnect", notify);
socket.on("connect", notify);

export function send(event: string, data: object = {}, timeoutMs = 8000): Promise<{ ok?: true; error?: string; [k: string]: any }> {
  return new Promise((resolve) => {
    if (!socket.connected) return resolve({ error: "ما فيه اتصال، تأكد من النت" });
    socket.timeout(timeoutMs).emit(event, data, (err: unknown, res: any) => resolve(err ? { error: "السيرفر ما رد، جرّب مرة ثانية" } : res));
  });
}

/** Create or join; on success remembers the session so a refresh or lost signal rejoins. */
export async function enter(event: "create" | "join", data: object) {
  const res = await send(event, data);
  if (res.ok) await AsyncStorage.setItem(KEY, JSON.stringify({ code: res.code, token: res.token }));
  return res;
}

export async function leave() {
  await send("leave");
  await AsyncStorage.removeItem(KEY);
  state = null;
  notify();
}

export function useRoom() {
  const [, tick] = useState(0);
  useEffect(() => {
    const l = () => tick((n) => n + 1);
    listeners.add(l);
    return () => { listeners.delete(l); };
  }, []);
  return { state, online: socket.connected, kicked, customGames };
}
