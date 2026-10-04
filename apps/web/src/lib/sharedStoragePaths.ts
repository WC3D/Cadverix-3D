import { promises as fs } from "node:fs";
import path from "node:path";

export function sharedRelativePath(value: string, allowEmpty = false) {
  if (allowEmpty && value === "") return value;
  if (value.length > 1024 || value.split("/").some((part) => !part || part.startsWith(".") || part.length > 120 || /[<>:"\\|?*\u0000-\u001f]/.test(part) || part.trim() !== part)) throw new Error("Invalid storage path");
  return value;
}
export async function resolveSharedPath(root: string, relative: string, allowMissingLeaf = false) {
  sharedRelativePath(relative, true);
  let current = root;
  const segments = relative ? relative.split("/") : [];
  for (let index = 0; index < segments.length; index++) {
    current = path.join(current, segments[index]);
    try {
      const stat = await fs.lstat(current);
      if (stat.isSymbolicLink() || (index < segments.length - 1 && !stat.isDirectory())) throw new Error("Storage paths must not traverse links or files");
    } catch (error) {
      if (allowMissingLeaf && index === segments.length - 1 && (error as NodeJS.ErrnoException).code === "ENOENT") return current;
      throw error;
    }
  }
  return current;
}
