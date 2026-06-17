import { useState, useEffect } from 'react';
import { Appbar } from '../components/chrome.jsx';
import Icon from '../components/Icon.jsx';
import { Segmented } from '../components/ui.jsx';
import { fetchOfflineStats } from '../lib/library.js';
import owlUrl from '../assets/owl.svg';

// Stamped at build time from the release tag (VITE_APP_VERSION, e.g. "v0.8.10");
// "dev" for local builds. Lets you confirm exactly which APK is installed.
const APP_VERSION = (import.meta.env && import.meta.env.VITE_APP_VERSION) || 'dev';

export function SettingsScreen({ appMode, setAppMode, autoSync, setAutoSync, nav }) {
  const [storage, setStorage] = useState(undefined); // undefined=loading, null=unavailable
  useEffect(() => { fetchOfflineStats().then(setStorage).catch(() => setStorage(null)); }, []);
  const storageLine = storage === undefined ? 'Counting…'
    : !storage || storage.total === 0 ? 'No works yet'
    : `${storage.total} work${storage.total === 1 ? '' : 's'} · all on this device`;

  return (
    <div className="screen">
      <Appbar large title="Settings" />
      <div className="scroll" style={{ padding: '0 20px 28px', display: 'flex', flexDirection: 'column', gap: 22 }}>

        <SetSection label="Sources">
          <button className="set-row pressable" style={{ width: '100%', textAlign: 'left' }} onClick={() => nav.push('connect')}>
            <div className="set-ic" style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}><Icon icon="solar:widget-5-bold" size={18} /></div>
            <div className="set-tx"><div className="set-h">How BookStash works</div><div className="set-d">Where stories come from</div></div>
            <Icon icon="solar:alt-arrow-right-linear" size={18} color="var(--text-tertiary)" />
          </button>
        </SetSection>

        <SetSection label="Appearance" note="Controls the whole app. Reader themes are separate — set them in the reader.">
          <div className="set-row" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div className="set-ic"><Icon icon="solar:pallete-2-bold" size={18} /></div>
              <div className="set-tx"><div className="set-h">App color mode</div><div className="set-d">Dark, Light, or follow your phone</div></div>
            </div>
            <Segmented value={appMode} onChange={setAppMode} options={[
              { value: 'light', label: 'Light', icon: 'solar:sun-2-linear' },
              { value: 'dark', label: 'Dark', icon: 'solar:moon-linear' },
              { value: 'system', label: 'System', icon: 'solar:smartphone-linear' },
            ]} />
          </div>
        </SetSection>

        <SetSection label="Updates" note="When on, opening the app checks the sites you follow for new chapters (at most every 6h). Off by default — the app makes no connection unless you tap Sync, search, or add a work.">
          <div className="set-row" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div className="set-ic"><Icon icon="solar:refresh-circle-linear" size={18} /></div>
              <div className="set-tx"><div className="set-h">Auto-refresh on open</div><div className="set-d">Check followed works when the app opens</div></div>
            </div>
            <Segmented value={autoSync ? 'on' : 'off'} onChange={(v) => setAutoSync(v === 'on')} options={[
              { value: 'off', label: 'Off', icon: 'solar:bell-off-linear' },
              { value: 'on', label: 'On', icon: 'solar:bell-bing-bold' },
            ]} />
          </div>
        </SetSection>

        <SetSection label="Storage">
          <div className="set-row">
            <div className="set-ic"><Icon icon="solar:database-linear" size={18} /></div>
            <div className="set-tx"><div className="set-h">Offline library</div><div className="set-d">{storageLine}</div></div>
            <Icon icon="solar:smartphone-linear" size={20} color="var(--text-tertiary)" />
          </div>
        </SetSection>

        <SetSection label="About & Support">
          <button className="set-row pressable" style={{ width: '100%', textAlign: 'left' }} onClick={() => nav.push('about')}>
            <div className="set-ic" style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}><Icon icon="solar:heart-bold" size={18} /></div>
            <div className="set-tx"><div className="set-h">About this project</div><div className="set-d">Free &amp; open source · leave a tip</div></div>
            <Icon icon="solar:alt-arrow-right-linear" size={18} color="var(--text-tertiary)" />
          </button>
        </SetSection>

        <div style={{ textAlign: 'center', fontSize: 11.5, color: 'var(--text-tertiary)', paddingTop: 4 }}>BookStash · on-device · {APP_VERSION}</div>
      </div>
    </div>
  );
}

