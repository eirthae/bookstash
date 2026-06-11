import { useState, useEffect, useRef, useCallback } from 'react';
import { Preferences } from '@capacitor/preferences';
import { BottomNav } from './components/chrome.jsx';
import { AddMenu } from './components/AddMenu.jsx';
import { LibraryScreen } from './screens/Library.jsx';
import { DiscoverScreen } from './screens/Discover.jsx';
import { BookDetailScreen } from './screens/BookDetail.jsx';
import { ReaderScreen } from './screens/Reader.jsx';
import { SettingsScreen } from './screens/Settings.jsx';
import { AboutScreen } from './screens/About.jsx';
import { fetchWorks } from './lib/library.js';

const READER_DEFAULTS = { theme: 'dark', font: 'serif', size: 18 };

// BookStash — local-first reader, sharing FicStash's UI/UX. On-device library
// (IndexedDB), the work fetched/parsed on the phone. A FicStash-style nav stack
// drives Library → Detail → Reader, with a bottom nav + centered "+".
export default function App() {
  const [mode, setMode] = useState('dark');
  const [reader, setReader] = useState(READER_DEFAULTS);
  const [works, setWorks] = useState(null);      // null = still loading
  const [addOpen, setAddOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  // Navigation: a tab + a stack of pushed screens (detail / reader / about).
  const [tab, setTab] = useState('library');
  const [stack, setStack] = useState([]);
  const nav = useRef();
  nav.current = {
    push: (screen, props = {}) => setStack((s) => [...s, { screen, props }]),
    pop: () => setStack((s) => s.slice(0, -1)),
    reset: (t) => { setStack([]); setTab(t); },
  };

  useEffect(() => {
    let alive = true;
    Preferences.get({ key: 'bs-mode' }).then(({ value }) => { if (alive && value) setMode(value); }).catch(() => {});
    Preferences.get({ key: 'bs-reader' }).then(({ value }) => {
      if (alive && value) { try { setReader((r) => ({ ...r, ...JSON.parse(value) })); } catch (e) {} }
    }).catch(() => {});
    return () => { alive = false; };
  }, []);
  const changeMode = (m) => { setMode(m); Preferences.set({ key: 'bs-mode', value: m }).catch(() => {}); };
  const updateReader = (next) => { setReader(next); Preferences.set({ key: 'bs-reader', value: JSON.stringify(next) }).catch(() => {}); };

  const reload = useCallback(() => { fetchWorks().then((w) => setWorks(w || [])).catch(() => setWorks([])); }, []);
  useEffect(() => { reload(); }, [reload]);

  const removeFromLibrary = (id) => setWorks((ws) => (ws || []).filter((w) => w.id !== id));
  const onAdded = () => { reload(); setRefreshKey((k) => k + 1); setStack([]); setTab('library'); };

  const switchTab = (id) => { setStack([]); setAddOpen(false); setTab(id); };

  const top = stack[stack.length - 1];
  const showNav = !top;

  const renderTab = () => {
    const n = nav.current;
    if (tab === 'library') return <LibraryScreen works={works} onRemove={removeFromLibrary} onReload={reload} refreshKey={refreshKey} nav={n} />;
    if (tab === 'discover') return <DiscoverScreen />;
    return <SettingsScreen works={works} mode={mode} setMode={changeMode} onAbout={() => n.push('about')} />;
  };
  const renderTop = () => {
    const n = nav.current, p = top.props || {};
    if (top.screen === 'detail') {
      return <BookDetailScreen work={p.work} onBack={n.pop}
        onRead={(w) => n.push('reader', { work: w })}
        onRemoved={(id) => { (p.onRemoved || removeFromLibrary)(id); n.pop(); }} />;
    }
    if (top.screen === 'reader') return <ReaderScreen work={p.work} settings={reader} setSettings={updateReader} onBack={n.pop} />;
    if (top.screen === 'about') return <AboutScreen onBack={n.pop} />;
    return null;
  };

  return (
    <div className="app-root" data-mode={mode}>
      <div className="viewport">
        {renderTab()}
        {top && <div className="screen" style={{ zIndex: 30 }}>{renderTop()}</div>}
      </div>
      {showNav && <BottomNav active={tab} onTab={switchTab} onAdd={() => setAddOpen((o) => !o)} addActive={addOpen} />}
      {showNav && <AddMenu open={addOpen} onClose={() => setAddOpen(false)} onChanged={onAdded} />}
    </div>
  );
}
