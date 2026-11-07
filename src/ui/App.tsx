import { useEffect, useState, type ReactNode } from 'react';
import { useGame, Toasts, Modal, Money, Tip } from './kit';
import { GAME_TITLE } from '../game/config';
import { LOCATIONS, locationLock, type LocationId } from '../game/unlocks';
import { GOALS } from '../game/content/achievements';
import { fmtMoney, fmtNum, fmtTime, fmtRate } from '../game/format';
import { legacyPreview } from '../game/prestige';
import { getSettings, onSettings, updateSettings } from '../platform/settings';
import { District } from './District';
import { Shop } from './Shop';
import { Team } from './Team';
import { Spot } from './Spot';
import { Venue } from './Venue';
import { Workshop } from './Workshop';
import { Park, Warehouse, Factory, HQ } from './Late';
import { LegacyView } from './Legacy';
import { SettingsModal } from './Settings';
import { DebugPanel } from './Debug';

const ICONS: Record<LocationId, string> = {
  district: '🗺',
  shop: '🛹',
  team: '🧢',
  spot: '🎥',
  venue: '🏟',
  workshop: '🔧',
  park: '🌀',
  warehouse: '📦',
  factory: '🏭',
  hq: '🏙',
  legacy: '🏆',
};

export function App() {
  const [s, d, e] = useGame();
  const [loc, setLoc] = useState<LocationId>('shop');
  const [showSettings, setShowSettings] = useState(false);
  const [, force] = useState(0);
  useEffect(() => {
    const off = onSettings(() => force((x) => x + 1));
    return () => void off();
  }, []);
  const settings = getSettings();

  useEffect(() => {
    document.title = `${fmtMoney(s.run.cash)} · ${GAME_TITLE}`;
  });

  const go = (id: LocationId) => {
    setLoc(id);
    window.scrollTo({ top: 0 });
  };

  if (e.tabStatus === 'blocked') {
    return (
      <div className="blocked">
        <div className="card" style={{ maxWidth: 460 }}>
          <h2>{GAME_TITLE} is open in another tab</h2>
          <p className="muted">Only one tab can run the shop at a time, so progress never doubles up or overwrites itself. This tab is paused.</p>
          <button className="btn primary" onClick={() => e.takeOver()}>
            Play in this tab instead
          </button>
        </div>
      </div>
    );
  }

  const firstRunEnd = GOALS.findIndex((g) => g.id === 'legacy');
  const goal = GOALS.find((g, i) => (!g.when || g.when(s)) && !(s.meta.legacyCount > 0 && i < firstRunEnd) && !g.done(s));
  const pv = legacyPreview(s);

  let view: ReactNode;
  const lock = locationLock(s, loc);
  if (lock) view = <LockedView id={loc} lock={lock} />;
  else
    switch (loc) {
      case 'district':
        view = <District go={go} />;
        break;
      case 'shop':
        view = <Shop />;
        break;
      case 'team':
        view = <Team />;
        break;
      case 'spot':
        view = <Spot />;
        break;
      case 'venue':
        view = <Venue />;
        break;
      case 'workshop':
        view = <Workshop />;
        break;
      case 'park':
        view = <Park />;
        break;
      case 'warehouse':
        view = <Warehouse />;
        break;
      case 'factory':
        view = <Factory />;
        break;
      case 'hq':
        view = <HQ />;
        break;
      case 'legacy':
        view = <LegacyView />;
        break;
    }

  return (
    <div className="app">
      <header className="topbar">
        <div className="logo" aria-label={GAME_TITLE}>
          <span className="logo-full">{GAME_TITLE.toUpperCase()}</span>
          <span className="logo-short" aria-hidden>
            {GAME_TITLE.split(' ').map((w) => w[0]).join('')}
          </span>
        </div>
        <div className="money" aria-live="off">
          <span className="cash">{fmtMoney(s.run.cash)}</span>
          <span className="rate">
            {fmtRate(d.passive)}
            <span className="hide-sm"> automated · {fmtMoney(d.saleValue)} per sale</span>
          </span>
        </div>
        <Tip text="Fans boost shop traffic (product income) and event demand. Earn them with videos, demos, tours and events.">
          <span className="pill hide-sm" tabIndex={0}>
            📣 <b>{fmtNum(s.run.fans)}</b> fans
          </span>
        </Tip>
        {(s.meta.legacyCount > 0 || pv.available) && (
          <Tip text={`Cred is the Legacy currency. Unspent: ${s.meta.cred}. Lifetime earned: ${s.meta.credEarned}.`}>
            <button className="pill" onClick={() => go('legacy')}>
              ⭐ <b>{fmtNum(s.meta.cred)}</b> Cred{pv.available ? <span className="chip y hide-sm">+{pv.gain} ready</span> : null}
            </button>
          </Tip>
        )}
        {s.meta.tainted && <span className="sticker" style={{ background: 'var(--red)' }}>DEBUG SAVE</span>}
        <span className="spacer" />
        <button className="iconbtn" aria-label={settings.muted ? 'Unmute' : 'Mute'} title={settings.muted ? 'Unmute (M)' : 'Mute (M)'} onClick={() => updateSettings({ muted: !settings.muted })}>
          {settings.muted ? '🔇' : '🔊'}
        </button>
        <button className="iconbtn" aria-label="Settings and saves" title="Settings & saves" onClick={() => setShowSettings(true)}>
          ⚙
        </button>
      </header>
      <nav className="nav" aria-label="Locations">
        {LOCATIONS.filter((l) => l.id === 'district' || l.id === 'shop' || l.id === 'legacy' || !locationLock(s, l.id) || shouldTease(s.meta.legacyCount, l.id)).map((l) => {
          const lk = locationLock(s, l.id);
          return (
            <button key={l.id} aria-current={loc === l.id ? 'page' : undefined} className={lk ? 'locked' : ''} onClick={() => go(l.id)} title={lk ?? l.blurb}>
              <span aria-hidden>{lk ? '🔒' : ICONS[l.id]}</span> {l.short}
              {l.id === 'legacy' && pv.available && <span className="dot" aria-label="Legacy available" />}
            </button>
          );
        })}
      </nav>
      {goal && (
        <div className="goalbar">
          <span className="tag">NEXT GOAL</span>
          <b>{goal.text}</b>
          <span className="hint">{goal.hint}</span>
          {goal.location !== loc && !locationLock(s, goal.location as LocationId) && (
            <button className="btn small" onClick={() => go(goal.location as LocationId)}>
              Go →
            </button>
          )}
        </div>
      )}
      {e.loadNote && (
        <div className="goalbar" style={{ background: 'var(--yellow)' }}>
          <b>{e.loadNote}</b>
          <button className="btn small" onClick={() => ((e.loadNote = null), e.notify())}>
            OK
          </button>
        </div>
      )}
      <main className="main" id="main">
        {view}
      </main>
      <Toasts />
      {e.offline && <OfflineModal onClose={() => ((e.offline = null), e.notify())} />}
      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
      {import.meta.env.DEV && <DebugPanel />}
    </div>
  );
}

