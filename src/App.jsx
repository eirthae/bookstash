import { useState, useEffect, useCallback } from 'react';
import { Preferences } from '@capacitor/preferences';
import { BottomNav } from './components/chrome.jsx';
import { AddMenu } from './components/AddMenu.jsx';
import { LibraryScreen } from './screens/Library.jsx';
import { DiscoverScreen } from './screens/Discover.jsx';
import { BookDetailScreen } from './screens/BookDetail.jsx';
import { ReaderScreen } from './screens/Reader.jsx';
import { SettingsScreen } from './screens/Settings.jsx';
import { AboutScreen } from './screens/About.jsx';
import { getAllWorks } from './lib/db.js';

const READER_DEFAULTS = { theme: 'dark', font: 'serif', size: 18 };

// BookStash — local-first reader. On-device library (IndexedDB), bulk import,
// reader with resume position + themes/fonts, and About & Support. All on device.
export default function App() {
  const [mode, setMode] = useState('dark');
  const [tab, setTab] = useState('library');
  const [viewing, setViewing] = useState(null); // work whose detail is open
  const [reading, setReading] = useState(null); // work being read
  const [about, setAbout] = useState(false);    // About & Support screen
  const [works, setWorks] = useState(null);      // null = still loading
  const [reader, setReader] = useState(READER_DEFAULTS); // reader theme/font/size
  const [addOpen, setAddOpen] = useState(false); // the bottom-nav "+" Add menu
  const [notice, setNotice] = useState('');      // transient Library result toast

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

  const reload = useCallback(() => { getAllWorks().then((w) => setWorks(w || [])).catch(() => setWorks([])); }, []);
  useEffect(() => { reload(); }, [reload]);

  // After an Add (upload/link): reload the library, jump to it, flash a notice.
  const onAdded = (msg) => {
    reload();
    setTab('library');
    if (msg) { setNotice(msg); setTimeout(() => setNotice(''), 4500); }
  };

  const fullscreen = reading || viewing || about; // hide the bottom nav on these

  return (
    <div className="app-root" data-mode={mode}>
      <div className="viewport">
        {reading ? (
          <ReaderScreen work={reading} settings={reader} setSettings={updateReader} onBack={() => setReading(null)} />
        ) : about ? (
          <AboutScreen onBack={() => setAbout(false)} />
        ) : viewing ? (
          <BookDetailScreen work={viewing} onBack={() => setViewing(null)}
            onRead={(w) => setReading(w)}
            onRemoved={() => { setViewing(null); reload(); }} />
        ) : tab === 'library' ? (
          <LibraryScreen works={works} onOpen={setViewing} onAdd={() => setAddOpen(true)} notice={notice} />
        ) : tab === 'discover' ? (
          <DiscoverScreen />
        ) : (
          <SettingsScreen works={works} mode={mode} setMode={changeMode} onAbout={() => setAbout(true)} />
        )}
      </div>
      {!fullscreen && (
        <BottomNav active={tab}
          onTab={(id) => { setAddOpen(false); setTab(id); }}
          onAdd={() => setAddOpen((o) => !o)} addActive={addOpen} />
      )}
      {!fullscreen && <AddMenu open={addOpen} onClose={() => setAddOpen(false)} onChanged={onAdded} />}
    </div>
  );
}
