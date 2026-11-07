// Time advancement. All progress is driven by elapsed seconds, never by frame counts.
import type { GameState } from './state';
import { computeDerived, estimateEvent, estimateJob, safe, type Derived } from './economy';
import { ASSIGNMENT_BY_ID, EVENT_BY_ID } from './content/activities';
import { ACHIEVEMENTS } from './content/achievements';
import { earn, runAutoBuyer, runProducer, spawnOpportunity } from './actions';
import { checkAccomplishments } from './prestige';
import { refreshSkaterPool } from './unlocks';
import { feedback } from './feedback';
import { SKATER_BY_ID } from './content/skaters';
import { fmtMoney } from './format';

export interface TickCtx {
  mode: 'online' | 'offline';
  /** The player is present (tab visible + recent input). Enables opportunities and crowd moments. */
  engaged?: boolean;
  rand?: () => number;
  report?: TickReport;
  /** Suppress UI feedback (offline catch-up, simulations). */
  quiet?: boolean;
}

export interface TickReport {
  jobs: number;
  events: number;
  jobCash: number;
  eventCash: number;
  passiveCash: number;
  fans: number;
}

export const newReport = (): TickReport => ({ jobs: 0, events: 0, jobCash: 0, eventCash: 0, passiveCash: 0, fans: 0 });

const say = (ctx: TickCtx, f: Parameters<typeof feedback.emit>[0]) => {
  if (!ctx.quiet) feedback.emit(f);
};

/** Advance the game by dt seconds. */
export function tick(s: GameState, dtIn: number, ctx: TickCtx, dIn?: Derived) {
  if (!(dtIn > 0) || !Number.isFinite(dtIn)) return;
  const dt = Math.min(dtIn, 60);
  const r = s.run;
  const d = dIn ?? computeDerived(s);
  const offline = ctx.mode === 'offline';
  const eff = offline ? d.offlineEff : 1;
  const rand = ctx.rand ?? Math.random;
  const rep = ctx.report;

  // ---- Passive income ----
  const income = offline
    ? d.shopPassive * eff + d.online * Math.min(1, eff * 2) + d.royalties * eff + d.brandIncome * eff + d.parkIncome * eff + d.members
    : d.passive;
  const got = earn(s, income * dt, 'passiveEarned');
  if (rep) rep.passiveCash += got;

  const fansBefore = r.fans;
  r.fans = safe(r.fans + d.brandFansPerSec * dt * eff);

  // ---- Assignments ----
  for (const j of [...r.jobs]) {
    j.elapsed += dt * eff;
    if (j.elapsed < j.duration) continue;
    const a = ASSIGNMENT_BY_ID[j.assignmentId];
    const est = estimateJob(s, d, a, j.skaters);
    const paid = earn(s, est.payout, 'jobEarned');
    r.fans = safe(r.fans + est.fans);
    if (a.merchBoost) r.merchBoost = Math.min(3, r.merchBoost + a.merchBoost);
    if (a.kind === 'tour') {
      r.stats.toursDone++;
      s.meta.stats.toursDone++;
    }
    if (a.kind === 'contest' && est.place === '1st place') {
      r.stats.contestWins++;
      s.meta.stats.contestWins++;
    }
    if (rep) {
      rep.jobs++;
      rep.jobCash += paid;
    }
    const who = j.skaters.map((id) => SKATER_BY_ID[id]?.name.split(' ')[0]).join(' & ');
    say(ctx, { kind: 'job', text: `${who}: ${a.name} done${est.place ? ' — ' + est.place : ''}! +${fmtMoney(paid)}`, amount: paid });
    if (j.repeat && (r.tracks.manager ?? 0) > 0) {
      j.elapsed = 0;
      j.duration = estimateJob(s, d, a, j.skaters).duration;
    } else {
      r.jobs = r.jobs.filter((x) => x !== j);
    }
  }

  // ---- Filming (automated route) ----
  const f = r.film;
  if (f && f.footage < f.required) f.footage = Math.min(f.required, f.footage + d.footageRate * dt * eff);

  // ---- Hosted events ----
  const ev = r.event;
  if (ev) {
    ev.elapsed += dt * eff;
    if (!offline && ctx.engaged) {
      if (ev.momentLeft > 0) ev.momentLeft = Math.max(0, ev.momentLeft - dt);
      else if (ev.hypeBonus < 0.3) {
        ev.momentIn -= dt;
        if (ev.momentIn <= 0) {
          ev.momentLeft = 8;
          ev.momentIn = ev.duration * (0.2 + rand() * 0.2);
        }
      }
    } else ev.momentLeft = 0;
    if (ev.elapsed >= ev.duration) {
      const t = EVENT_BY_ID[ev.tierId];
      const est = estimateEvent(s, d, t, ev.hypeBonus);
      const paid = earn(s, est.total, 'eventEarned');
      r.fans = safe(r.fans + est.fans);
      r.stats.eventsHosted++;
      s.meta.stats.eventsHosted++;
      if (rep) {
        rep.events++;
        rep.eventCash += paid;
      }
      say(ctx, { kind: 'event', text: `${t.name} wrapped: ${Math.round(est.attendance).toLocaleString('en-US')} people, +${fmtMoney(paid)}`, amount: paid });
      if (r.autoHost && (r.tracks.eventCrew ?? 0) > 0) {
        ev.elapsed = 0;
        ev.hypeBonus = 0;
        ev.momentLeft = 0;
        ev.momentIn = ev.duration * (0.25 + rand() * 0.3);
      } else r.event = null;
    }
  }

  // ---- Active-only systems ----
  if (offline) {
    r.sinceServe = 999;
    r.streak = 0;
    r.rushLeft = 0;
    r.opp = null;
  } else {
    r.sinceServe = Math.min(999, r.sinceServe + dt);
    if (r.sinceServe > 2.5) r.streak = Math.max(0, r.streak - 6 * dt);
    if (r.rushLeft > 0) r.rushLeft = Math.max(0, r.rushLeft - dt);
    const o = r.opp;
    if (o) {
      if (o.kind === 'bulk' && o.accepted) {
        o.timeLeft -= dt;
        if (o.timeLeft <= 0) {
          const reward = o.rewardSec * d.shopBase * d.oppReward * (o.progress / o.need) * 0.5;
          earn(s, reward, 'oppEarned');
          say(ctx, { kind: 'opp', text: `${o.label}: partial delivery (${o.progress}/${o.need})`, amount: reward });
          r.opp = null;
          r.nextOppIn = 90 + rand() * 60;
        }
      } else {
        o.expires -= dt;
        if (o.expires <= 0) {
          r.opp = null;
          r.nextOppIn = 60 + rand() * 60;
        }
      }
    } else if (ctx.engaged && r.stats.serves >= 10) {
      r.nextOppIn -= dt * d.oppFreq;
      if (r.nextOppIn <= 0) r.opp = spawnOpportunity(s, rand);
    }
  }

  r.time += dt;
  s.meta.stats.playTime += dt;
  if (rep) rep.fans += r.fans - fansBefore;
}