function shouldTease(legacy: number, id: LocationId) {
  // Show the next locked location in the nav so players know what's coming.
  const next: Record<number, LocationId[]> = { 0: ['team', 'spot', 'venue', 'workshop'], 1: ['park'], 2: ['warehouse'], 3: ['factory'], 4: ['hq'] };
  return (next[legacy] ?? []).includes(id);
}

function LockedView({ id, lock }: { id: LocationId; lock: string }) {
  const info = LOCATIONS.find((l) => l.id === id)!;
  return (
    <div className="card paper" style={{ maxWidth: 560, margin: '30px auto', textAlign: 'center' }}>
      <div className="tape" />
      <h2 style={{ fontSize: 26 }}>🔒 {info.name}</h2>
      <p style={{ fontFamily: 'var(--marker)', fontSize: 20 }}>{lock}</p>
      <p className="muted">{info.blurb}</p>
    </div>
  );
}

function OfflineModal({ onClose }: { onClose: () => void }) {
  const [, , e] = useGame();
  const o = e.offline!;
  return (
    <Modal title="While you were away…" onClose={onClose} paper>
      <p>
        You were gone for <b>{fmtTime(o.elapsed)}</b>. The shop ran at <b>{Math.round(o.efficiency * 100)}%</b> efficiency
        {o.capped ? (
          <>
            {' '}
            for the first <b>{fmtTime(o.simulated)}</b> (offline cap reached)
          </>
        ) : null}
        .
      </p>
      <div className="card" style={{ margin: '10px 0' }}>
        <div className="row between">
          <span>Earned</span>
          <b className="warn">
            <Money v={o.earned} />
          </b>
        </div>
        {o.fans > 0 && (
          <div className="row between">
            <span>Fans gained</span>
            <b>{fmtNum(o.fans)}</b>
          </div>
        )}
        {o.jobs > 0 && (
          <div className="row between">
            <span>Assignments completed</span>
            <b>{o.jobs}</b>
          </div>
        )}
        {o.events > 0 && (
          <div className="row between">
            <span>Events hosted</span>
            <b>{o.events}</b>
          </div>
        )}
        {o.filmProgress > 0 && (
          <div className="row between">
            <span>Footage filmed</span>
            <b>{fmtNum(o.filmProgress)}</b>
          </div>
        )}
      </div>
      <p className="small muted">
        Offline, automated income, assignments, filming and events all run at the offline efficiency (online store sales at double, memberships at full). Active bonuses — serving,
        streaks, rushes and crowd moments — only happen while you play. Improve efficiency and the cap in the Legacy tree.
      </p>
      <button className="btn primary" onClick={onClose}>
        Back to the shop
      </button>
    </Modal>
  );
}
