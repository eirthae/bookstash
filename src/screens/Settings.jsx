const APP_VERSION = '0.2.0';

export function SettingsScreen({ works, mode, setMode }) {
  const count = works ? works.length : 0;
  const totalWords = works ? works.reduce((s, w) => s + (w.words || 0), 0) : 0;

  return (
    <div className="screen">
      <div className="appbar"><div className="title">Settings</div></div>
      <div className="scroll" style={{ padding: '4px 20px 28px' }}>
        <Section label="Appearance">
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
        </Section>

        <Section label="Storage">
          <div className="set-card">
            <div className="set-row"><span>Books on device</span><b>{count}</b></div>
            <div className="set-row"><span>Total words</span><b>{totalWords ? totalWords.toLocaleString() : '0'}</b></div>
            <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 8, lineHeight: 1.5 }}>
              Everything is stored locally on this device. Backup/restore is coming.
            </div>
          </div>
        </Section>

        <div className="set-card" style={{ marginTop: 8 }}>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>BookStash</div>
          <div style={{ fontSize: 13, lineHeight: 1.55, color: 'var(--text-secondary)' }}>
            A private, local-first reader & library. No account, no servers, no tracking — your books live on this device.
          </div>
          <div style={{ marginTop: 12, fontSize: 12, color: 'var(--text-tertiary)' }}>Version {APP_VERSION} · open-source (GPLv3)</div>
        </div>
      </div>
    </div>
  );
}

function Section({ label, children }) {
  return (
    <div style={{ marginTop: 18 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '.06em', margin: '0 2px 10px' }}>{label}</div>
      {children}
    </div>
  );
}
