import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join, relative } from "node:path";

// Exercise the copy Next.js actually loads, including any nested installation.
const require = createRequire(import.meta.url);
const requireFromNext = createRequire(require.resolve("next/package.json"));
const postcss = requireFromNext("postcss") as typeof import("postcss").default;

describe("PostCSS untrusted source maps without a source filename", () => {
  let directory: string;
  let mapPath: string;
  const privateSource = "PRIVATE_SOURCE_MAP_REGRESSION_MARKER";
  const privatePath = "/private/project/source.ts";

  beforeAll(async () => {
    directory = await mkdtemp(join(dirname(process.cwd()), "sketchforge-postcss-"));
    mapPath = join(directory, "outside.map");
    await writeFile(mapPath, JSON.stringify({
      version: 3,
      sources: [privatePath],
      sourcesContent: [privateSource],
      mappings: "",
      names: [],
    }));
  });

  afterAll(async () => {
    if (directory) await rm(directory, { recursive: true, force: true });
  });

  it.each(["absolute", "traversal"] as const)("does not disclose an external map via a %s annotation", async (kind) => {
    const annotation = kind === "absolute" ? mapPath : relative(process.cwd(), mapPath);
    if (kind === "traversal") expect(annotation.startsWith("..")).toBe(true);
    const result = await postcss([]).process(`a{color:red}\n/*# sourceMappingURL=${annotation} */`, {
      map: { inline: false, annotation: false, sourcesContent: true },
    });
    expect(result.css).toContain("a{color:red}");
    expect(result.map).toBeDefined();
    const output = JSON.stringify(result.map!.toJSON());
    expect(output).not.toContain(privateSource);
    expect(output).not.toContain(privatePath);
  });
});
