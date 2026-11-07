// Headless balance harness. Usage: npm run sim -- [profile] [legacies] [--verbose]
import { createGame } from '../src/game/state';
import { computeDerived } from '../src/game/economy';
import { fmtMoney, fmtNum, fmtTime } from '../src/game/format';
import { PROFILES, SimPlayer, spendCred, legacyPreview, performLegacy } from './player';
import { simulateOffline } from '../src/game/tick';

const args = process.argv.slice(2);
const profileName = args.find((a) => PROFILES[a]) ?? 'active';
const legacies = Number(args.find((a) => /^\d+$/.test(a)) ?? 6);
const verbose = args.includes('--verbose');
const maxRunMin = Number((args.find((a) => a.startsWith('--max=')) ?? '--max=150').slice(6));

const profile = PROFILES[profileName];
const s = createGame(0);
const p = new SimPlayer(s, profile);
let total = 0;

console.log(`\n=== Profile: ${profile.name} | legacies: ${legacies} ===`);
for (let run = 0; run <= legacies; run++) {
  p.log = [];
  p.firsts.clear();
  p.lastPurchaseAt = 0;
  p.maxGap = 0;
  p.activeEarned = 0;
  p.passiveEarned = 0;
  let bestRate = 0;
  let checkpoints: string[] = [];
  const isLast = run === legacies;
  while (true) {
    p.step();
    const t = s.run.time;
    if (Math.floor(t) % 300 === 0) {
      const d = computeDerived(s);
      checkpoints.push(`${fmtTime(t).padEnd(7)} cash ${fmtMoney(s.run.cash).padEnd(9)} passive ${fmtMoney(d.passive).padEnd(9)}/s sale ${fmtMoney(d.saleValue).padEnd(9)} shopBase ${fmtMoney(d.shopBase).padEnd(9)} staff×${d.staffFactor.toFixed(1)} fans ${fmtNum(s.run.fans)} cred→${legacyPreview(s).gain}`);
    }
    const pv = legacyPreview(s);
    if (pv.available && !isLast) {
      // Player-like rule: first run ~40 min; later runs when the gain would at least double total Cred.
      bestRate = Math.max(bestRate, pv.gain / t);
      if (run === 0 ? t >= 2400 : (t >= 1200 && pv.gain >= 1.5 * s.meta.credEarned) || t >= 3600) break;
    }
    if (t > maxRunMin * 60) break;
    if (isLast && s.meta.hqPhase >= 5 && !process.env.SIM_FULL_LAST) break;
  }
  const t = s.run.time;
  total += t;
  const d = computeDerived(s);
  const pv = legacyPreview(s);
  const firsts = [...p.firsts.entries()]
    .filter(([k]) => /^(staff|team open|contract|recruit|first|fund:clip|video released|event hosted|event:|legacy available|brand:|fac:miniramp|region:local|hq:)/.test(k))
    .map(([k, v]) => `${k}@${fmtTime(v)}`);
  console.log(`\n--- Run ${run + 1} (legacy ${s.meta.legacyCount}) : ${fmtTime(t)} | earned ${fmtMoney(s.run.earnings)} | Cred +${pv.gain} (×${pv.mult.toFixed(2)}) | team ${s.run.team.length} | videos ${s.run.videos.length}`);
  console.log(`    passive ${fmtMoney(d.passive)}/s | active share of earnings ${(100 * p.activeEarned / Math.max(1, p.activeEarned + p.passiveEarned)).toFixed(0)}% | longest purchase gap ${fmtTime(p.maxGap)} at ${fmtTime(p.maxGapAt)}`);
  const st = s.run.stats;
  const sum = st.manualEarned + st.passiveEarned + st.jobEarned + st.eventEarned + st.minigameEarned + st.oppEarned;
  const pc = (x: number) => `${((100 * x) / Math.max(1, sum)).toFixed(0)}%`;
  console.log(`    sources: manual ${pc(st.manualEarned)} passive ${pc(st.passiveEarned)} jobs ${pc(st.jobEarned)} events ${pc(st.eventEarned)} line ${pc(st.minigameEarned)} opps ${pc(st.oppEarned)}`);
  console.log(`    income now: shop ${fmtMoney(d.shopPassive)} online ${fmtMoney(d.online)} royalties ${fmtMoney(d.royalties)} brand ${fmtMoney(d.brandIncome)} park ${fmtMoney(d.parkIncome + d.members)}`);
  console.log(`    products: ${Object.entries(s.run.products).filter(([, l]) => l > 0).map(([k, l]) => `${k}:${l}`).join(' ')}`);
  console.log(`    firsts: ${firsts.join(', ')}`);
  if (verbose) for (const c of checkpoints) console.log('      ' + c);
  checkpoints = [];
  if (isLast) break;
  const res = performLegacy(s, s.run.team[0]?.id ?? null);
  if (!res.ok) {
    console.log('    Legacy not available: ' + res.msg);
    break;
  }
  spendCred(s, profile);
  console.log(`    → Legacy ${s.meta.legacyCount}: Cred bank ${s.meta.cred}, earned total ${s.meta.credEarned}, nodes ${JSON.stringify(s.meta.nodes)}`);
}
console.log(`\nTotal simulated time: ${fmtTime(total)} | achievements ${s.meta.achievements.length} | HQ phase ${s.meta.hqPhase}`);

// Offline check
const before = s.run.cash;
const d = computeDerived(s);
const sum = simulateOffline(s, 12 * 3600);
console.log(`Offline 12h: simulated ${fmtTime(sum.simulated)} at ${Math.round(sum.efficiency * 100)}% → +${fmtMoney(sum.earned)} (passive/s ${fmtMoney(d.passive)}; 1h online would be ${fmtMoney(d.passive * 3600)}), cash ${fmtMoney(before)}→${fmtMoney(s.run.cash)}`);
