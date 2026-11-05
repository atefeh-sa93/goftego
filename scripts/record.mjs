#!/usr/bin/env node
// Records one real reply from /api/chat into mocks/recordings/<name>.sse,
// byte for byte, for the mock provider and the static demo to replay.
//
// Needs `pnpm dev` running with LLM_PROVIDER=ollama (the default).
//
//   pnpm record plain "در یک پاراگراف کوتاه بگو چرا آسمان آبی است."
//   pnpm record code "..." --url http://localhost:3000
import { writeFile } from "node:fs/promises";
import { parseArgs } from "node:util";

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: { url: { type: "string", default: "http://localhost:3000" } },
});
const [name, prompt] = positionals;

if (!name || !prompt || !/^[a-z0-9-]+$/.test(name)) {
  console.error('Usage: pnpm record <name> "<prompt>"   (name: lowercase letters, digits, dashes)');
  process.exit(1);
}

const response = await fetch(`${values.url}/api/chat`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ messages: [{ role: "user", content: prompt }] }),
});
if (!response.ok || !response.body) {
  console.error(`HTTP ${response.status}: ${await response.text()}`);
  process.exit(1);
}

const chunks = [];
for await (const chunk of response.body) {
  chunks.push(chunk);
  process.stdout.write(".");
}
const text = Buffer.concat(chunks).toString("utf8");

if (!text.includes("event: done")) {
  console.error("\nThe reply did not end with a done event; not saving it.");
  process.exit(1);
}

const file = new URL(`../mocks/recordings/${name}.sse`, import.meta.url);
await writeFile(file, text);
const tokens = text.match(/^event: token$/gm)?.length ?? 0;
console.log(`\nSaved ${tokens} tokens to mocks/recordings/${name}.sse`);
