// Skyharbor Run — hand-in program (Node 22, standard library only).
//
// The game itself is the static site under game/: plain files a desktop
// browser opens offline. This program's whole job is the hand-in: copy
// game/ and screenshots/ from beside this file into the output folder
// and write dossier.json there with buildDossier from the vendored
// make.fun library, so the scorer and the judge see exactly what the
// maker saw. In the grader the output folder is /output; anywhere else
// MAKEFUN_OUTPUT_DIR names it instead.
//
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const root = dirname(fileURLToPath(import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// The gate's screenshot caps, checked here so a bad hand-in fails at
// the maker's desk rather than at the scorer: 3 or 4 shots, each a
// whole PNG or JPEG of at most 256 KiB.
const shotsDir = join(root, 'screenshots');
const shotNames = existsSync(shotsDir)
  ? readdirSync(shotsDir).filter((n) => /\.(png|jpe?g)$/i.test(n)).sort()
  : [];
if (shotNames.length < 3 || shotNames.length > 4) {
  throw new Error(`screenshots/ must hold 3 or 4 images, found ${shotNames.length}`);
}
for (const name of shotNames) {
  const bytes = statSync(join(shotsDir, name)).size;
  if (bytes > 262144) throw new Error(`screenshot ${name} is ${bytes} bytes, over the 256 KiB cap`);
}

mkdirSync(outDir, { recursive: true });
cpSync(join(root, 'game'), join(outDir, 'game'), { recursive: true });
cpSync(shotsDir, join(outDir, 'screenshots'), { recursive: true });

const dossier = buildDossier(outDir, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
});
writeFileSync(join(outDir, 'dossier.json'), dossier);
console.log(`Skyharbor Run handed in: game/ + ${shotNames.length} screenshots + dossier.json (${dossier.length} bytes) -> ${outDir}`);
