import { createGame } from '../src/game/state';
import { computeDerived } from '../src/game/economy';
import { PROFILES, SimPlayer } from './player';
const s = createGame(0);
const p = new SimPlayer(s, PROFILES[process.argv[2] ?? 'active']);
const until = Number(process.argv[3] ?? 60);
let last = { ...s.run.stats };
while (s.run.time < until) {
  p.step();
  const st = s.run.stats; const d = computeDerived(s);
  const diff = Object.fromEntries(Object.entries(st).filter(([k]) => k.endsWith('Earned')).map(([k, v]) => [k.replace('Earned',''), +(v - (last as any)[k]).toPrecision(3)]).filter(([,v]) => v));
  if (Math.floor(s.run.time) % Number(process.argv[4] ?? 1) === 0)
  console.log(Math.round(s.run.time), 'cash', s.run.cash.toPrecision(3), 'passive', d.passive.toPrecision(3), 'sale', d.saleValue.toPrecision(3), 'base', d.shopBase.toPrecision(3), JSON.stringify(diff), 'prod', JSON.stringify(s.run.products), 'tr', JSON.stringify(Object.fromEntries(Object.entries(s.run.tracks).filter(([,v])=>v))));
  last = { ...st };
}
