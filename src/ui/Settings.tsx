import { useRef, useState } from 'react';
import { useGame, Modal } from './kit';
import { getSettings, updateSettings, type Settings } from '../platform/settings';
import { exportSave, importSave } from '../game/save';
import type { GameState } from '../game/state';
import { fmtMoney, fmtTime } from '../game/format';
import { GAME_TITLE } from '../game/config';

export function SettingsModal({ onClose }: { onClose: () => void }) {
  const [s, , e] = useGame();
  const [st, setSt] = useState<Settings>(getSettings());
  const [exported, setExported] = useState('');
  const [importText, setImportText] = useState('');
  const [importErr, setImportErr] = useState('');
  const [pending, setPending] = useState<GameState | null>(null);
  const [resetText, setResetText] = useState('');
  const [msg, setMsg] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const set = (p: Partial<Settings>) => {
    updateSettings(p);
    setSt(getSettings());
  };

  const tryImport = (text: string) => {
    setImportErr('');
    try {
      setPending(importSave(text));
    } catch (err) {
      setPending(null);
      setImportErr((err as Error).message);
    }
  };

  return (
    <Modal title="Settings & saves" onClose={onClose} wide>
      <div className="grid halves">
        <div className="stack">
          <div className="card">
            <h3>Sound</h3>
            <label className="row small">
              <input type="checkbox" checked={st.muted} onChange={(ev) => set({ muted: ev.target.checked })} /> Mute all sound (M)
            </label>
            <label className="small">
              Volume {Math.round(st.volume * 100)}%
              <input type="range" min={0} max={1} step={0.05} value={st.volume} onChange={(ev) => set({ volume: Number(ev.target.value) })} />
            </label>
          </div>
          <div className="card">
            <h3>Display & accessibility</h3>
            <label className="row small">
              Motion
              <select value={st.motion} onChange={(ev) => set({ motion: ev.target.value as Settings['motion'] })}>
                <option value="system">Follow system setting</option>
                <option value="reduced">Reduced motion</option>
                <option value="full">Full motion</option>
              </select>
            </label>
            <label className="row small">
              Numbers
              <select value={st.notation} onChange={(ev) => set({ notation: ev.target.value as Settings['notation'] })}>
                <option value="suffix">1.23M, 4.56B, 7.89T…</option>
                <option value="scientific">Scientific (1.23e6)</option>
              </select>
            </label>
            <label className="row small">
              <input type="checkbox" checked={st.saleFloaters} onChange={(ev) => set({ saleFloaters: ev.target.checked })} /> Floating “+$” numbers on sales
            </label>
            <button className="btn small" onClick={() => e.act((x) => void (x.meta.seenTips = []))}>
              Show tutorial tips again
            </button>
          </div>
          <div className="card">
            <h3>Controls</h3>
            <div className="small">
              <span className="kbd">Space</span> / <span className="kbd">S</span> hold to serve · <span className="kbd">Enter</span> on the Serve button · <span className="kbd">Tab</span> to move
              between buttons · <span className="kbd">M</span> mute · <span className="kbd">Esc</span> closes dialogs. Film a Line: <span className="kbd">Z X C</span> or arrows to pop,{' '}
              <span className="kbd">Space</span> to land, <span className="kbd">B</span>/<span className="kbd">H</span> bank or hammer.
            </div>
          </div>
        </div>
        <div className="stack">
          <div className="card">
            <h3>Saving</h3>
            <p className="small" style={{ marginTop: 0 }}>
              {GAME_TITLE} saves automatically to <b>this browser</b> every few seconds and after important actions. Saves don't follow you to other browsers or devices — use Export to back up or move your
              game. {e.lastSavedAt ? `Last saved ${fmtTime((Date.now() - e.lastSavedAt) / 1000)} ago.` : ''}
            </p>
            <div className="row">
              <button
                className="btn small"
                onClick={() => {
                  e.save();
                  setMsg('Saved.');
                }}
              >
                Save now
              </button>
              <button className="btn small" onClick={() => setExported(exportSave(s))}>
                Export save
              </button>
              {exported && (
                <>
                  <button
                    className="btn small"
                    onClick={() => {
                      void navigator.clipboard?.writeText(exported).then(
                        () => setMsg('Copied to clipboard.'),
                        () => setMsg('Copy failed — select the text and copy manually.'),
                      );
                    }}
                  >
                    Copy
                  </button>
                  <button
                    className="btn small"
                    onClick={() => {
                      const blob = new Blob([exported], { type: 'text/plain' });
                      const a = document.createElement('a');
                      a.href = URL.createObjectURL(blob);
                      a.download = `grip-empire-save-${new Date().toISOString().slice(0, 10)}.txt`;
                      a.click();
                      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
                    }}
                  >
                    Download
                  </button>
                </>
              )}
            </div>
            {exported && <textarea className="save" readOnly value={exported} aria-label="Exported save" onFocus={(ev) => ev.target.select()} style={{ marginTop: 8 }} />}
            {msg && <p className="small good">{msg}</p>}
          </div>
          <div className="card">
            <h3>Import save</h3>
            <textarea className="save" placeholder="Paste a save code here" value={importText} onChange={(ev) => setImportText(ev.target.value)} aria-label="Save to import" />
            <div className="row" style={{ marginTop: 6 }}>
              <button className="btn small" onClick={() => tryImport(importText)}>
                Check save
              </button>
              <button className="btn small" onClick={() => fileRef.current?.click()}>
                Load file…
              </button>
              <input
                ref={fileRef}
                type="file"
                accept=".txt,.json,text/plain,application/json"
                hidden
                onChange={async (ev) => {
                  const f = ev.target.files?.[0];
                  if (!f) return;
                  const txt = await f.text();
                  setImportText(txt);
                  tryImport(txt);
                  ev.target.value = '';
                }}
              />
            </div>
            {importErr && <p className="small bad">✖ {importErr} Your current game was not changed.</p>}
            {pending && (
              <div className="card paper" style={{ marginTop: 8 }}>
                <b>Valid save found.</b>
                <div className="small">
                  Legacy {pending.meta.legacyCount} · {fmtMoney(pending.run.cash)} cash · {pending.meta.credEarned} lifetime Cred · {fmtTime(pending.meta.stats.playTime)} played
                </div>
                <p className="small">This will replace your current game (your current save becomes the backup).</p>
                <div className="row">
                  <button
                    className="btn danger small"
                    onClick={() => {
                      e.replaceState(pending);
                      setPending(null);
                      setImportText('');
                      setMsg('Save imported.');
                    }}
                  >
                    Replace my game
                  </button>
                  <button className="btn small" onClick={() => setPending(null)}>
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
          <div className="card">
            <h3 className="bad">Full reset</h3>
            <p className="small" style={{ marginTop: 0 }}>
              Deletes everything — Cred, upgrades, achievements, HQ — and starts over. Settings are kept. Export first if you might want it back. Type <b>RESET</b> to confirm.
            </p>
            <div className="row">
              <input value={resetText} onChange={(ev) => setResetText(ev.target.value)} aria-label="Type RESET to confirm" style={{ background: '#111', color: 'var(--ink)', border: '2px solid #000', borderRadius: 6, padding: 6 }} />
              <button
                className="btn danger small"
                disabled={resetText !== 'RESET'}
                onClick={() => {
                  e.hardReset();
                  setResetText('');
                  onClose();
                }}
              >
                Erase everything
              </button>
            </div>
          </div>
        </div>
      </div>
      <div className="row" style={{ marginTop: 12 }}>
        <button className="btn primary" onClick={onClose}>
          Close
        </button>
      </div>
    </Modal>
  );
}
