import { spawn } from "node:child_process";
const children = [
  spawn("node", ["--import", "tsx", "--watch", "server/index.ts"], {
    stdio: "inherit",
    env: { ...process.env, PORT: "3001" },
  }),
  spawn("node", ["node_modules/vite/bin/vite.js"], { stdio: "inherit" }),
];
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => children.forEach((child) => child.kill(signal)));
for (const child of children)
  child.on("exit", (code) => {
    children.forEach((other) => {
      if (other !== child) other.kill();
    });
    process.exitCode = code ?? 0;
  });
