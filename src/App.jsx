import { useState, useEffect, useRef, useCallback } from 'react';
import { Preferences } from '@capacitor/preferences';
import { App as CapApp } from '@capacitor/app';
import { BottomNav } from './components/chrome.jsx';
import { AddMenu } from './components/AddMenu.jsx';
import { LibraryScreen, shelfOf } from './screens/Library.jsx';
import { WhatsNewScreen } from './screens/WhatsNew.jsx';
import { DiscoverScreen, TagResultsScreen, LaterScreen } from './screens/Discover.jsx';
import { StoryDetailScreen } from './screens/Detail.jsx';
import { SeriesScreen } from './screens/Series.jsx';
import { ReaderScreen } from './screens/Reader.jsx';
import { SettingsScreen, ConnectScreen } from './screens/Settings.jsx';
import { AboutScreen } from './screens/About.jsx';
import { LocalNotifications } from '@capacitor/local-notifications';
import { fetchWorks, mapWork } from './lib/library.js';
import { getWork } from './lib/db.js';
import { triggerSync } from './lib/sync.js';

const READER_DEFAULTS = { theme: 'dark', font: 'serif', size: 19, leading: 1.70, margin: 26, brightness: 1 };

// BookStash — local-first reader, sharing FicStash's UI/UX. On-device library
// (IndexedDB), the work fetched/parsed on the phone. A FicStash-style nav stack
// drives Library → Detail → Reader, with a bottom nav + centered "+".
export default function App() {
  const [appMode, setAppMode] = useState('dark'); // dark | light | system
  const [systemDark, setSystemDark] = useState(() => !!(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches));
  const [reader, setReader] = useState(READER_DEFAULTS);
  const [works, setWorks] = useState(null);      // null = still loading
  const [addOpen, setAddOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [autoSync, setAutoSync] = useState(false); // opt-in: refresh followed works when the app opens



  // Navigation: a tab + a stack of pushed screens (detail / reader / about).
  const [tab, setTab] = useState('library');
  const [stack, setStack] = useState([]);
  const stackRef = useRef([]); stackRef.current = stack;
  const [navDir, setNavDir] = useState('fwd'); // last nav direction → drives the screen transition (fwd: slide in from right, back: slide in from left)
  // The whole stack stays mounted (see render) so going back reveals the screen
  // beneath with its scroll + state intact. The popped screen lingers in `exiting`
  // for the animation so it slides OUT to the right instead of vanishing (the
  // instant disappear was the "jump" on swipe-back).
  const [exiting, setExiting] = useState(null);
  const exitTimer = useRef(null);
  const goBack = () => {
    const s = stackRef.current;
    if (!s.length) return false;
    setNavDir('back');
    setExiting({ item: s[s.length - 1], key: s.length });
    setStack(s.slice(0, -1));
    if (exitTimer.current) clearTimeout(exitTimer.current);
    exitTimer.current = setTimeout(() => setExiting(null), 300);
    return true;
  };
  const [gotoShelf, setGotoShelf] = useState(null); // { shelf, nonce } after a custom add
  const nav = useRef();
  nav.current = {
    push: (screen, props = {}) => { setNavDir('fwd'); setStack((s) => [...s, { screen, props }]); },
    pop: () => { goBack(); },
    reset: (t) => { setStack([]); setTab(t); },
  };

  useEffect(() => {
    let alive = true;
    Preferences.get({ key: 'bs-mode' }).then(({ value }) => { if (alive && value) setAppMode(value); }).catch(() => {});
    Preferences.get({ key: 'bs-reader' }).then(({ value }) => {
      if (alive && value) { try { setReader((r) => ({ ...r, ...JSON.parse(value) })); } catch (e) {} }
    }).catch(() => {});
    Preferences.get({ key: 'bs-autosync' }).then(({ value }) => { if (alive && value === '1') setAutoSync(true); }).catch(() => {});
    return () => { alive = false; };
  }, []);
  // Track the OS color scheme so the "System" mode follows the phone.
  useEffect(() => {
    if (!window.matchMedia) return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const fn = (e) => setSystemDark(e.matches);
    mq.addEventListener ? mq.addEventListener('change', fn) : mq.addListener(fn);
    return () => { mq.removeEventListener ? mq.removeEventListener('change', fn) : mq.removeListener(fn); };
  }, []);
  const changeMode = (m) => { setAppMode(m); Preferences.set({ key: 'bs-mode', value: m }).catch(() => {}); };
  const changeAutoSync = (v) => { setAutoSync(v); Preferences.set({ key: 'bs-autosync', value: v ? '1' : '0' }).catch(() => {}); };
  const updateReader = (next) => { setReader(next); Preferences.set({ key: 'bs-reader', value: JSON.stringify(next) }).catch(() => {}); };
  const resolvedMode = appMode === 'system' ? (systemDark ? 'dark' : 'light') : appMode;

  const reload = useCallback(() => { fetchWorks().then((w) => setWorks(w || [])).catch(() => setWorks([])); }, []);
  useEffect(() => { reload(); }, [reload]);

  // Auto-refresh on app open (throttled to every 6h), so followed fics + tracked
  // tags refresh on their own without tapping Sync. OPT-IN: off by default, so a
  // fresh install makes zero automatic network connections — the user enables it
  // in Settings. (Manual Sync / pull-to-refresh always works regardless.)
  useEffect(() => {
    if (!autoSync) return;
    const LAST = 'bs-last-sync', SIX_H = 6 * 3600 * 1000;
    let last = 0; try { last = Number(localStorage.getItem(LAST) || 0); } catch (e) { /* ignore */ }
    if (Date.now() - last < SIX_H) return;
    triggerSync().then((r) => {
      try { localStorage.setItem(LAST, String(Date.now())); } catch (e) { /* ignore */ }
      if (r && r.ok && (r.newChapters || r.newMatches || r.seriesAdded)) reload();
    }).catch(() => {});
  }, [reload, autoSync]);

  const removeFromLibrary = (id) => setWorks((ws) => (ws || []).filter((w) => w.id !== id));
  // After a custom add, jump to Library and open the added work's shelf (so a
  // freshly-added fic lands on Fics even if you were elsewhere).
  const onAdded = (msg, work) => {
    reload(); setRefreshKey((k) => k + 1); setStack([]); setTab('library');
    setGotoShelf((g) => ({ shelf: shelfOf(work), msg, nonce: (g ? g.nonce : 0) + 1 }));
  };

  const switchTab = (id) => { setStack([]); setAddOpen(false); setTab(id); };

  const top = stack[stack.length - 1];
  const showNav = !top;

  // Android hardware/predictive back (the edge swipe-to-go-back gesture fires
  // this). Walk the nav back the way the on-screen back arrow would: close the
  // Add sheet → pop a pushed screen → return to Library → otherwise background
  // the app. Registered once; reads live nav state from a ref.
  const navState = useRef({});
  navState.current = { stack, tab, addOpen };
  useEffect(() => {
    let handle;
    CapApp.addListener('backButton', () => {
      const s = navState.current;
      if (s.addOpen) { setAddOpen(false); return; }
      if (goBack()) return;
      if (s.tab !== 'library') { setTab('library'); return; }
      CapApp.minimizeApp();
    }).then((h) => { handle = h; }).catch(() => {});
    return () => { if (handle) handle.remove(); };
  }, []);

  // Tapping a "saved work ready to read" notification deep-links into its reader.
  useEffect(() => {
    let handle;
    LocalNotifications.addListener('localNotificationActionPerformed', async (action) => {
      const wid = action && action.notification && action.notification.extra && action.notification.extra.workId;
      if (!wid) return;
      try {
        const row = await getWork(wid);
        if (row) { setNavDir('fwd'); setStack((s) => [...s, { screen: 'reader', props: { work: mapWork(row) } }]); }
      } catch (e) { /* ignore — notification tap is best-effort */ }
    }).then((h) => { handle = h; }).catch(() => {});
    return () => { if (handle) handle.remove(); };
  }, []);

  const renderTab = () => {
    const n = nav.current;
    if (tab === 'library') return <LibraryScreen works={works} onRemove={removeFromLibrary} onReload={reload} refreshKey={refreshKey} gotoShelf={gotoShelf} nav={n} />;
    if (tab === 'whatsnew') return <WhatsNewScreen chapters={[]} matches={[]} nav={n} />;
    if (tab === 'discover') return <DiscoverScreen nav={n} />;
    return <SettingsScreen appMode={appMode} setAppMode={changeMode} autoSync={autoSync} setAutoSync={changeAutoSync} nav={n} />;
  };
  const renderScreen = (item) => {
    const n = nav.current, p = item.props || {};
    if (item.screen === 'detail') {
      return <StoryDetailScreen work={p.work} suggestion={p.suggestion} onSaved={p.onSaved} nav={n}
        onRemoved={(id) => (p.onRemoved || removeFromLibrary)(id)}
        onReload={reload} />;
    }
    if (item.screen === 'series') return <SeriesScreen seriesId={p.seriesId} seriesName={p.seriesName} onReload={reload} nav={n} />;
    if (item.screen === 'reader') return <ReaderScreen work={p.work} workId={p.workId} chapterN={p.chapterN} chapterTitle={p.chapterTitle} settings={reader} setSettings={updateReader} nav={n} />;
    if (item.screen === 'about') return <AboutScreen onBack={n.pop} />;
    if (item.screen === 'connect') return <ConnectScreen nav={n} />;
    if (item.screen === 'tagresults') return <TagResultsScreen tag={p.tag} onLeave={p.onLeave} onEdit={p.onEdit} onSaved={reload} nav={n} />;
    if (item.screen === 'later') return <LaterScreen onLeave={p.onLeave} onSaved={reload} nav={n} />;
    return null;
  };

  return (
    <div className="app-root" data-mode={resolvedMode}>
      <div className="viewport">
        {renderTab()}
        {/* The whole stack stays mounted (only the topmost animates in), so going
            back reveals the previous screen with its scroll + state intact instead
            of remounting. The just-popped screen slides out via the exiting layer. */}
        {stack.map((item, i) => {
          const isTop = i === stack.length - 1;
          return (
            <div key={i} className={`screen ${isTop ? (navDir === 'back' ? 'view-back' : 'view-enter') : ''}`} style={{ zIndex: 30 + i }}>
              {renderScreen(item)}
            </div>
          );
        })}
        {exiting && <div className="screen view-pop" key={`exit-${exiting.key}`} style={{ zIndex: 30 + stack.length + 1 }}>{renderScreen(exiting.item)}</div>}
      </div>
      {showNav && <BottomNav active={tab} onTab={switchTab} onAdd={() => setAddOpen((o) => !o)} addActive={addOpen} />}
      {showNav && <AddMenu open={addOpen} onClose={() => setAddOpen(false)} onChanged={onAdded} />}
    </div>
  );
}
