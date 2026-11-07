import { useGame, useAct, BuyBtn, LocHead, TipCard, Portrait, Tip } from './kit';
import { BRAND_FOCUS, BRAND_LINES, SPECIALTY_FIT, type BrandFocus } from '../game/content/business';
import { PRODUCT_BY_ID } from '../game/content/products';
import { SKATER_BY_ID } from '../game/content/skaters';
import * as A from '../game/actions';
import { signatureMult } from '../game/economy';
import { fmtNum, fmtRate } from '../game/format';

export function Workshop() {
  const [s, d] = useGame();
  const act = useAct();
  return (
    <>
      <LocHead title="Workshop" blurb={`Design your own brand. Each line boosts its shop category and earns brand income. Brand income now: ${fmtRate(d.brandIncome)}.`} />
      <TipCard id="tip-workshop">
        Pick a <b>focus</b> for each line, and pair a skater for a <b>signature</b> product. A skater's own signature category gives ×2; a category that fits their specialty gives ×1.5.
      </TipCard>
      <div className="grid halves">
        {BRAND_LINES.map((bl) => {
          const prod = PRODUCT_BY_ID[bl.product];
          const line = s.run.brand[bl.product];
          const contracted = s.run.products[bl.product] > 0;
          if (!line) {
            return (
              <div key={bl.product} className="card" style={{ opacity: contracted ? 1 : 0.6 }}>
                <div className="row between">
                  <h3 style={{ margin: 0 }}>{bl.name}</h3>
                  <span className="sticker" style={{ background: prod.color }}>
                    {prod.name}
                  </span>
                </div>
                <p className="small muted">Your own {prod.name.toLowerCase()} line. Starts at level 1 with Quality focus.</p>
                <BuyBtn cost={bl.unlockCost} cash={s.run.cash} label="Design line" disabled={!contracted} disabledText={`Sign ${prod.name} contract first`} onClick={() => act((x) => A.designLine(x, bl.product), 'unlock')} />
              </div>
            );
          }
          const info = d.brandByLine[bl.product];
          const one = A.brandLevelPlan(s, bl.product, 1);
          const max = A.brandLevelPlan(s, bl.product, 'max');
          return (
            <div key={bl.product} className="card">
              <div className="row between">
                <h3 style={{ margin: 0 }}>
                  {bl.name} <span className="muted small">Lv {line.level}</span>
                </h3>
                <span className="sticker" style={{ background: prod.color }}>
                  {prod.name}
                </span>
              </div>
              <div className="stats" style={{ margin: '6px 0' }}>
                <span>
                  {prod.name} income <b className="good">×{(info?.catMult ?? 1).toFixed(2)}</b>
                </span>
                <span>
                  Brand income <b className="warn">{fmtRate(info?.income ?? 0)}</b>
                </span>
                {(info?.fans ?? 0) > 0 && (
                  <span>
                    Fans <b>+{fmtNum(info!.fans)}/s</b>
                  </span>
                )}
              </div>
              <div className="seg" role="group" aria-label="Focus" style={{ marginBottom: 6 }}>
                {(Object.keys(BRAND_FOCUS) as BrandFocus[]).map((f) => (
                  <button key={f} aria-pressed={line.focus === f} onClick={() => act((x) => A.setFocus(x, bl.product, f), 'none')} title={BRAND_FOCUS[f].desc}>
                    {BRAND_FOCUS[f].label}
                  </button>
                ))}
              </div>
              <div className="tiny muted">{BRAND_FOCUS[line.focus].desc}</div>
              <div className="section-title">
                SIGNATURE <Tip text="A signed skater multiplies this line's effects. Each skater can front one line. Releasing the skater ends the signature." />
              </div>
              <div className="pick">
                <button aria-pressed={!line.signature} onClick={() => act((x) => A.setSignature(x, bl.product, null), 'none')}>
                  None
                </button>
                {s.run.team.map((t) => {
                  const def = SKATER_BY_ID[t.id];
                  const m = signatureMult(t.id, bl.product, t.training);
                  const fit = def.signature === bl.product ? '★' : SPECIALTY_FIT[def.specialty].includes(bl.product) ? '✓' : '';
                  return (
                    <button key={t.id} aria-pressed={line.signature === t.id} onClick={() => act((x) => A.setSignature(x, bl.product, t.id), 'none')}>
                      <Portrait id={t.id} size={22} /> {def.name.split(' ')[0]} ×{m.toFixed(2)} {fit}
                    </button>
                  );
                })}
              </div>
              <div className="row" style={{ marginTop: 8 }}>
                <BuyBtn cost={one.cost} cash={s.run.cash} label="Level +1" onClick={() => act((x) => A.levelLine(x, bl.product, 1))} />
                {max.n > 1 && <BuyBtn cost={max.cost} cash={s.run.cash} label={`+${max.n}`} onClick={() => act((x) => A.levelLine(x, bl.product, 'max'))} />}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
