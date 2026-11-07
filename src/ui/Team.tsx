import { useState } from 'react';
import { useGame, useAct, BuyBtn, Bar, LocHead, TipCard, Portrait, Tip, Modal } from './kit';
import { SKATERS, SKATER_BY_ID, SPECIALTY_INFO, describeBonus } from '../game/content/skaters';
import { ASSIGNMENTS, ASSIGNMENT_BY_ID, CONTEST_PLACES } from '../game/content/activities';
import { tracksFor } from '../game/content/tracks';
import * as A from '../game/actions';
import { bonusScale, estimateJob, nextTrainingMilestone, signingCost, trainingScale } from '../game/economy';
import { assignmentLock, busySkaters, skaterUnlockText } from '../game/unlocks';
import { fmtMoney, fmtNum, fmtTime } from '../game/format';
import { TrackRow } from './Shop';

const STATUS: Record<string, string> = { job: 'On assignment', filming: 'Filming', headlining: 'Headlining event' };

export function Team() {
  const [s, d] = useGame();
  const [tab, setTab] = useState<'roster' | 'assign' | 'scout' | 'upgrades'>(s.run.team.length ? 'roster' : 'scout');
  return (
    <>
      <LocHead title="Team HQ" blurb={`Sponsor skaters, train them, and send them out. Team ${s.run.team.length}/${d.teamSlots}.`}>
        <div className="seg" role="group" aria-label="Team sections">
          <button aria-pressed={tab === 'roster'} onClick={() => setTab('roster')}>
            Roster
          </button>
          <button aria-pressed={tab === 'assign'} onClick={() => setTab('assign')}>
            Assignments{s.run.jobs.length ? ` (${s.run.jobs.length})` : ''}
          </button>
          <button aria-pressed={tab === 'scout'} onClick={() => setTab('scout')}>
            Scouting
          </button>
          <button aria-pressed={tab === 'upgrades'} onClick={() => setTab('upgrades')}>
            Upgrades
          </button>
        </div>
      </LocHead>
      <TipCard id="tip-team">
        Skaters give their business bonus <u>all the time</u> — even while on an assignment. Each skater can do one thing at a time: an assignment, a filming crew, or headlining an event.
      </TipCard>
      {tab === 'roster' && <Roster goScout={() => setTab('scout')} />}
      {tab === 'assign' && <Assignments />}
      {tab === 'scout' && <Scouting />}
      {tab === 'upgrades' && (
        <div className="grid halves">
          <div className="card">
            <h2>Team</h2>
            {tracksFor('team').map((t) => (
              <TrackRow key={t.id} id={t.id} />
            ))}
          </div>
          <div className="card">
            <h2>Tours & Demos</h2>
            {tracksFor('tour').map((t) => (
              <TrackRow key={t.id} id={t.id} />
            ))}
          </div>
        </div>
      )}
    </>
  );
}

function SpecBadge({ id }: { id: string }) {
  const sp = SPECIALTY_INFO[SKATER_BY_ID[id].specialty];
  return (
    <Tip text={sp.desc}>
      <span className="sticker" style={{ background: sp.color }} tabIndex={0}>
        {sp.label}
      </span>
    </Tip>
  );
}

