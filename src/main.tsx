import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/bungee/400.css';
import '@fontsource/permanent-marker/400.css';
import './styles.css';
import { App } from './ui/App';
import { EngineCtx } from './ui/kit';
import { Engine } from './platform/engine';
import { getSettings, loadSettings, updateSettings } from './platform/settings';

loadSettings();
const engine = new Engine();
engine.start();

// Global shortcut: M toggles mute (ignored while typing).
window.addEventListener('keydown', (e) => {
  const t = e.target as HTMLElement | null;
  if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT')) return;
  if (e.code === 'KeyM' && !e.ctrlKey && !e.metaKey && !e.altKey) updateSettings({ muted: !getSettings().muted });
});

// Expose for automated browser checks (read-only usage in tests).
(window as unknown as { __grip: Engine }).__grip = engine;

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <EngineCtx.Provider value={engine}>
      <App />
    </EngineCtx.Provider>
  </StrictMode>,
);
