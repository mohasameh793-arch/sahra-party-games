import { randomBytes, randomInt } from "node:crypto";

export { randomInt };
export const id = (n) => randomBytes(n).toString("hex");
export const shuffle = (a) => {
  const b = [...a];
  for (let i = b.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [b[i], b[j]] = [b[j], b[i]];
  }
  return b;
};

export class GameError extends Error {}
export const fail = (msg) => { throw new GameError(msg); };

/** Splits players into two shuffled teams "a" and "b" (a gets the extra one). */
export const splitTeams = (ids) => {
  const s = shuffle(ids);
  const half = Math.ceil(s.length / 2);
  return { a: s.slice(0, half), b: s.slice(half) };
};
