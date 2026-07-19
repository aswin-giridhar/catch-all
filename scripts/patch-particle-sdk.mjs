/**
 * Adds a "types" condition to @particle-network/universal-account-sdk's exports map.
 *
 * The package ships valid declarations at dist/index.d.ts and points its top-level
 * "types" field at them, but its "exports" map declares only "import" and "require".
 * Under moduleResolution:"bundler" TypeScript respects "exports" strictly, so it never
 * reaches the top-level field and the whole SDK types as `any`.
 *
 * Two fixes were tried first and rejected:
 *   - tsconfig `paths` → Turbopack honours paths at runtime too, so the import
 *     resolved to the .d.ts (no runtime exports) and `new UniversalAccount()` threw
 *     "(void 0) is not a constructor".
 *   - ambient `declare module` + `export *` → relative specifiers inside ambient
 *     module declarations don't resolve, so no members came through.
 *
 * Patching the exports map fixes the root cause and leaves runtime resolution alone.
 * Runs on postinstall so `npm install` can't silently undo it.
 */
import { readFileSync, writeFileSync } from "node:fs";

const PKG = "node_modules/@particle-network/universal-account-sdk/package.json";

try {
  const pkg = JSON.parse(readFileSync(PKG, "utf8"));

  if (pkg.exports?.types) {
    console.log("[patch-particle-sdk] already patched");
    process.exit(0);
  }

  // Order matters: "types" must come first in an exports object.
  pkg.exports = { types: "./dist/index.d.ts", ...pkg.exports };
  writeFileSync(PKG, `${JSON.stringify(pkg, null, 2)}\n`);
  console.log("[patch-particle-sdk] added types condition to exports map");
} catch (error) {
  // Never fail the install over this — a missing package just means types stay `any`.
  console.warn(`[patch-particle-sdk] skipped: ${error.message}`);
}