function Roster({ goScout }: { goScout: () => void }) {
  const [s, d] = useGame();
  const act = useAct();
  const [confirm, setConfirm] = useState<string | null>(null);
  const busy = busySkaters(s);
  if (!s.run.team.length)
    return (
      <div className="card">
        <p>No skaters signed yet.</p>
        <button className="btn primary" onClick={goScout}>
          Go scouting
        </button>
      </div>
    );
  return (
    <div className="grid halves">
      {s.run.team.map((t) => {
        const def = SKATER_BY_ID[t.id];
        const st = d.skaters[t.id];
        const one = A.trainPlan(s, t.id, 1, d);
        const max = A.trainPlan(s, t.id, 'max', d);
        const nm = nextTrainingMilestone(t.training);
        const status = busy.get(t.id);
        return (
          <div key={t.id} className="card">
            <div className="skater-card">
              <Portrait id={t.id} size={64} />
              <div style={{ minWidth: 0 }}>
                <div className="row between">
                  <h3 style={{ margin: 0 }}>
                    {def.name}
                    {def.nickname ? <span className="muted small"> “{def.nickname}”</span> : null}
                  </h3>
                  <SpecBadge id={t.id} />
                </div>
                <div className="stats">
                  <span>
                    Tech <b>{fmtNum(st.tech)}</b>
                  </span>
                  <span>
                    Flow <b>{fmtNum(st.flow)}</b>
                  </span>
                  <span>
                    Hype <b>{fmtNum(st.hype)}</b>
                  </span>
                  <span>
                    Training <b>Lv {t.training}</b>
                  </span>
                </div>
                <div className="small" style={{ marginTop: 4 }}>
                  Bonus: <b className="good">{describeBonus(def.bonus, st.bonusScale)}</b>
                </div>
                <div className="small muted">{status ? STATUS[status] : 'Idle — send them out!'}</div>
              </div>
            </div>
            <div style={{ marginTop: 8 }}>
              <div className="small muted">
                Next level: stats ×{(trainingScale(t.training + 1) / trainingScale(t.training)).toFixed(2)}, bonus → {describeBonus(def.bonus, bonusScale(t.training + 1))}
                {nm ? ` · ★ Lv ${nm}: stats & bonus ×1.25` : ''}
              </div>
              {nm && <Bar value={t.training} max={nm} tone="sky" label="Training milestone progress" />}
            </div>
            <div className="row" style={{ marginTop: 8 }}>
              <BuyBtn cost={one.cost} cash={s.run.cash} label="Train +1" onClick={() => act((x, dd) => A.train(x, t.id, 1, dd))} />
              {max.n > 1 && <BuyBtn cost={max.cost} cash={s.run.cash} label={`Train +${max.n}`} onClick={() => act((x, dd) => A.train(x, t.id, 'max', dd))} />}
              <span className="grow" />
              <button className="btn small ghost" onClick={() => setConfirm(t.id)}>
                Release
              </button>
            </div>
          </div>
        );
      })}
      {confirm && (
        <Modal title={`Release ${SKATER_BY_ID[confirm].name}?`} onClose={() => setConfirm(null)}>
          <p>
            They leave the team, any assignment they are on ends without paying out, and their training ({s.run.team.find((t) => t.id === confirm)?.training ?? 0} levels) is lost. You can
            sign them again later for the signing fee.
          </p>
          <div className="row">
            <button
              className="btn danger"
              onClick={() => {
                act((x) => A.release(x, confirm), 'none');
                setConfirm(null);
              }}
            >
              Release
            </button>
            <button className="btn" onClick={() => setConfirm(null)}>
              Keep
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function Scouting() {
  const [s, d] = useGame();
  const act = useAct();
  const full = s.run.team.length >= d.teamSlots;
  return (
    <>
      {full && <p className="warn small">Team is full ({d.teamSlots} slots). Expand Team Space in Upgrades, or release someone.</p>}
      <div className="grid halves">
        {SKATERS.filter((k) => !s.run.team.some((t) => t.id === k.id)).map((k) => {
          const avail = s.meta.unlockedSkaters.includes(k.id);
          return (
            <div key={k.id} className="card" style={avail ? undefined : { opacity: 0.7 }}>
              <div className="skater-card">
                <Portrait id={k.id} size={64} dim={!avail} />
                <div style={{ minWidth: 0 }}>
                  <div className="row between">
                    <h3 style={{ margin: 0 }}>{avail ? k.name : '??? (unscouted)'}</h3>
                    <SpecBadge id={k.id} />
                  </div>
                  {avail ? (
                    <>
                      <p className="small" style={{ margin: '4px 0' }}>
                        {k.bio}
                      </p>
                      <div className="stats">
                        <span>
                          Tech <b>{k.tech}</b>
                        </span>
                        <span>
                          Flow <b>{k.flow}</b>
                        </span>
                        <span>
                          Hype <b>{k.hype}</b>
                        </span>
                      </div>
                      <div className="small">
                        Bonus: <b className="good">{describeBonus(k.bonus)}</b>
                      </div>
                    </>
                  ) : (
                    <p className="small muted">{skaterUnlockText(k)}</p>
                  )}
                </div>
              </div>
              {avail && (
                <div className="row" style={{ marginTop: 8 }}>
                  <BuyBtn cost={signingCost(d, k)} cash={s.run.cash} label="Sign" disabled={full} disabledText="Team full" onClick={() => act((x, dd) => A.recruit(x, k.id, dd), 'unlock')} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}

function Assignments() {
  const [s, d] = useGame();
  const act = useAct();
  const [sel, setSel] = useState<Record<string, string[]>>({});
  const [repeat, setRepeat] = useState(true);
  const busy = busySkaters(s);
  const hasManager = (s.run.tracks.manager ?? 0) > 0;
  return (
    <div className="stack">
      {s.run.jobs.length > 0 && (
        <div className="card">
          <h2>Out on assignment</h2>
          {s.run.jobs.map((j) => {
            const a = ASSIGNMENT_BY_ID[j.assignmentId];
            const est = estimateJob(s, d, a, j.skaters);
            return (
              <div key={j.uid} className="item">
                <div className="row" style={{ gap: 2 }}>
                  {j.skaters.slice(0, 2).map((id) => (
                    <Portrait key={id} id={id} size={j.skaters.length > 1 ? 22 : 40} />
                  ))}
                </div>
                <div style={{ minWidth: 0 }}>
                  <div className="title">
                    {a.name} <span className="lvl">{j.skaters.map((id) => SKATER_BY_ID[id].name.split(' ')[0]).join(', ')}</span>
                  </div>
                  <div className="sub">
                    ≈ {fmtMoney(est.payout)} · +{fmtNum(est.fans)} fans{est.place ? ` · ${est.place}` : ''} · {fmtTime(j.duration - j.elapsed)} left
                  </div>
                  <Bar value={j.elapsed} max={j.duration} tone="sky" label={`${a.name} progress`} />
                </div>
                <div className="actions">
                  <button className={`btn small ${j.repeat ? 'lime' : ''}`} disabled={!hasManager} onClick={() => act((x) => A.setJobRepeat(x, j.uid, !j.repeat), 'none')} title={hasManager ? 'Restart automatically when done' : 'Hire a Team Manager to enable repeat'}>
                    Repeat {j.repeat ? 'ON' : 'OFF'}
                  </button>
                  <button className="btn small ghost" onClick={() => act((x) => A.cancelJob(x, j.uid), 'none')}>
                    Cancel
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
      <div className="row">
        <label className="small row">
          <input type="checkbox" checked={repeat && hasManager} disabled={!hasManager} onChange={(e) => setRepeat(e.target.checked)} /> Repeat new assignments
        </label>
        {!hasManager && <span className="small muted">(Hire a Team Manager in Upgrades to unlock repeat.)</span>}
      </div>
      <div className="grid halves">
        {ASSIGNMENTS.map((a) => {
          const lock = assignmentLock(s, a);
          const chosen = (sel[a.id] ?? []).filter((id) => s.run.team.some((t) => t.id === id) && !busy.has(id));
          const est = chosen.length ? estimateJob(s, d, a, chosen) : null;
          const kindColor = a.kind === 'demo' ? 'var(--pink)' : a.kind === 'contest' ? 'var(--orange)' : 'var(--sky)';
          return (
            <div key={a.id} className="card" style={lock ? { opacity: 0.6 } : undefined}>
              <div className="row between">
                <h3 style={{ margin: 0 }}>{a.name}</h3>
                <span className="sticker" style={{ background: kindColor }}>
                  {a.kind.toUpperCase()}
                </span>
              </div>
              <p className="small muted" style={{ margin: '4px 0' }}>
                {a.desc}
              </p>
              <div className="small">
                {a.minSkaters === a.maxSkaters ? a.minSkaters : `${a.minSkaters}–${a.maxSkaters}`} skater{a.maxSkaters > 1 ? 's' : ''} · uses <b>{a.stat === 'all' ? 'all stats' : a.stat}</b> · base {fmtTime(a.duration)}
                {a.kind === 'contest' && (
                  <Tip text={`Placement compares Flow (+¼ Tech) to the field strength of ${a.statNorm}: ${CONTEST_PLACES.map((p) => `${p.label} at ×${p.minRatio}`).join(', ')}.`} />
                )}
                {a.merchBoost ? <span className="chip p" style={{ marginLeft: 6 }}>+{Math.round(a.merchBoost * 100)}% shoes & apparel for the run</span> : null}
              </div>
              {lock ? (
                <p className="small warn">{lock}</p>
              ) : (
                <>
                  <div className="pick" style={{ margin: '8px 0' }}>
                    {s.run.team.map((t) => {
                      const on = chosen.includes(t.id);
                      const isBusy = busy.has(t.id);
                      return (
                        <button
                          key={t.id}
                          aria-pressed={on}
                          disabled={isBusy || (!on && chosen.length >= a.maxSkaters)}
                          onClick={() => setSel((m) => ({ ...m, [a.id]: on ? chosen.filter((x) => x !== t.id) : [...chosen, t.id] }))}
                          title={isBusy ? STATUS[busy.get(t.id)!] : undefined}
                        >
                          <Portrait id={t.id} size={24} />
                          {SKATER_BY_ID[t.id].name.split(' ')[0]}
                        </button>
                      );
                    })}
                    {!s.run.team.length && <span className="small muted">Sign a skater first.</span>}
                  </div>
                  <div className="small" style={{ minHeight: 20 }}>
                    {est ? (
                      <>
                        Expect <b className="warn">{fmtMoney(est.payout)}</b> + {fmtNum(est.fans)} fans in {fmtTime(est.duration)}
                        {est.place ? (
                          <>
                            {' '}
                            · <b>{est.place}</b>
                          </>
                        ) : (
                          <> · strength {Math.round(est.ratio * 100)}% of normal</>
                        )}
                      </>
                    ) : (
                      <span className="muted">Pick skaters to see expected results.</span>
                    )}
                  </div>
                  <button
                    className="btn primary small"
                    style={{ marginTop: 6 }}
                    disabled={chosen.length < a.minSkaters}
                    onClick={() => {
                      const r = act((x, dd) => A.startJob(x, a.id, chosen, repeat, dd), 'buy');
                      if (r?.ok) setSel((m) => ({ ...m, [a.id]: [] }));
                    }}
                  >
                    Send out
                  </button>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