/** Low-frequency checks: skater scouting, achievements, accomplishments, automation. */
export function periodic(s: GameState, ctx: TickCtx) {
  for (const id of refreshSkaterPool(s)) say(ctx, { kind: 'unlock', text: `New skater scouted: ${SKATER_BY_ID[id].name}` });
  for (const a of ACHIEVEMENTS) {
    if (!s.meta.achievements.includes(a.id) && a.check(s)) {
      s.meta.achievements.push(a.id);
      say(ctx, { kind: 'achievement', text: `Achievement: ${a.name} (+1% income)` });
    }
  }
  checkAccomplishments(s);
  if (ctx.mode === 'online') {
    if (s.run.autoBuy && (s.meta.nodes.autobuy ?? 0) > 0) runAutoBuyer(s);
    if (s.run.autoProduce && (s.meta.nodes.producer ?? 0) > 0) runProducer(s);
  }
}

export interface OfflineSummary {
  elapsed: number;
  simulated: number;
  capped: boolean;
  efficiency: number;
  earned: number;
  fans: number;
  jobs: number;
  events: number;
  filmProgress: number;
}

/** Apply offline progress for `elapsedSec` real seconds away. Uses the offline cap and efficiency. */
export function simulateOffline(s: GameState, elapsedSec: number): OfflineSummary {
  const d0 = computeDerived(s);
  const elapsed = Math.max(0, Number.isFinite(elapsedSec) ? elapsedSec : 0);
  const simulated = Math.min(elapsed, d0.offlineCapSec);
  const rep = newReport();
  const ctx: TickCtx = { mode: 'offline', report: rep, quiet: true };
  const earnBefore = s.run.earnings;
  const filmBefore = s.run.film ? s.run.film.footage : 0;
  const step = simulated > 4 * 3600 ? 10 : 5;
  let t = 0;
  let d = d0;
  let sinceDerive = 0;
  let lastJobs = 0;
  let lastEvents = 0;
  while (t < simulated) {
    const dt = Math.min(step, simulated - t);
    tick(s, dt, ctx, d);
    t += dt;
    sinceDerive += dt;
    // Recompute modifiers whenever something discrete happened, or every minute (fans drift).
    if (rep.jobs !== lastJobs || rep.events !== lastEvents || sinceDerive >= 60) {
      d = computeDerived(s);
      sinceDerive = 0;
      lastJobs = rep.jobs;
      lastEvents = rep.events;
    }
  }
  periodic(s, ctx);
  return {
    elapsed,
    simulated,
    capped: elapsed > d0.offlineCapSec,
    efficiency: d0.offlineEff,
    earned: s.run.earnings - earnBefore,
    fans: rep.fans,
    jobs: rep.jobs,
    events: rep.events,
    filmProgress: s.run.film ? s.run.film.footage - filmBefore : 0,
  };
}
