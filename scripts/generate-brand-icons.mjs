// Render the shared vector brand mark for Electron's native packaging targets.
import sharp from "sharp";
import { fileURLToPath } from "node:url";

const source = fileURLToPath(new URL("../apps/web/public/assets/cadverix/cadverix-logo.svg", import.meta.url));
const directory = new URL("../apps/web/public/assets/cadverix/", import.meta.url);
await Promise.all([
  [1024, "cadverix-logo.png"],
  [180, "cadverix-apple-touch-icon.png"],
  [32, "cadverix-favicon.png"],
].map(([size, name]) => sharp(source).resize(Number(size), Number(size)).png().toFile(fileURLToPath(new URL(String(name), directory)))));
console.log("Generated Cadverix 3D desktop, Apple touch and favicon icons.");
