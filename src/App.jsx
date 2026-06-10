import { useState, useEffect, useCallback } from 'react';
import { Preferences } from '@capacitor/preferences';
import Icon from './components/Icon.jsx';
import { LibraryScreen } from './screens/Library.jsx';
import { BookDetailScreen } from './screens/BookDetail.jsx';
import { ReaderScreen } from './screens/Reader.jsx';
import { SettingsScreen } from './screens/Settings.jsx';
import { getAllWorks } from './lib/db.js';

// BookStash — local-first reader. Phase 1: on-device library (IndexedDB), bulk
// file import, and a basic reader. Everything lives on the device.
export default function App() {
  const [mode, setMode] = useState('dark');
  const [tab, setTab] = useState('library');
  const [viewing, setViewing] = useState(null); // work whose detail is open, or null
  const [reading, setReading] = useState(null); // work currently being read, or null
  const [works, setWorks] = useState(null);       // null = still loading

  useEffect(() => {
    let alive = true;
    Preferences.get({ key: 'bs-mode' }).then(({ value }) => { if (alive && value) setMode(value); }).catch(() => {});
    return () => { alive = false; };
  }, []);
  const changeMode = (m) => { setMode(m); Preferences.set({ key: 'bs-mode', value: m }).catch(() => {}); };

  const reload = useCallback(() => { getAllWorks().then((w) => setWorks(w || [])).catch(() => setWorks([])); }, []);
  useEffect(() => { reload(); }, [reload]);

  return (
    <div className="app-root" data-mode={mode}>
      <div className="viewport">
        {reading ? (
          <ReaderScreen work={reading} onBack={() => setReading(null)} />
        ) : viewing ? (
          <BookDetailScreen work={viewing} onBack={() => setViewing(null)}
            onRead={(w) => setReading(w)}
            onRemoved={() => { setViewing(null); reload(); }} />
        ) : tab === 'library' ? (
          <LibraryScreen works={works} onReload={reload} onOpen={setViewing} />
        ) : (
          <SettingsScreen works={works} mode={mode} setMode={changeMode} />
        )}
      </div>
      {!reading && !viewing && (
        <nav className="bottomnav">
          <button className={tab === 'library' ? 'on' : ''} onClick={() => setTab('library')}>
            <Icon icon="solar:books-minimalistic-bold" size={22} /> Library
          </button>
          <button className={tab === 'settings' ? 'on' : ''} onClick={() => setTab('settings')}>
            <Icon icon="solar:settings-bold" size={22} /> Settings
          </button>
        </nav>
      )}
    </div>
  );
}
