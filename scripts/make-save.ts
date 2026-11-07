// Generates realistic saves at various progression points by running the sim bot. Usage: tsx scripts/make-save.ts
import { writeFileSync, mkdirSync } from 'node:fs';
import { createGame } from '../src/game/state';
import { PROFILES, SimPlayer, spendCred } from '../sim/player';
import { performLegacy, legacyPreview } from '../src/game/prestige';
import { serialize } from '../src/game/save';

mkdirSync('.verify', { recursive: true });
const s = createGame(0);
const p = new SimPlayer(s, PROFILES.active);
const dump = (name: string) => {
  s.lastTick = Date.now();
  writeFileSync(`.verify/${name}.json`, serialize(s));
  console.log('wrote', name, 'legacy', s.meta.legacyCount, 'cash', s.run.cash.toExponential(2));
};
const runFor = (sec: number) => { const end = s.run.time + sec; while (s.run.time < end) p.step(); };
runFor(600); dump('run1-10min');
runFor(1500); dump('run1-35min');
for (let L = 1; L <= 5; L++) {
  while (!legacyPreview(s).available) p.step();
  runFor(600);
  performLegacy(s, s.run.team[0]?.id ?? null);
  spendCred(s, PROFILES.active);
  runFor(L === 5 ? 1500 : 900);
  dump(`L${L}`);
}
