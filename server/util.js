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
