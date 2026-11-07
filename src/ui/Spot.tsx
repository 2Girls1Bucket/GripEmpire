import { useState } from 'react';
import { useGame, useAct, BuyBtn, Bar, LocHead, TipCard, Portrait, Tip, Modal } from './kit';
import { VIDEO_TIERS, VIDEO_BY_ID } from '../game/content/activities';
import { SKATER_BY_ID } from '../game/content/skaters';
import { tracksFor } from '../game/content/tracks';
import * as A from '../game/actions';
import { videoFundCost, videoQuality } from '../game/economy';
import { busySkaters, videoLock } from '../game/unlocks';
import { fmtMoney, fmtNum, fmtRate, fmtTime } from '../game/format';
import { TrackRow } from './Shop';
import { FilmALine } from '../minigame/FilmALine';

export function Spot() {
  const [s, d] = useGame();
  const act = useAct();
  const [playing, setPlaying] = useState(false);
  const [confirmDrop, setConfirmDrop] = useState(false);
  const f = s.run.film;
  const busy = busySkaters(s);
  return (
    <>
      <LocHead title="The Skate Spot" blurb="Fund filming projects, film lines, and release videos that pay royalties for the rest of the run.">
        <button className="btn primary" onClick={() => setPlaying(true)}>
          🎥 Film a Line
        </button>
      </LocHead>
      <TipCard id="tip-spot">
        Fund a project and assign a crew — footage builds automatically from their Tech. Playing <b>Film a Line</b> adds footage faster and raises the video's quality. Released videos
        pay royalties and bring in fans.
      </TipCard>
      <div className="grid two">
        <div className="stack">
          {f ? (
            (() => {
              const tier = VIDEO_BY_ID[f.tierId];
              const q = videoQuality(s, d, tier, f.crew, f.bestGrade);
              const done = f.footage >= f.required;
              const eta = d.footageRate > 0 ? (f.required - f.footage) / d.footageRate : Infinity;
              return (
                <div className="card">
                  <div className="tape" />
                  <h2>Now filming: {tier.name}</h2>
                  <div className="row between small">
                    <span>
                      Footage {fmtNum(f.footage)} / {fmtNum(f.required)}
                    </span>
                    <span>{done ? <b className="good">Ready to release!</b> : d.footageRate > 0 ? `${fmtNum(d.footageRate)}/s auto · ${fmtTime(eta)}` : 'No crew assigned — no auto footage'}</span>
                  </div>
                  <Bar value={f.footage} max={f.required} tone="pink" label="Footage" />
                  <div className="small" style={{ marginTop: 8 }}>
                    Expected quality <b>{q.toFixed(2)}</b>{' '}
                    <Tip text="Quality = 0.5 + crew Tech vs the tier's standard (up to +0.75) + Editing Suite + best Film a Line grade on this project (up to +0.6). Royalties and fans scale with quality." />{' '}
                    → royalties ≈ <b className="warn">{fmtRate(d.shopBase * tier.royaltyFrac * q * A.videoFatigue(s, f.tierId))}</b>, +{fmtNum(tier.fans * q * A.videoFatigue(s, f.tierId))} fans
                  </div>
                  {A.videoFatigue(s, f.tierId) < 1 && (
                    <div className="small warn">
                      Audience fatigue ×{A.videoFatigue(s, f.tierId).toFixed(2)}: you've already released {s.run.videos.filter((v) => v.tierId === f.tierId).length} {tier.name}
                      {s.run.videos.filter((v) => v.tierId === f.tierId).length === 1 ? '' : 's'} this run. Bigger tiers pay more.
                    </div>
                  )}
                  <div className="small muted">Best line grade on this project: {Math.round(f.bestGrade * 100)}% · lines filmed: {f.linesPlayed}</div>
                  <div className="section-title">CREW (up to {tier.maxCrew})</div>
                  <div className="pick">
                    {s.run.team.map((t) => {
                      const on = f.crew.includes(t.id);
                      const isBusy = busy.has(t.id) && !on;
                      return (
                        <button
                          key={t.id}
                          aria-pressed={on}
                          disabled={isBusy || (!on && f.crew.length >= tier.maxCrew)}
                          onClick={() => act((x) => A.setFilmCrew(x, on ? f.crew.filter((c) => c !== t.id) : [...f.crew, t.id]), 'none')}
                        >
                          <Portrait id={t.id} size={24} /> {SKATER_BY_ID[t.id].name.split(' ')[0]} · Tech {fmtNum(d.skaters[t.id]?.tech ?? 0)}
                        </button>
                      );
                    })}
                    {!s.run.team.length && <span className="small muted">Sign skaters at Team HQ to film automatically. You can still film lines yourself.</span>}
                  </div>
                  <div className="row" style={{ marginTop: 10 }}>
                    <button className="btn lime" disabled={!done} onClick={() => act((x, dd) => A.releaseVideo(x, dd), 'none')}>
                      🎬 Release video
                    </button>
                    {!done && (
                      <button className="btn primary" onClick={() => setPlaying(true)}>
                        Film a Line
                      </button>
                    )}
                    <span className="grow" />
                    <button className="btn small ghost" onClick={() => setConfirmDrop(true)}>
                      Drop project
                    </button>
                  </div>
                </div>
              );
            })()
          ) : (
            <div className="card">
              <h2>No project in progress</h2>
              <p className="small muted">Pick a project on the right to fund it. One project films at a time.</p>
            </div>
          )}
          <div className="card">
            <h2>
              Released videos <span className="chip y">{fmtRate(d.royalties)}</span>
            </h2>
            {s.run.videos.length === 0 && <p className="small muted">Nothing released yet this run.</p>}
            {[...s.run.videos].reverse().slice(0, 12).map((v, i) => (
              <div key={i} className="row between small">
                <span>
                  “{v.title}” <span className="muted">({VIDEO_BY_ID[v.tierId].name}, Q {v.quality.toFixed(2)})</span>
                </span>
                <span className="num">{fmtRate(v.royaltyBase * (d.royalties / Math.max(1e-300, s.run.videos.reduce((a, x) => a + x.royaltyBase, 0))))}</span>
              </div>
            ))}
            {s.run.videos.length > 12 && <p className="tiny muted">…and {s.run.videos.length - 12} older videos.</p>}
          </div>
          {s.meta.nodes.producer ? (
            <div className="card">
              <h3>Producer</h3>
              <div className="row">
                <button className={`btn small ${s.run.autoProduce ? 'lime' : ''}`} onClick={() => act((x) => A.setAutoProduce(x, !x.run.autoProduce), 'none')}>
                  {s.run.autoProduce ? 'ON' : 'OFF'}
                </button>
                <span className="small muted">Releases finished videos and funds the best project costing ≤30% of your cash, crewed by your highest-Tech free skaters.</span>
              </div>
            </div>
          ) : null}
        </div>
        <div className="stack">
          <div className="card">
            <h2>Fund a project</h2>
            {VIDEO_TIERS.map((t) => {
              const lock = videoLock(s, t);
              const cost = videoFundCost(s, t);
              const count = s.run.videoCounts[t.id] ?? 0;
              return (
                <div key={t.id} className={`item ${lock ? 'locked' : ''}`}>
                  <div className="icon" style={{ background: 'var(--pink)' }}>
                    🎬
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div className="title">
                      {t.name} {count > 0 && <span className="lvl">funded ×{count}</span>}
                    </div>
                    <div className="sub">{t.desc}</div>
                    <div className="sub">
                      {fmtNum(t.footage)} footage · crew {t.maxCrew} · Tech standard {t.techNorm} · royalties ≈ {Math.round(t.royaltyFrac * 100)}% of shop base × quality
                    </div>
                  </div>
                  <div className="actions">
                    {lock ? (
                      <button className="btn small" disabled>
                        {lock}
                      </button>
                    ) : (
                      <BuyBtn cost={cost} cash={s.run.cash} label="Fund" disabled={!!f} disabledText="Project running" onClick={() => act((x) => A.fundFilm(x, t.id, freeCrew(x, t.maxCrew)), 'unlock')} />
                    )}
                  </div>
                </div>
              );
            })}
            <p className="tiny muted" style={{ marginBottom: 0 }}>
              Each repeat of a tier costs more and suffers 25% audience fatigue per earlier release this run, so climb to bigger tiers. Royalties are captured from your shop size at release.
            </p>
          </div>
          <div className="card">
            <h2>Gear</h2>
            {tracksFor('media').map((t) => (
              <TrackRow key={t.id} id={t.id} />
            ))}
          </div>
        </div>
      </div>
      {playing && <FilmALine onClose={() => setPlaying(false)} />}
      {confirmDrop && (
        <Modal title="Drop this project?" onClose={() => setConfirmDrop(false)}>
          <p>The funding and the footage so far are lost. The crew becomes free.</p>
          <div className="row">
            <button
              className="btn danger"
              onClick={() => {
                act((x) => A.dropFilm(x), 'none');
                setConfirmDrop(false);
              }}
            >
              Drop it
            </button>
            <button className="btn" onClick={() => setConfirmDrop(false)}>
              Keep filming
            </button>
          </div>
        </Modal>
      )}
      <span className="sr-only">{fmtMoney(s.run.cash)}</span>
    </>
  );
}

function freeCrew(s: Parameters<typeof busySkaters>[0], n: number) {
  const busy = busySkaters(s);
  return s.run.team
    .map((t) => t.id)
    .filter((id) => !busy.has(id))
    .slice(0, n);
}
