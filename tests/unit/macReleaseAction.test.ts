import { afterEach, describe, expect, it } from "vitest";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";

const { load } = createRequire(import.meta.url)("js-yaml") as { load: (text: string) => unknown };
type Step = { name: string; run?: string; env?: Record<string, string> };
const action = load(readFileSync(path.resolve(".github/actions/build-mac/action.yml"), "utf8")) as { runs: { steps: Step[] } };
const step = (name: string) => action.runs.steps.find((entry) => entry.name === name)!;
// The action runs on macOS; exercise its POSIX shell/file permissions on macOS
// and Linux. The YAML security checks still run in Windows release jobs.
const bashTest = it.skipIf(process.platform === "win32");
const directories: string[] = [];
const temporary = () => {
  const directory = mkdtempSync(path.join(tmpdir(), "cadverix-mac-action-"));
  directories.push(directory);
  return directory;
};
afterEach(() => { for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true }); });

const fakePrivateKey = "-----BEGIN PRIVATE KEY-----\nTEST-ONLY-NOT-A-REAL-KEY\n-----END PRIVATE KEY-----";
function run(name: string, directory: string, env: Record<string, string>, stubNpm = false) {
  const stub = `codesign() { :; }
${stubNpm ? `npm() {
    node -e 'console.log(JSON.stringify({ args: process.argv.slice(1), certificate: process.env.CSC_LINK ?? null, key: process.env.APPLE_API_KEY ?? null, adHoc: process.env.CADVERIX_MAC_AD_HOC_SIGN ?? null }))' "$@"
  }\n` : ""}`;
  return spawnSync("bash", ["--noprofile", "--norc", "-e", "-o", "pipefail", "-c", stub + step(name).run], {
    cwd: directory,
    encoding: "utf8",
    env: { ...process.env, RUNNER_TEMP: directory, GITHUB_OUTPUT: path.join(directory, "outputs"), ...env },
  });
}

function yamlFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const name = path.join(directory, entry.name);
    return entry.isDirectory() ? yamlFiles(name) : /\.ya?ml$/.test(name) ? [name] : [];
  });
}

describe("macOS release action shell safety", () => {
  it("keeps GitHub expressions out of all action and workflow shell scripts", () => {
    const scripts = (value: unknown): string[] => {
      if (!value || typeof value !== "object") return [];
      const object = value as Record<string, unknown>;
      return [...(typeof object.run === "string" ? [object.run] : []), ...Object.values(object).flatMap(scripts)];
    };
    for (const file of yamlFiles(path.resolve(".github"))) {
      for (const script of scripts(load(readFileSync(file, "utf8")))) expect(script, file).not.toContain("${{");
    }
  });

  it("binds inputs and signing outputs through environment variables", () => {
    expect(action.runs.steps[0]?.name).toBe("Validate macOS architecture");
    for (const name of ["Validate macOS architecture", "Build macOS package", "Verify macOS artifacts", "Rename macOS update manifest"]) {
      expect(step(name).env?.ARCH).toBe("${{ inputs.arch }}");
    }
    for (const name of ["Build macOS package", "Verify macOS artifacts"]) {
      expect(step(name).env?.SIGNING_ENABLED).toBe("${{ steps.signing.outputs.signing_enabled }}");
      expect(step(name).env?.ARTIFACT_SUFFIX).toBe("${{ steps.signing.outputs.artifact_suffix }}");
    }
  });

  bashTest.each(["ia32", "", 'x64"; touch "$MARKER"; #', '$(touch "$MARKER")'])("rejects unsupported or injected architecture %j", (arch) => {
    const directory = temporary();
    const marker = path.join(directory, "injected");
    const result = run("Validate macOS architecture", directory, { ARCH: arch, MARKER: marker });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Unsupported macOS architecture");
    expect(existsSync(marker)).toBe(false);
  });

  for (const arch of ["x64", "arm64"]) for (const signed of [false, true]) {
    bashTest(`preserves ${signed ? "signed" : "unsigned"} ${arch} packaging and manifest handling`, () => {
      const directory = temporary();
      const suffix = signed ? "" : "-unsigned";
      const env = {
        ARCH: arch, VERSION: "1.2.3", SIGNING_ENABLED: String(signed), ARTIFACT_SUFFIX: suffix,
        CSC_LINK: signed ? "test-certificate" : "", CSC_KEY_PASSWORD: "test-password",
        APPLE_API_KEY: "test-key", APPLE_API_KEY_INPUT: fakePrivateKey,
        APPLE_API_KEY_ID: "test-key-id", APPLE_API_ISSUER: "test-issuer",
      };
      expect(run("Validate macOS architecture", directory, env).status).toBe(0);
      expect(run("Resolve macOS signing state", directory, env).status).toBe(0);
      expect(readFileSync(path.join(directory, "outputs"), "utf8")).toBe(`artifact_suffix=${suffix}\nsigning_enabled=${signed}\n`);
      const build = run("Build macOS package", directory, env, true);
      expect(build.status, build.stderr).toBe(0);
      const output = JSON.parse(build.stdout);
      expect(output.args).toEqual([
        "run", "desktop:dist", "--", "--publish", "never", "--mac", `--${arch}`,
        "-c.mac.artifactName=Cadverix-3D-${version}-${arch}" + suffix + ".${ext}",
      ]);
      expect(output.certificate).toBe(signed ? "test-certificate" : null);
      expect(output.adHoc).toBe(signed ? null : "true");
      if (signed) {
        expect(output.key).toBe(path.join(directory, `cadverix-notary-${arch}.p8`));
        expect(readFileSync(output.key, "utf8")).toBe(fakePrivateKey);
        expect(statSync(output.key).mode & 0o777).toBe(0o600);
      } else expect(output.key).toBeNull();

      const artifacts = path.join(directory, "dist/desktop");
      mkdirSync(artifacts, { recursive: true });
      for (const extension of ["dmg", "zip"]) writeFileSync(path.join(artifacts, `Cadverix-3D-1.2.3-${arch}${suffix}.${extension}`), "test artifact");
      mkdirSync(path.join(artifacts, `mac-${arch}`, "Cadverix 3D.app"), { recursive: true });
      writeFileSync(path.join(artifacts, "latest-mac.yml"), "test manifest");
      const verify = run("Verify macOS artifacts", directory, env);
      expect(verify.status, verify.stderr).toBe(0);
      if (signed) {
        expect(run("Rename macOS update manifest", directory, env).status).toBe(0);
        expect(existsSync(path.join(artifacts, `latest-mac-${arch}.yml`))).toBe(true);
      }
      expect(existsSync(path.join(artifacts, "latest-mac.yml"))).toBe(false);
    });
  }

  bashTest("treats shell syntax inside an artifact suffix and version as literal data", () => {
    const directory = temporary();
    const payload = "$(touch injection-marker)";
    const env = { ARCH: "arm64", VERSION: `1.2.3${payload}`, SIGNING_ENABLED: "false", ARTIFACT_SUFFIX: payload };
    const build = run("Build macOS package", directory, env, true);
    expect(build.status, build.stderr).toBe(0);
    expect(JSON.parse(build.stdout).args.at(-1)).toContain(payload);
    const artifacts = path.join(directory, "dist/desktop");
    mkdirSync(artifacts, { recursive: true });
    for (const extension of ["dmg", "zip"]) writeFileSync(path.join(artifacts, `Cadverix-3D-${env.VERSION}-arm64${payload}.${extension}`), "test artifact");
    expect(run("Verify macOS artifacts", directory, env).status).toBe(0);
    expect(existsSync(path.join(directory, "injection-marker"))).toBe(false);
  });
});
