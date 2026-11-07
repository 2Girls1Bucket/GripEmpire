// Film a Line: canvas renderer + controls. Logic lives in ./line.ts.
import { useCallback, useEffect, useRef, useState } from 'react';
import { useGame, useEngine, Portrait } from '../ui/kit';
import { SKATER_BY_ID } from '../game/content/skaters';
import * as A from '../game/actions';
import { fmtMoney, fmtNum } from '../game/format';
import { sfx } from '../platform/audio';
import { getSettings, reducedMotion, updateSettings } from '../platform/settings';
import {
  chooseBank,
  chooseHammer,
  createLine,
  gradeLetter,
  gradeOf,
  landHalf,
  nextObstacle,
  popHalf,
  POP_OFFSET,
  pressLand,
  pressTrick,
  TARGET_SCORE,
  update,
  type LineState,
  type Obstacle,
  type Tier,
} from './line';

const W = 960;
const H = 380;
const GROUND = 300;
const SKATER_X = 230;

interface Popup {
  text: string;
  color: string;
  t: number;
}
interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
}

export function FilmALine({ onClose }: { onClose: () => void }) {
  const [s, d] = useGame();
  const engine = useEngine();
  const [stage, setStageRaw] = useState<'intro' | 'play' | 'result'>('intro');
  const [attempt, setAttempt] = useState(0);
  const setStage = (st: 'intro' | 'play' | 'result') => {
    if (st === 'play') setAttempt((a) => a + 1);
    setStageRaw(st);
  };
  const [skater, setSkater] = useState<string>(() => {
    const crew = s.run.film?.crew ?? [];
    return crew[0] ?? s.run.team[0]?.id ?? 'you';
  });
  const [result, setResult] = useState<{ score: number; grade: number; perfects: number; bails: number; cash: number; footage: number } | null>(null);
  const tech = skater === 'you' ? 4 : d.skaters[skater]?.tech ?? 4;
  const forgiveness = d.lineTiming * (1 + Math.min(0.5, tech / 100));
  const pointsMult = 1 + Math.min(1, tech / 60);

  const onFinish = useCallback(
    (line: LineState) => {
      const grade = gradeOf(line.score);
      const attemptId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const r = engine.act((st, dd) => A.applyLineResult(st, { attemptId, score: line.score, grade, perfects: line.perfects }, dd));
      setResult({ score: line.score, grade, perfects: line.perfects, bails: line.bails, cash: r?.cash ?? 0, footage: r?.footage ?? 0 });
      setStageRaw('result');
    },
    [engine],
  );

  return (
    <div className="modal-back" role="dialog" aria-modal="true" aria-label="Film a Line">
      <div className="modal" style={{ maxWidth: 1000 }}>
        <div className="row between">
          <h2 style={{ margin: 0 }}>🎥 Film a Line</h2>
          <div className="row">
            <button className="iconbtn" aria-label={getSettings().muted ? 'Unmute' : 'Mute'} onClick={() => updateSettings({ muted: !getSettings().muted })}>
              {getSettings().muted ? '🔇' : '🔊'}
            </button>
            {stage !== 'play' && (
              <button className="btn small" onClick={onClose}>
                Close
              </button>
            )}
          </div>
        </div>
        {stage === 'intro' && (
          <Intro skater={skater} setSkater={setSkater} forgiveness={forgiveness} pointsMult={pointsMult} onStart={() => setStage('play')} />
        )}
        {stage === 'play' && <Play key={attempt} forgiveness={forgiveness} pointsMult={pointsMult} skaterId={skater} onFinish={onFinish} onQuit={() => setStage('intro')} />}
        {stage === 'result' && result && (
          <div className="stack" style={{ marginTop: 10 }}>
            <div className="row" style={{ gap: 18 }}>
              <div className="sticker" style={{ fontSize: 60, padding: '6px 22px', background: result.grade >= 1 ? 'var(--lime)' : result.grade >= 0.4 ? 'var(--yellow)' : 'var(--red)' }}>
                {gradeLetter(result.grade)}
              </div>
              <div>
                <div style={{ fontFamily: 'var(--display)', fontSize: 26 }}>{fmtNum(result.score)} pts</div>
                <div className="muted">
                  {result.perfects} perfect landing{result.perfects === 1 ? '' : 's'} · {result.bails} bail{result.bails === 1 ? '' : 's'} · grade {(result.grade * 100).toFixed(0)}% (100% = {fmtNum(TARGET_SCORE)} pts)
                </div>
              </div>
            </div>
            <div className="card">
              <div className="row between">
                <span>Footage sold to the shop channel</span>
                <b className="warn">+{fmtMoney(result.cash)}</b>
              </div>
              {s.run.film ? (
                <div className="row between">
                  <span>Footage added to the project</span>
                  <b className="good">{result.footage > 0 ? `+${fmtNum(result.footage)}` : s.run.film.footage >= s.run.film.required ? 'Project full — release it!' : '+0'}</b>
                </div>
              ) : (
                <div className="small muted">No filming project active — fund one at the Spot to turn lines into video footage.</div>
              )}
              {result.bails > 0 && <div className="small muted">Bails only cost you combo and potential points — nothing you earned is taken away.</div>}
            </div>
            <div className="row">
              <button className="btn primary" onClick={() => setStage('play')} autoFocus>
                Film another line
              </button>
              <button className="btn" onClick={onClose}>
                Done
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Intro({ skater, setSkater, forgiveness, pointsMult, onStart }: { skater: string; setSkater: (id: string) => void; forgiveness: number; pointsMult: number; onStart: () => void }) {
  const [s, d] = useGame();
  const prev = A.lineRewardPreview(s, 1, d);
  return (
    <div className="grid halves" style={{ marginTop: 10 }}>
      <div className="card paper">
        <div className="tape" />
        <h3>How to film a line</h3>
        <ol className="small" style={{ paddingLeft: 18, margin: 0 }}>
          <li>
            Your skater rolls automatically. When the green <b>POP</b> zone reaches them, pick a trick: <span className="kbd">Z</span>/<span className="kbd">←</span> easy,{' '}
            <span className="kbd">X</span>/<span className="kbd">↑</span> medium, <span className="kbd">C</span>/<span className="kbd">→</span> hard.
          </li>
          <li>
            In the air, press <span className="kbd">Space</span> (or any trick key) when the shrinking ring meets the target ring to land.
          </li>
          <li>Harder tricks score more but have tighter landing windows. Clean landings build your combo.</li>
          <li>Stairs and gaps must be popped. Missing a ledge, rail or kicker just breaks the combo.</li>
          <li>
            At the end: <span className="kbd">B</span> bank the footage, or <span className="kbd">H</span> try the hammer (land = score ×1.5, bail = ×0.8).
          </li>
        </ol>
        <p className="small muted" style={{ marginBottom: 0 }}>
          Touch: use the on-screen buttons. 3 bails end the line, but you keep what you scored.
        </p>
      </div>
      <div className="stack">
        <div className="card">
          <h3>Who's skating?</h3>
          <div className="pick">
            <button aria-pressed={skater === 'you'} onClick={() => setSkater('you')}>
              <span style={{ width: 24, height: 24, display: 'grid', placeItems: 'center' }}>🧑</span> You
            </button>
            {s.run.team.map((t) => (
              <button key={t.id} aria-pressed={skater === t.id} onClick={() => setSkater(t.id)}>
                <Portrait id={t.id} size={24} />
                {SKATER_BY_ID[t.id].name.split(' ')[0]} (Tech {fmtNum(d.skaters[t.id]?.tech ?? 0)})
              </button>
            ))}
          </div>
          <p className="small" style={{ marginBottom: 0 }}>
            Timing windows ×{forgiveness.toFixed(2)} · points ×{pointsMult.toFixed(2)}. Higher Tech, the Fisheye upgrade and Film Instinct make lines more forgiving.
          </p>
        </div>
        <div className="card">
          <h3>Rewards</h3>
          <p className="small" style={{ margin: 0 }}>
            An A-grade line (≈{fmtNum(TARGET_SCORE)} pts) sells for about <b className="warn">{fmtMoney(prev.cash)}</b>
            {s.run.film ? (
              <>
                {' '}
                and adds about <b className="good">{fmtNum(prev.footage)}</b> footage to your current project (it also raises the video's quality).
              </>
            ) : (
              <>. Fund a filming project first to also earn footage.</>
            )}
          </p>
        </div>
        <button className="btn primary" style={{ minHeight: 54, fontSize: 18 }} onClick={onStart} autoFocus>
          Drop in! ▶
        </button>
      </div>
    </div>
  );
}

function Play({ forgiveness, pointsMult, skaterId, onFinish, onQuit }: { forgiveness: number; pointsMult: number; skaterId: string; onFinish: (l: LineState) => void; onQuit: () => void }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const line = useRef<LineState>(createLine(Math.floor(Math.random() * 1e9), forgiveness, pointsMult));
  const popups = useRef<Popup[]>([]);
  const parts = useRef<Particle[]>([]);
  const shake = useRef(0);
  const finished = useRef(false);
  const [, setTick] = useState(0);
  const reduced = reducedMotion();
  const color = skaterId === 'you' ? '#ff6b1a' : SKATER_BY_ID[skaterId]?.portrait.shirt ?? '#ff6b1a';

  // Exposed read-only for automated browser checks.
  (window as unknown as { __line: LineState }).__line = line.current;
  const trick = useCallback((t: Tier) => pressTrick(line.current, t), []);
  const land = useCallback(() => pressLand(line.current), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const l = line.current;
      const k = e.code;
      if (e.repeat) return;
      if (k === 'KeyZ' || k === 'ArrowLeft') trick(0);
      else if (k === 'KeyX' || k === 'ArrowUp') trick(1);
      else if (k === 'KeyC' || k === 'ArrowRight') trick(2);
      else if (k === 'Space' || k === 'Enter' || k === 'ArrowDown') land();
      else if (k === 'KeyB') chooseBank(l);
      else if (k === 'KeyH') chooseHammer(l);
      else if (k === 'Escape') onQuit();
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [trick, land, onQuit]);

  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const loop = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      const l = line.current;
      update(l, dt);
      // consume events → popups, sounds, particles
      for (const ev of l.events.splice(0)) {
        if (ev.type === 'pop') sfx.pop();
        if (ev.type === 'land') {
          sfx.land(ev.quality === 'perfect');
          popups.current.push({ text: `${ev.trick} — ${ev.quality.toUpperCase()} +${fmtNum(ev.points)}`, color: ev.quality === 'perfect' ? '#c6ff3d' : ev.quality === 'good' ? '#ffd23d' : '#ff9a5a', t: 1.4 });
          if (!reduced) for (let i = 0; i < 12; i++) parts.current.push({ x: SKATER_X, y: GROUND, vx: (Math.random() - 0.5) * 220, vy: -Math.random() * 160, life: 0.6, color: '#d8d2c4' });
        }
        if (ev.type === 'bail') {
          sfx.bail();
          popups.current.push({ text: `BAIL! ${ev.reason}`, color: '#ff3d5a', t: 1.6 });
          if (!reduced) shake.current = 0.35;
        }
        if (ev.type === 'skip') popups.current.push({ text: `Skipped the ${ev.kind} — combo lost`, color: '#aeaab8', t: 1.2 });
        if (ev.type === 'hammer') popups.current.push({ text: 'GOING FOR THE HAMMER!', color: '#ff4fa3', t: 1.6 });
        if (ev.type === 'done' && !finished.current) {
          finished.current = true;
          setTimeout(() => onFinish(l), 700);
        }
        setTick((x) => x + 1);
      }
      for (const p of popups.current) p.t -= dt;
      popups.current = popups.current.filter((p) => p.t > 0);
      for (const p of parts.current) {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vy += 500 * dt;
        p.life -= dt;
      }
      parts.current = parts.current.filter((p) => p.life > 0);
      shake.current = Math.max(0, shake.current - dt);
      draw(canvas.current, l, popups.current, parts.current, shake.current, color);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [onFinish, reduced, color]);

  const l = line.current;
  return (
    <div className="film" style={{ marginTop: 10 }}>
      <canvas
        ref={canvas}
        width={W}
        height={H}
        aria-label="Film a Line. Use Z, X, C to pop tricks and Space to land."
        onPointerDown={(e) => {
          e.preventDefault();
          if (line.current.phase === 'air') land();
        }}
      />
      {l.phase === 'choice' ? (
        <div className="controls" style={{ gridTemplateColumns: '1fr 1fr' }}>
          <button className="btn lime" onClick={() => chooseBank(line.current)}>
            Bank it (B)
          </button>
          <button className="btn primary" onClick={() => chooseHammer(line.current)}>
            Hammer! (H)
          </button>
        </div>
      ) : (
        <div className="controls">
          <button className="btn" onPointerDown={(e) => (e.preventDefault(), trick(0))}>
            Easy (Z)
          </button>
          <button className="btn" onPointerDown={(e) => (e.preventDefault(), trick(1))}>
            Medium (X)
          </button>
          <button className="btn" onPointerDown={(e) => (e.preventDefault(), trick(2))}>
            Hard (C)
          </button>
          <button className="btn lime" onPointerDown={(e) => (e.preventDefault(), land())}>
            LAND (Space)
          </button>
        </div>
      )}
      <div className="row between small muted" style={{ marginTop: 6 }}>
        <span>Esc to stop (no reward).</span>
        <button className="btn small ghost" onClick={onQuit}>
          Stop
        </button>
      </div>
    </div>
  );
}

// ---------------- drawing ----------------
function draw(cv: HTMLCanvasElement | null, l: LineState, popups: Popup[], parts: Particle[], shake: number, color: string) {
  if (!cv) return;
  const g = cv.getContext('2d');
  if (!g) return;
  g.save();
  if (shake > 0) g.translate((Math.random() - 0.5) * 10 * shake, (Math.random() - 0.5) * 10 * shake);
  // sky
  const sky = g.createLinearGradient(0, 0, 0, GROUND);
  sky.addColorStop(0, '#5aa0d0');
  sky.addColorStop(1, '#f6d7a0');
  g.fillStyle = sky;
  g.fillRect(-20, -20, W + 40, H + 40);
  // sun
  g.fillStyle = '#ffd23d';
  g.beginPath();
  g.arc(780, 90, 40, 0, Math.PI * 2);
  g.fill();
  // skyline parallax
  g.fillStyle = '#6b7f99';
  for (let i = 0; i < 14; i++) {
    const bx = ((i * 140 - l.x * 0.15) % (14 * 140) + 14 * 140) % (14 * 140) - 100;
    const bh = 60 + ((i * 53) % 90);
    g.fillRect(bx, GROUND - 40 - bh, 90, bh + 40);
  }
  // wall + graffiti parallax
  g.fillStyle = '#8a8070';
  g.fillRect(-20, GROUND - 60, W + 40, 60);
  const tags = ['#ff4fa3', '#3dc6ff', '#c6ff3d', '#ff6b1a'];
  for (let i = 0; i < 10; i++) {
    const bx = ((i * 260 - l.x * 0.5) % 2600 + 2600) % 2600 - 150;
    g.fillStyle = tags[i % 4];
    g.globalAlpha = 0.55;
    g.beginPath();
    g.ellipse(bx, GROUND - 30, 50, 16, -0.1, 0, Math.PI * 2);
    g.fill();
    g.globalAlpha = 1;
  }
  // ground
  g.fillStyle = '#9a958c';
  g.fillRect(-20, GROUND, W + 40, H - GROUND + 20);
  g.strokeStyle = '#7f7a72';
  g.lineWidth = 2;
  for (let i = 0; i < 12; i++) {
    const gx = ((i * 120 - l.x) % 1440 + 1440) % 1440 - 100;
    g.beginPath();
    g.moveTo(gx, GROUND);
    g.lineTo(gx - 40, H);
    g.stroke();
  }
  const sx = (wx: number) => wx - l.x + SKATER_X;
  // pop zone for next obstacle
  const nx = nextObstacle(l);
  if (nx && (l.phase === 'roll' || l.phase === 'slam')) {
    const zc = sx(nx.x - POP_OFFSET);
    const half = popHalf(l);
    if (zc - half < W && zc + half > -50) {
      g.fillStyle = 'rgba(198,255,61,0.35)';
      g.fillRect(zc - half * 1.6, GROUND, half * 3.2, 14);
      g.fillStyle = 'rgba(198,255,61,0.85)';
      g.fillRect(zc - half, GROUND, half * 2, 14);
      g.fillStyle = '#111';
      g.font = '12px Bungee, Impact, sans-serif';
      g.textAlign = 'center';
      g.fillText('POP', zc, GROUND + 12);
    }
  }
  for (const o of l.obs) drawObstacle(g, o, sx(o.x));
  // skater
  let y = GROUND;
  let boardRot = 0;
  let flip = 0;
  if (l.phase === 'air' && l.air) {
    const p = Math.min(1.15, (l.t - l.air.start) / l.air.dur);
    const hgt = l.air.obstacle.kind === 'hammer' ? 130 : 95;
    y = GROUND - Math.max(0, 4 * hgt * p * (1 - p));
    flip = p * Math.PI * 2 * (l.air.tier + 1);
    boardRot = Math.sin(p * Math.PI) * -0.25;
    // landing ring
    const target = l.air.start + l.air.dur;
    const rem = target - l.t;
    const half = landHalf(l, l.air.tier);
    const r = 22 + Math.max(0, rem) * 120;
    const close = Math.abs(rem) <= half;
    g.lineWidth = 4;
    g.strokeStyle = '#fff';
    g.beginPath();
    g.arc(SKATER_X, y - 30, 22, 0, Math.PI * 2);
    g.stroke();
    g.strokeStyle = close ? '#c6ff3d' : rem > 0 ? '#ffd23d' : '#ff3d5a';
    g.beginPath();
    g.arc(SKATER_X, y - 30, r, 0, Math.PI * 2);
    g.stroke();
  }
  drawSkater(g, SKATER_X, y, l.phase === 'slam', boardRot, flip, color, l.t);
  // particles
  for (const p of parts) {
    g.fillStyle = p.color;
    g.globalAlpha = Math.max(0, p.life / 0.6);
    g.fillRect(p.x, p.y, 4, 4);
    g.globalAlpha = 1;
  }
  g.restore();
  // HUD
  g.fillStyle = 'rgba(0,0,0,0.55)';
  g.fillRect(10, 10, 300, 64);
  g.fillStyle = '#ffd23d';
  g.font = '26px Bungee, Impact, sans-serif';
  g.textAlign = 'left';
  g.fillText(`${Math.round(l.score).toLocaleString('en-US')}`, 22, 42);
  g.fillStyle = '#c6ff3d';
  g.font = '14px Bungee, Impact, sans-serif';
  g.fillText(`COMBO ×${l.combo.toFixed(1)}`, 22, 64);
  g.fillStyle = '#fff';
  g.fillText(`${'🛹'.repeat(Math.max(0, l.lives))}`, 190, 64);
  const doneCount = l.obs.filter((o) => o.done && o.kind !== 'hammer').length;
  g.textAlign = 'right';
  g.fillStyle = 'rgba(0,0,0,0.55)';
  g.fillRect(W - 170, 10, 160, 34);
  g.fillStyle = '#fff';
  g.fillText(`SPOT ${Math.min(doneCount + 1, 9)}/9`, W - 22, 33);
  // popups
  g.textAlign = 'center';
  popups.forEach((p, i) => {
    g.globalAlpha = Math.min(1, p.t);
    g.fillStyle = '#000';
    g.font = '18px Bungee, Impact, sans-serif';
    const ty = 130 - i * 26 - (1.6 - p.t) * 12;
    g.fillText(p.text, W / 2 + 2, ty + 2);
    g.fillStyle = p.color;
    g.fillText(p.text, W / 2, ty);
    g.globalAlpha = 1;
  });
  if (l.phase === 'choice') {
    g.fillStyle = 'rgba(0,0,0,0.6)';
    g.fillRect(W / 2 - 260, 150, 520, 90);
    g.fillStyle = '#fff';
    g.font = '20px Bungee, Impact, sans-serif';
    g.fillText('BANK IT [B]   or   HAMMER [H]?', W / 2, 188);
    g.font = '14px system-ui, sans-serif';
    g.fillText(`Auto-banks in ${Math.ceil(l.choiceLeft)}s · Hammer: land ×1.5, bail ×0.8`, W / 2, 218);
  }
  if (l.phase === 'done') {
    g.fillStyle = 'rgba(0,0,0,0.5)';
    g.fillRect(0, 0, W, H);
    g.fillStyle = '#c6ff3d';
    g.font = '40px Bungee, Impact, sans-serif';
    g.fillText("THAT'S A WRAP!", W / 2, H / 2);
  }
}

function drawObstacle(g: CanvasRenderingContext2D, o: Obstacle, x: number) {
  if (x < -300 || x > W + 300) return;
  g.lineWidth = 3;
  g.strokeStyle = '#000';
  switch (o.kind) {
    case 'ledge':
      g.fillStyle = '#c9c2b2';
      g.fillRect(x - 70, GROUND - 32, 140, 32);
      g.strokeRect(x - 70, GROUND - 32, 140, 32);
      g.fillStyle = '#ffd23d';
      g.fillRect(x - 70, GROUND - 34, 140, 5);
      break;
    case 'rail':
      g.strokeStyle = '#333';
      g.lineWidth = 6;
      g.beginPath();
      g.moveTo(x - 80, GROUND - 40);
      g.lineTo(x + 80, GROUND - 40);
      g.moveTo(x - 70, GROUND - 40);
      g.lineTo(x - 70, GROUND);
      g.moveTo(x + 70, GROUND - 40);
      g.lineTo(x + 70, GROUND);
      g.stroke();
      break;
    case 'stairs':
    case 'hammer': {
      const steps = o.kind === 'hammer' ? 9 : 5;
      const sw = o.kind === 'hammer' ? 22 : 24;
      g.fillStyle = o.kind === 'hammer' ? '#b8a890' : '#c9c2b2';
      for (let i = 0; i < steps; i++) {
        g.fillRect(x - 40 + i * sw, GROUND - (steps - i) * 9, sw, (steps - i) * 9);
        g.strokeRect(x - 40 + i * sw, GROUND - (steps - i) * 9, sw, (steps - i) * 9);
      }
      if (o.kind === 'hammer') {
        g.strokeStyle = '#ff3d5a';
        g.lineWidth = 5;
        g.beginPath();
        g.moveTo(x - 40, GROUND - steps * 9 - 30);
        g.lineTo(x - 40 + steps * sw, GROUND - 30);
        g.stroke();
        g.fillStyle = '#ff3d5a';
        g.font = '14px Bungee, Impact, sans-serif';
        g.textAlign = 'center';
        g.fillText('HAMMER', x + 60, GROUND - steps * 9 - 40);
      }
      break;
    }
    case 'gap':
      g.fillStyle = '#1a1a1a';
      g.fillRect(x - 60, GROUND, 120, 80);
      g.fillStyle = '#ffd23d';
      for (let i = 0; i < 6; i++) g.fillRect(x - 60 + i * 20, GROUND, 10, 6);
      break;
    case 'kicker':
      g.fillStyle = '#b07a48';
      g.beginPath();
      g.moveTo(x - 60, GROUND);
      g.lineTo(x + 30, GROUND - 34);
      g.lineTo(x + 30, GROUND);
      g.closePath();
      g.fill();
      g.stroke();
      break;
  }
}

function drawSkater(g: CanvasRenderingContext2D, x: number, y: number, slam: boolean, rot: number, flip: number, color: string, t: number) {
  g.save();
  g.translate(x, y);
  g.lineCap = 'round';
  g.strokeStyle = '#111';
  g.lineWidth = 4;
  if (slam) {
    g.rotate(Math.PI / 2.2);
    g.fillStyle = color;
    g.fillRect(-30, -12, 34, 18);
    g.beginPath();
    g.arc(14, -4, 9, 0, Math.PI * 2);
    g.fillStyle = '#e8c19a';
    g.fill();
    g.stroke();
    g.restore();
    // board flying
    g.save();
    g.translate(x + 50, y - 20 - Math.abs(Math.sin(t * 8)) * 20);
    g.rotate(t * 10);
    g.fillStyle = '#ff6b1a';
    g.fillRect(-26, -3, 52, 6);
    g.restore();
    return;
  }
  // board
  g.save();
  g.rotate(rot);
  const squash = Math.abs(Math.cos(flip));
  g.fillStyle = '#ff6b1a';
  g.fillRect(-28, -6 - 3 * squash, 56, Math.max(2, 6 * squash));
  g.strokeRect(-28, -6 - 3 * squash, 56, Math.max(2, 6 * squash));
  g.fillStyle = '#f3ead7';
  g.beginPath();
  g.arc(-18, 0, 5, 0, Math.PI * 2);
  g.arc(18, 0, 5, 0, Math.PI * 2);
  g.fill();
  g.restore();
  // body
  const crouch = rot !== 0 ? 10 : 0;
  g.beginPath();
  g.moveTo(-12, -8);
  g.lineTo(-4, -30 + crouch);
  g.lineTo(10, -8);
  g.moveTo(-4, -30 + crouch);
  g.lineTo(0, -58 + crouch);
  g.moveTo(0, -50 + crouch);
  g.lineTo(-20, -40 + crouch);
  g.moveTo(0, -50 + crouch);
  g.lineTo(20, -44 + crouch);
  g.stroke();
  g.fillStyle = color;
  g.fillRect(-9, -58 + crouch, 18, 22);
  g.strokeRect(-9, -58 + crouch, 18, 22);
  g.beginPath();
  g.arc(0, -68 + crouch, 10, 0, Math.PI * 2);
  g.fillStyle = '#e8c19a';
  g.fill();
  g.stroke();
  g.restore();
}
