import { useGame, useAct, BuyBtn, Bar, LocHead, TipCard, Portrait, Tip } from './kit';
import { EVENT_TIERS, EVENT_BY_ID } from '../game/content/activities';
import { SKATER_BY_ID } from '../game/content/skaters';
import { tracksFor } from '../game/content/tracks';
import * as A from '../game/actions';
import { estimateEvent } from '../game/economy';
import { busySkaters, eventLock } from '../game/unlocks';
import { fmtMoney, fmtNum, fmtRate, fmtTime } from '../game/format';
import { TrackRow } from './Shop';

export function Venue() {
  const [s, d] = useGame();
  const act = useAct();
  const ev = s.run.event;
  const tier = ev ? EVENT_BY_ID[ev.tierId] : null;
  const est = tier ? estimateEvent(s, d, tier, ev!.hypeBonus) : null;
  const crew = (s.run.tracks.eventCrew ?? 0) > 0;
  const busy = busySkaters(s);
  return (
    <>
      <LocHead title="Event Venue" blurb="Host recurring events. Each cycle pays out on completion; attendance is limited by both demand and venue capacity." />
      <TipCard id="tip-venue">
        Attendance = the <b>lower</b> of demand and capacity. If the venue is full, more promotion is wasted — expand capacity. Hire an Event Crew to re-host automatically.
      </TipCard>
      <div className="grid two">
        <div className="stack">
          {ev && tier && est ? (
            <div className="card">
              <div className="tape" />
              <h2>Now hosting: {tier.name}</h2>
              <div className="row between small">
                <span>{fmtTime(ev.duration - ev.elapsed)} until payout</span>
                <span>
                  Payout ≈ <b className="warn">{fmtMoney(est.total)}</b> ({fmtRate(est.total / tier.duration)})
                </span>
              </div>
              <Bar value={ev.elapsed} max={ev.duration} tone="pink" label="Event progress" />
              <div className="grid halves" style={{ marginTop: 10, gap: 10 }}>
                <div className="small">
                  <div className="row between">
                    <span>Demand</span>
                    <b className="num">{fmtNum(est.demand)}</b>
                  </div>
                  <div className="row between">
                    <span>Capacity</span>
                    <b className="num">{fmtNum(est.capacity)}</b>
                  </div>
                  <div className="row between">
                    <span>Attendance</span>
                    <b className="num good">{fmtNum(est.attendance)}</b>
                  </div>
                  <div className={est.demand > est.capacity ? 'warn tiny' : 'tiny muted'}>
                    {est.demand > est.capacity ? 'Venue is full — capacity is the bottleneck.' : 'Demand is the bottleneck — promote the event.'}
                  </div>
                </div>
                <div className="small">
                  <div className="row between">
                    <span>Tickets</span>
                    <span className="num">{fmtMoney(est.tickets)}</span>
                  </div>
                  <div className="row between">
                    <span>Vendors</span>
                    <span className="num">{fmtMoney(est.vendors)}</span>
                  </div>
                  <div className="row between">
                    <span>Sponsors</span>
                    <span className="num">{fmtMoney(est.sponsors)}</span>
                  </div>
                  <div className="row between">
                    <span>Broadcast</span>
                    <span className="num">{tier.broadcast ? fmtMoney(est.broadcast) : '—'}</span>
                  </div>
                  <div className="row between">
                    <span>Fans</span>
                    <span className="num">+{fmtNum(est.fans)}</span>
                  </div>
                </div>
              </div>
              {ev.momentLeft > 0 ? (
                <button className="btn primary" style={{ width: '100%', marginTop: 10, minHeight: 54, fontSize: 18 }} onClick={() => act((x) => A.hypeCrowd(x), 'none')}>
                  📣 HYPE THE CROWD! ({Math.ceil(ev.momentLeft)}s)
                </button>
              ) : (
                <p className="small muted" style={{ marginTop: 10 }}>
                  Crowd hype bonus this cycle: <b className="good">+{Math.round(ev.hypeBonus * 100)}%</b>{' '}
                  <Tip text="Optional: while you're playing, crowd moments pop up during events. Hit them for +15% payout each (max +30% per cycle). They never happen while you're away." />
                </p>
              )}
              <div className="section-title">HEADLINER (optional)</div>
              <div className="pick">
                <button aria-pressed={!s.run.eventHeadliner} onClick={() => act((x) => A.setHeadliner(x, null), 'none')}>
                  None
                </button>
                {s.run.team.map((t) => (
                  <button
                    key={t.id}
                    aria-pressed={s.run.eventHeadliner === t.id}
                    disabled={busy.has(t.id) && s.run.eventHeadliner !== t.id}
                    onClick={() => act((x) => A.setHeadliner(x, t.id), 'none')}
                  >
                    <Portrait id={t.id} size={24} /> {SKATER_BY_ID[t.id].name.split(' ')[0]} (+{Math.round((d.skaters[t.id]?.hype ?? 0) * 2)}% demand)
                  </button>
                ))}
              </div>
              <div className="row" style={{ marginTop: 10 }}>
                <label className="small row">
                  <input type="checkbox" checked={s.run.autoHost && crew} disabled={!crew} onChange={(e) => act((x) => ((x.run.autoHost = e.target.checked), { ok: true }), 'none')} />
                  Auto re-host {crew ? '' : '(hire an Event Crew)'}
                </label>
                <span className="grow" />
                <button className="btn small ghost" onClick={() => act((x) => A.stopEvent(x), 'none')}>
                  Stop event
                </button>
              </div>
            </div>
          ) : (
            <div className="card">
              <h2>No event running</h2>
              <p className="small muted">{s.run.eventsUnlocked.length ? 'Pick an unlocked event to host.' : 'Unlock your first event on the right.'}</p>
            </div>
          )}
          <div className="card">
            <h2>Venue upgrades</h2>
            {tracksFor('events').map((t) => (
              <TrackRow key={t.id} id={t.id} />
            ))}
          </div>
        </div>
        <div className="card">
          <h2>Events</h2>
          {EVENT_TIERS.map((t, i) => {
            const unlocked = s.run.eventsUnlocked.includes(t.id);
            const lock = eventLock(s, t);
            const prevOk = i === 0 || s.run.eventsUnlocked.includes(EVENT_TIERS[i - 1].id);
            const e2 = estimateEvent(s, d, t);
            return (
              <div key={t.id} className={`item ${lock ? 'locked' : ''}`}>
                <div className="icon" style={{ background: 'var(--pink)' }}>
                  {i + 1}
                </div>
                <div style={{ minWidth: 0 }}>
                  <div className="title">
                    {t.name} {ev?.tierId === t.id && <span className="chip">HOSTING</span>}
                  </div>
                  <div className="sub">{t.desc}</div>
                  <div className="sub">
                    {fmtTime(t.duration)} cycles · base demand {fmtNum(t.demand)} / capacity {fmtNum(t.capacity)} · ≈ {fmtMoney(e2.total)} per cycle{t.broadcast ? ' · broadcastable' : ''}
                  </div>
                </div>
                <div className="actions">
                  {lock ? (
                    <button className="btn small" disabled>
                      {lock}
                    </button>
                  ) : !unlocked ? (
                    <BuyBtn cost={t.unlockCost} cash={s.run.cash} label="Unlock" disabled={!prevOk} disabledText="Unlock previous first" onClick={() => act((x) => A.unlockEvent(x, t.id), 'unlock')} />
                  ) : ev?.tierId === t.id ? (
                    <button className="btn small" disabled>
                      Running
                    </button>
                  ) : (
                    <button className="btn small lime" onClick={() => act((x) => A.hostEvent(x, t.id), 'buy')} title={ev ? 'Switching ends the current event without payout' : undefined}>
                      Host{ev ? ' (switch)' : ''}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
          <p className="tiny muted" style={{ marginBottom: 0 }}>
            Bigger events pay more per minute and are broadcastable. Switching events abandons the current cycle.
          </p>
        </div>
      </div>
    </>
  );
}