function SetSection({ label, note, children }) {
  return (
    <div>
      <div className="section-label" style={{ marginBottom: 10, padding: '0 2px' }}>{label}</div>
      <div className="set-group">{children}</div>
      {note && <div style={{ fontSize: 11.5, color: 'var(--text-tertiary)', padding: '8px 4px 0', lineHeight: 1.45 }}>{note}</div>}
    </div>
  );
}

// ---- How BookStash works --------------------------------------------------
// BookStash is a curated multi-source reader that runs entirely ON YOUR PHONE —
// no account, no server. This explains where stories come from and how to add them.
const WAYS = [
  { icon: 'solar:magnifer-bold', title: 'Track tags & genres', body: 'Follow tags on AO3, or genres on Royal Road and Scribble Hub. New matching works surface in What’s New — fetched on your device.' },
  { icon: 'solar:link-round-bold', title: 'Add by link', body: 'Paste a work’s URL and BookStash fetches a private, fully-offline copy — on your phone.' },
  { icon: 'solar:upload-minimalistic-bold', title: 'Upload a file', body: 'Bring your own EPUB, HTML, or TXT. It’s parsed on-device and stored offline.' },
  { icon: 'solar:book-bookmark-bold', title: 'Discover books', body: 'Find books by the reader tags people use on Goodreads. BookStash can’t download published books — get the EPUB and upload it to read here.' },
];

export function ConnectScreen({ nav }) {
  return (
    <div className="screen view-enter">
      <Appbar back={() => nav.pop()} title="How BookStash works" />
      <div className="scroll" style={{ padding: '8px 24px 28px' }}>
        <img src={owlUrl} alt="" style={{ height: 92, display: 'block', margin: '14px auto 18px' }} />
        <div style={{ textAlign: 'center', fontSize: 21, fontWeight: 800, letterSpacing: '-.02em', marginBottom: 8 }}>Your offline shelf, on your phone</div>
        <div style={{ textAlign: 'center', fontSize: 14, lineHeight: 1.55, color: 'var(--text-secondary)', maxWidth: 300, margin: '0 auto 24px' }}>
          BookStash gathers stories from several sites into one offline library — all fetched and stored on your own device. No account, no server, nothing leaves your phone. You choose what comes in.
        </div>

        <div className="set-group" style={{ display: 'flex', flexDirection: 'column' }}>
          {WAYS.map(w => (
            <div key={w.title} className="set-row" style={{ alignItems: 'flex-start', gap: 13 }}>
              <div className="set-ic" style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}><Icon icon={w.icon} size={18} /></div>
              <div className="set-tx"><div className="set-h">{w.title}</div><div className="set-d" style={{ whiteSpace: 'normal', lineHeight: 1.45 }}>{w.body}</div></div>
            </div>
          ))}
        </div>

        <button className="btn btn-lg btn-primary btn-block" style={{ marginTop: 18 }} onClick={() => nav.reset('discover')}>
          <Icon icon="solar:compass-bold" size={20} /> Discover stories</button>
        <div style={{ display: 'flex', gap: 11, padding: 14, borderRadius: 'var(--radius-md)', background: 'var(--info-soft)', marginTop: 14 }}>
          <Icon icon="solar:square-top-down-linear" size={20} color="var(--info)" style={{ flexShrink: 0, marginTop: 1 }} />
          <div style={{ fontSize: 12.5, lineHeight: 1.5, color: 'var(--text-secondary)' }}>
            Want to bookmark or comment? Use <b style={{ color: 'var(--text-primary)' }}>Open at source</b> from any story. BookStash only reads — it never acts on your behalf.
          </div>
        </div>
      </div>
    </div>
  );
}
