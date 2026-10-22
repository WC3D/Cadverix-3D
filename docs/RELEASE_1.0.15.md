# Cadverix 3D 1.0.15 desktop build

Download packages from [GitHub Releases](https://github.com/WC3D/Cadverix-3D/releases/tag/v1.0.15).
Local build copies are in `dist/desktop/`. See the [changelog](CHANGELOG.md#1015) for the changes since
1.0.14, including the PCB workspace, themes/DC tests, modeling/storage additions,
WC3D icons, split tools, and removal of the PCB Project/Save toolbar group.

| Platform | Installer |
| --- | --- |
| Windows x64 | `Cadverix-3D-Setup-1.0.15-x64.exe` |
| Linux x64 | `Cadverix-3D-1.0.15-x86_64.AppImage` |
| macOS Apple Silicon | `Cadverix-3D-1.0.15-arm64-unsigned.dmg` |
| macOS Intel | `Cadverix-3D-1.0.15-x64-unsigned.dmg` |

Matching macOS ZIPs, Windows blockmap/update metadata, Linux update metadata,
and `SHA256SUMS.txt` are alongside the installers. Verify the six installer/ZIP
checksums from that directory with `shasum -a 256 -c SHA256SUMS.txt`.

macOS packages use ad-hoc signatures, not Developer ID signing or notarization.
Both app bundles pass strict signature verification, but Gatekeeper warnings
remain; follow the [macOS installation instructions](../README.md#macos).
No macOS auto-update manifest is supplied for these unsigned builds, matching
the release workflow's signing policy. Install them manually.

The local production web bundle used installed Next.js 16.4.1; the desktop
runtime is Electron 43.7.5. The lockfile currently resolves Next.js 16.4.2, so a
fresh `npm ci`/CI build may differ from this local bundle.

PCB changes still autosave. **Ctrl/Cmd+S** in PCB downloads the combined SKF;
touch users can use **Geometry → Export → SKF**. PCB-bearing SKF files require
a format-4 reader. Back up projects before upgrading; installation identifiers
and storage locations are unchanged.

## Verification

- Typecheck and all 741 unit tests passed.
- All 16 PCB workspace/theme/DC browser checks passed in Chromium and WebKit
  against the production web build, including combined SKF download and reload.
- Static export and all 10 Chromium/WebKit offline checks passed, including PCB
  geometry and combined SKF downloads without the app server.
- All four packaged applications report version 1.0.15.
- macOS Intel and Apple Silicon app bundles pass strict code-signature checks.
- Native installation/launch on Windows, Linux, and macOS was not exercised.

The first browser run against the existing development server was interrupted
because repeated hot reloads reset the editor. The complete production-server
rerun passed; no development-server fix is included in this release.
