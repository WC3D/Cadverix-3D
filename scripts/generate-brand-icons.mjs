// Render the shared vector brand mark for desktop packaging and browser installs.
import sharp from "sharp";
import { fileURLToPath } from "node:url";

const source = fileURLToPath(new URL("../apps/web/public/assets/cadverix/cadverix-logo.svg", import.meta.url));
const directory = new URL("../apps/web/public/assets/cadverix/", import.meta.url);
await Promise.all([
  [1024, "cadverix-logo.png"],
  [180, "cadverix-apple-touch-icon.png"],
  [192, "cadverix-app-192.png"],
  [512, "cadverix-app-512.png"],
  [32, "cadverix-favicon.png"],
].map(([size, name]) => sharp(source).resize(Number(size), Number(size)).png().toFile(fileURLToPath(new URL(String(name), directory)))));
const inset = await sharp(source).resize(320, 320).png().toBuffer();
await sharp({ create: { width: 512, height: 512, channels: 4, background: "#101820" } }).composite([{ input: inset, gravity: "center" }]).png().toFile(fileURLToPath(new URL("cadverix-app-maskable-512.png", directory)));
console.log("Generated Cadverix 3D desktop, PWA, Apple touch and favicon icons.");
