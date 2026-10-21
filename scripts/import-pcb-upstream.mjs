// Bootstrap the pinned PCB port. Refuses to overwrite an existing adapted port.
import { mkdir, writeFile, access } from "node:fs/promises";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const postcss = require("postcss");
const revision = "bbbb55276faa11eb23784f4b8d7c701d03a59039";
const repository = "Formsmith746/SketchForge-PCB";
const root = new URL("../", import.meta.url);
const output = new URL("apps/web/src/pcb/vendor/", root);
try { await access(output); throw new Error("PCB vendor directory already exists; update the adapted port manually"); } catch (error) { if (error.code !== "ENOENT") throw error; }
const treeResponse = await fetch(`https://api.github.com/repos/${repository}/git/trees/${revision}?recursive=1`);
if (!treeResponse.ok) throw new Error(`GitHub tree: ${treeResponse.status}`);
const tree = (await treeResponse.json()).tree;
const files = tree.filter((entry) => entry.type === "blob" && (
  /^src\/(components|lib)\/.+\.(tsx?|css)$/.test(entry.path) && !/SketchForgePCBApp|MenuOnlyEditor/.test(entry.path)
  || entry.path === "src/app/globals.css" || entry.path === "LICENSE"
  || /^public\/assets\/(pcb|kicad3d)\//.test(entry.path) && !entry.path.includes("generated-source/")));
let index = 0;
await Promise.all(Array.from({ length: 6 }, async () => {
  while (index < files.length) {
    const file = files[index++];
    const response = await fetch(`https://raw.githubusercontent.com/${repository}/${revision}/${file.path}`);
    if (!response.ok) throw new Error(`${file.path}: ${response.status}`);
    let bytes = Buffer.from(await response.arrayBuffer());
    let destination;
    if (file.path.startsWith("public/")) destination = new URL(`apps/web/${file.path}`, root);
    else if (file.path === "LICENSE") destination = new URL("LICENSE", output);
    else if (file.path === "src/app/globals.css") {
      const css = postcss.parse(bytes.toString());
      css.walkRules((rule) => {
        if (rule.parent?.type === "atrule" && /keyframes$/.test(rule.parent.name)) return;
        rule.selector = postcss.list.comma(rule.selector).map((selector) => [":root", "html", "body"].includes(selector) ? ".pcb-workspace" : `.pcb-workspace ${selector}`).join(", ");
      });
      bytes = Buffer.from(`/* Adapted from ${repository}@${revision}; see vendor/LICENSE. */\n${css.toString()}`);
      destination = new URL("scoped.css", output);
    } else {
      bytes = Buffer.from(bytes.toString().replaceAll('"@/lib/', '"@/pcb/vendor/lib/').replaceAll('"@/components/', '"@/pcb/vendor/components/'));
      destination = new URL(file.path.slice(4), output);
    }
    await mkdir(new URL("./", destination), { recursive: true });
    await writeFile(destination, bytes);
  }
}));
await writeFile(new URL("SOURCE.md", output), `# PCB editor provenance\n\nPorted from https://github.com/${repository} at ${revision}.\nSource code is AGPL-3.0; see LICENSE. Adapted in place for Cadverix.\nKiCad asset attribution is retained in public/assets/kicad3d/ATTRIBUTION.md.\nGenerated-source artwork is excluded from the runtime import.\n`);
console.log(`Imported ${files.length} PCB source/assets from ${revision}`);
