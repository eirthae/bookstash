import { useState, useEffect } from 'react';
import { Preferences } from '@capacitor/preferences';
import Icon from './components/Icon.jsx';

const APP_VERSION = '0.1.0';

// BookStash — local-first reader & library. Phase 0 is the shell + foundation:
// app color mode, bottom-nav navigation, and stub Library / Settings screens.
// On-device storage, the reader, bulk upload, discovery filters, and links land
// in later phases (see ROADMAP.md).
export default function App() {
  const [mode, setMode] = useState('dark');
  const [tab, setTab] = useState('library');

  // App color mode, persisted in the native store (survives Android cold starts).
  useEffect(() => {
    let alive = true;
    Preferences.get({ key: 'bs-mode' }).then(({ value }) => { if (alive && value) setMode(value); }).catch(() => {});
    return () => { alive = false; };
  }, []);
  const changeMode = (m) => { setMode(m); Preferences.set({ key: 'bs-mode', value: m }).catch(() => {}); };

  return (
    <div className="app-root" data-mode={mode}>
      <div className="viewport">
        {tab === 'library' ? <LibraryScreen /> : <SettingsScreen mode={mode} setMode={changeMode} />}
      </div>
      <nav className="bottomnav">
        <button className={tab === 'library' ? 'on' : ''} onClick={() => setTab('library')}>
          <Icon icon="solar:books-minimalistic-bold" size={22} /> Library
        </button>
        <button className={tab === 'settings' ? 'on' : ''} onClick={() => setTab('settings')}>
          <Icon icon="solar:settings-bold" size={22} /> Settings
        </button>
      </nav>
    </div>
  );
}

function LibraryScreen() {
  return (
    <div className="screen">
      <div className="appbar">
        <div className="title">Library</div>
        <div className="sub">Your shelf — stored on this device</div>
      </div>
      <div className="scroll">
        <div className="empty">
          <div className="e-ic"><Icon icon="solar:book-2-bold" size={30} /></div>
          <div className="e-t">No books yet</div>
          <div className="e-d">Bulk-upload your EPUBs or add a link — coming in the next build. Everything stays on your device.</div>
          <span className="badge">Early build · v{APP_VERSION}</span>
        </div>
      </div>
    </div>
  );
}

function SettingsScreen({ mode, setMode }) {
  return (
    <div className="screen">
      <div className="appbar"><div className="title">Settings</div></div>
      <div className="scroll" style={{ padding: '4px 20px 28px' }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '.06em', margin: '10px 2px 10px' }}>Appearance</div>
        <div style={{ display: 'flex', gap: 8 }}>
          {['dark', 'light'].map((m) => (
            <button key={m} onClick={() => setMode(m)}
              style={{ flex: 1, padding: '12px 0', borderRadius: 'var(--radius-md)', fontWeight: 600, fontSize: 14,
                border: '1px solid var(--border)', textTransform: 'capitalize',
                background: mode === m ? 'var(--accent-soft)' : 'var(--surface-elevated)',
                color: mode === m ? 'var(--accent)' : 'var(--text-secondary)' }}>
              {m}
            </button>
          ))}
        </div>

        <div style={{ marginTop: 26, padding: 16, borderRadius: 'var(--radius-lg)', background: 'var(--surface-elevated)', border: '1px solid var(--border)' }}>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>BookStash</div>
          <div style={{ fontSize: 13, lineHeight: 1.55, color: 'var(--text-secondary)' }}>
            A private, local-first reader & library. Your books live on this device — no account, no servers, no tracking.
            This is an early build; features arrive step by step.
          </div>
          <div style={{ marginTop: 12, fontSize: 12, color: 'var(--text-tertiary)' }}>Version {APP_VERSION} · open-source (GPLv3)</div>
        </div>
      </div>
    </div>
  );
}
