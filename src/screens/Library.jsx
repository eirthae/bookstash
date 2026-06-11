import { useState, useEffect } from 'react';
import { Appbar } from '../components/chrome.jsx';
import { EmptyState, useToast, Sheet } from '../components/ui.jsx';
import Icon from '../components/Icon.jsx';
import { LibraryCard } from '../components/cards.jsx';
import { triggerSync } from '../lib/sync.js';
import { fetchPendingLinks, removeRequest } from '../lib/links.js';
import { removeWork } from '../lib/library.js';
import { getLastRead } from '../lib/reading.js';

// The fandom name without the author suffix ("Heated Rivalry – Rachel Reid" → "Heated Rivalry").
function fandomName(work) {
  return (work.fandom || 'Other').split('–')[0].split(' - ')[0].trim() || 'Other';
}

// Which shelf a work belongs to. Routing is automatic by how it entered the
// library: uploaded EPUBs are Books; AO3 works (bookmarks, tag saves, AO3 links)
// are Fics; everything else added from another site is a Story.
function shelfOf(work) {
  if ((work.origin || '') === 'upload') return 'books';
  if (work.source === 'ao3') return 'fics';
  return 'stories';
}

const SHELVES = [
  { id: 'fics', label: 'Fics' },
  { id: 'stories', label: 'Stories' },
  { id: 'books', label: 'Books' },
];

// Sort options, shown as icons. 'default' keeps the incoming order (source
// activity desc); 'updated' = clock; 'added' (newest) = leaf; 'read' = book
// (most recently opened in the reader); 'title' = A–Z (Books only).
const SORT_OPTS = {
  default: { icon: 'solar:sort-vertical-linear', label: 'Default order' },
  updated: { icon: 'solar:clock-circle-linear', label: 'Last updated' },
  added: { icon: 'solar:leaf-linear', label: 'Last added' },
  read: { icon: 'solar:book-linear', label: 'Last read' },
  title: { icon: 'solar:sort-from-top-to-bottom-linear', label: 'A–Z' },
};

// Sort a list without mutating it. Timestamps are ISO strings (sortable as text).
function sortWorks(list, sort, lastRead = {}) {
  const arr = [...list];
  if (sort === 'added') arr.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  else if (sort === 'updated') arr.sort((a, b) => (b.sourceUpdated || '').localeCompare(a.sourceUpdated || ''));
  else if (sort === 'title') arr.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
  else if (sort === 'read') arr.sort((a, b) => (lastRead[b.id] || '').localeCompare(lastRead[a.id] || ''));
  return arr;
}

// Sort control — a compact icon button that opens a dropdown of options
// (icon + label), instead of laying every option out in a row.
function SortDropdown({ value, options, onChange, align = 'right' }) {
  const [open, setOpen] = useState(false);
  const cur = SORT_OPTS[value] || SORT_OPTS[options[0]];
  return (
    <div className="sortdd">
      <button className="sortdd-btn" onClick={() => setOpen(o => !o)} aria-haspopup="listbox"
        aria-expanded={open} aria-label={`Sort: ${cur.label}`} title={`Sort: ${cur.label}`}>
        <Icon icon={cur.icon} size={20} />
      </button>
      {open && (
        <>
          <div className="dd-backdrop" onClick={() => setOpen(false)} />
          <div className={`sortdd-menu ${align === 'left' ? 'left' : ''}`} role="listbox">
            {options.map(v => (
              <button key={v} role="option" aria-selected={v === value}
                className={`sortdd-item ${v === value ? 'on' : ''}`}
                onClick={() => { onChange(v); setOpen(false); }}>
                <Icon icon={SORT_OPTS[v].icon} size={18} />
                <span>{SORT_OPTS[v].label}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export function LibraryScreen({ works, layout = 'fandom', connected = true, onRemove, onReload, refreshKey, nav }) {
  const open = (w) => nav.push('detail', { work: w, onRemoved: onRemove, onReload });
  const [toast, showToast] = useToast();
  const [syncing, setSyncing] = useState(false);
  const [shelf, setShelf] = useState('fics');
  const [status, setStatus] = useState('all');     // all | ongoing | complete (fics/stories)
  const [sort, setSort] = useState('default');      // default | added | updated | title
  const [pendingLinks, setPendingLinks] = useState([]);
  const [collapsed, setCollapsed] = useState({});   // fandom name -> collapsed?
  const [pendingDelete, setPendingDelete] = useState(null);
  const toggleSection = (name) => setCollapsed(c => ({ ...c, [name]: !c[name] }));

  const reloadLinks = () => fetchPendingLinks().then(setPendingLinks).catch(() => {});
  useEffect(() => { reloadLinks(); }, [refreshKey]);

  const removeLink = async (id) => {
    setPendingLinks(list => list.filter(r => r.id !== id));
    const res = await removeRequest(id);
    if (res.ok) showToast('Removed.');
    else { showToast(res.error || 'Could not remove.', 'solar:danger-triangle-bold'); reloadLinks(); }
  };

  // On-device sync runs (and finishes) right here, then we refresh the library.
  const doSync = async () => {
    if (syncing) return;
    setSyncing(true);
    showToast('Syncing…', 'solar:refresh-circle-linear');
    const res = await triggerSync();
    setSyncing(false);
    onReload?.();
    showToast(res.ok
      ? (res.newChapters ? `Synced · ${res.newChapters} new chapter${res.newChapters === 1 ? '' : 's'}` : 'Synced — up to date')
      : (res.error || 'Sync failed.'));
  };
  const syncAction = { icon: syncing ? 'solar:refresh-circle-bold' : 'solar:refresh-circle-linear', onClick: doSync };

  // "Remove from library" with a confirm step (no more accidental swipe deletes).
  const confirmDelete = async () => {
    const w = pendingDelete;
    setPendingDelete(null);
    if (!w) return;
    onRemove?.(w.id); // optimistic
    try { await removeWork(w.id); showToast('Removed from library'); }
    catch { showToast('Could not remove — try again', 'solar:danger-triangle-bold'); onReload?.(); }
  };

  if (works === null) {
    return (
      <div className="screen">
        <Appbar large title="Library" />
        <div className="scroll" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="fetch busy" style={{ width: 44, height: 44 }}>
            <svg className="ring" viewBox="0 0 44 44"><circle className="track" cx="22" cy="22" r="19"></circle>
              <circle className="bar" cx="22" cy="22" r="19" strokeDasharray="119" strokeDashoffset="50"></circle></svg>
          </div>
        </div>
      </div>
    );
  }

  const ready = works;
  const isBooks = shelf === 'books';

  // Counts per shelf (for the tab labels) and the works for the active shelf.
  const counts = { fics: 0, stories: 0, books: 0 };
  for (const w of ready) counts[shelfOf(w)]++;
  const shelfWorks = ready.filter(w => shelfOf(w) === shelf);

  // Status filter (fics/stories only).
  const ongoingCount = shelfWorks.filter(w => w.status !== 'complete').length;
  const completeCount = shelfWorks.length - ongoingCount;
  const statusFiltered = isBooks ? shelfWorks
    : status === 'complete' ? shelfWorks.filter(w => w.status === 'complete')
    : status === 'ongoing' ? shelfWorks.filter(w => w.status !== 'complete')
    : shelfWorks;
  const lastRead = getLastRead(); // re-read each render so it stays fresh after reading
  const shown = sortWorks(statusFiltered, sort, lastRead);

  // Pending (still-downloading) link requests belong to the Stories shelf.
  const pending = shelf === 'stories' ? pendingLinks : [];

  // Books auto-group by series (manual/EPUB) or, failing that, by author — so
  // uploads that share a series or author cluster without any manual work.
  const bookGroups = isBooks ? groupBooks(shown, sort, lastRead) : [];
  const useSeries = isBooks && bookGroups.some(g => !g.standalone);
  // Fics ALWAYS group (by AO3 series first, then fandom) — every sort reorders
  // the sections instead of flattening, so the collapse toggle never vanishes
  // and the row never jumps when you change sort. AO3 series are pulled out
  // first (auto-grouped like Books); the rest ("loose") group by fandom.
  const useFandom = shelf === 'fics';
  const { seriesGroups: ficsSeries, loose: ficsLoose } = useFandom
    ? groupFicsSeries(shown, sort, lastRead)
    : { seriesGroups: [], loose: shown };
  const fandomNames = useFandom ? [...new Set(ficsLoose.map(fandomName))] : [];
  const sectionNames = useFandom
    ? [...ficsSeries.map(g => g.name), ...fandomNames]
    : useSeries ? bookGroups.map(g => g.name) : [];
  const anyExpanded = sectionNames.some(n => !collapsed[n]);
  const showCollapseToggle = sectionNames.length > 1 && shown.length > 0;
  const toggleAll = () => {
    if (anyExpanded) { const all = {}; sectionNames.forEach(n => { all[n] = true; }); setCollapsed(all); }
    else setCollapsed({});
  };
  const collapseBtn = showCollapseToggle ? (
    <button className="iconbtn ghost" onClick={toggleAll} aria-label={anyExpanded ? 'Collapse all' : 'Expand all'}
      title={anyExpanded ? 'Collapse all' : 'Expand all'}
      style={{ flex: 'none', width: 40, height: 42, background: 'var(--surface-2)', borderRadius: 'var(--radius-md)' }}>
      <Icon icon={anyExpanded ? 'solar:alt-arrow-up-linear' : 'solar:alt-arrow-down-linear'} size={20} />
    </button>
  ) : null;

  const SORTS = isBooks
    ? ['added', 'title', 'read']
    : ['default', 'updated', 'added', 'read'];
  // Keep sort valid when switching shelves (books has no 'default'/'updated').
  const activeSort = SORTS.includes(sort) ? sort : SORTS[0];

  const switchShelf = (id) => {
    setShelf(id);
    setStatus('all');
    setSort(id === 'books' ? 'added' : 'default');
  };

  const emptyCopy = {
    fics: { icon: 'solar:notebook-linear', title: 'No fics yet', desc: 'AO3 works land here — track a tag in Discover, or tap + to add one by link.' },
    stories: { icon: 'solar:book-linear', title: 'No stories yet', desc: 'Royal Road, Scribble Hub and other sites land here — tap + to add one by link.' },
    books: { icon: 'solar:book-2-linear', title: 'No books yet', desc: 'Tap + to upload an EPUB of a book you own.' },
  }[shelf];

  return (
    <div className="screen">
      <Appbar large title="Library" actions={[syncAction]} />
      {toast}
      <div className="scroll">
        <div className="seg src-seg" style={{ margin: '0 20px 14px' }}>
          {SHELVES.map(s => (
            <button key={s.id} className={shelf === s.id ? 'on' : ''} onClick={() => switchShelf(s.id)}>
              {s.label} · {counts[s.id]}
            </button>
          ))}
        </div>

        {(shelfWorks.length > 0 || pending.length > 0) && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, margin: '0 20px 16px' }}>
            {isBooks ? (
              <>
                {/* Books sort as three tabs (Last added / A–Z / Last read), like
                    the Fics status tabs — no dropdown, no "All" pill. */}
                <div className="seg statusseg" style={{ flex: 1 }}>
                  {SORTS.map(s => (
                    <button key={s} className={activeSort === s ? 'on' : ''} onClick={() => setSort(s)}>
                      {SORT_OPTS[s].label}
                    </button>
                  ))}
                </div>
                {collapseBtn}
              </>
            ) : (
              <>
                <div className="seg statusseg" style={{ flex: 1 }}>
                  <button className={status === 'all' ? 'on' : ''} onClick={() => setStatus('all')}>All{status === 'all' ? ` · ${shelfWorks.length}` : ''}</button>
                  <button className={status === 'ongoing' ? 'on' : ''} onClick={() => setStatus('ongoing')}>Ongoing{status === 'ongoing' ? ` · ${ongoingCount}` : ''}</button>
                  <button className={status === 'complete' ? 'on' : ''} onClick={() => setStatus('complete')}>Complete{status === 'complete' ? ` · ${completeCount}` : ''}</button>
                </div>
                <SortDropdown value={activeSort} options={SORTS} onChange={setSort} align="right" />
                {collapseBtn}
              </>
            )}
          </div>
        )}

        {pending.map(r => (
          <div key={r.id} style={{ padding: '0 20px' }}><LinkRequestRow req={r} onRemove={() => removeLink(r.id)} /></div>
        ))}

        {shelfWorks.length === 0 && pending.length === 0 ? (
          <div style={{ padding: '0 20px' }}>
            <EmptyState icon={emptyCopy.icon} title={emptyCopy.title} desc={emptyCopy.desc} />
          </div>
        ) : shown.length === 0 ? (
          <div style={{ padding: '0 20px' }}>
            <EmptyState icon="solar:inbox-line-linear" title="Nothing under this filter"
              desc="Try a different status filter." />
          </div>
        ) : useSeries ? (
          <SeriesSections groups={bookGroups} open={open} onDelete={setPendingDelete} collapsed={collapsed} toggle={toggleSection} />
        ) : useFandom ? (
          <>
            {ficsSeries.length > 0 && (
              <SeriesSections groups={ficsSeries} open={open} onDelete={setPendingDelete} collapsed={collapsed} toggle={toggleSection} />
            )}
            <FandomSections works={ficsLoose} open={open} onDelete={setPendingDelete} collapsed={collapsed} toggle={toggleSection} sort={sort} lastRead={lastRead} />
          </>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 13, padding: '0 20px 24px' }}>
            {shown.map(w => <LibraryCard key={w.id} work={w} onOpen={open} onDelete={() => setPendingDelete(w)} />)}
          </div>
        )}
      </div>

      <Sheet open={!!pendingDelete} onClose={() => setPendingDelete(null)} title="Remove from library?">
        <div style={{ fontSize: 13.5, lineHeight: 1.5, color: 'var(--text-secondary)', marginBottom: 16 }}>
          “{pendingDelete?.title}” will be hidden from your library.{pendingDelete?.origin === 'upload'
            ? ' The uploaded copy stays on your device.'
            : ' Your copy at the source is untouched.'}
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-lg btn-surface" style={{ flex: 1 }} onClick={() => setPendingDelete(null)}>Cancel</button>
          <button className="btn btn-lg" style={{ flex: 1, background: 'var(--danger)', color: '#fff' }} onClick={confirmDelete}>
            <Icon icon="solar:trash-bin-trash-bold" size={18} /> Remove</button>
        </div>
      </Sheet>
    </div>
  );
}

function prettyUrl(url) {
  return (url || '').replace(/^https?:\/\/(www\.)?/i, '').replace(/\/$/, '');
}

function LinkRequestRow({ req, onRemove }) {
  const failed = req.status === 'error';
  const label = req.status === 'fetching' ? 'Downloading…' : failed ? 'Couldn’t download' : 'Queued for download';
  const icon = failed ? 'solar:danger-triangle-bold' : req.status === 'fetching' ? 'solar:download-minimalistic-linear' : 'solar:clock-circle-linear';
  const color = failed ? 'var(--danger, #f5455c)' : 'var(--text-tertiary)';
  return (
    <div className="libcard" style={{ marginBottom: 13, position: 'relative' }}>
      <div className="meta">
        <div className="story-title" style={{ marginBottom: 2, paddingRight: 38 }}>{req.title || prettyUrl(req.url)}</div>
        <div className="story-sub" style={{ marginBottom: 7, wordBreak: 'break-all' }}>{prettyUrl(req.url)}</div>
        <div className="metarow" style={{ color }}><Icon icon={icon} size={14} /><span>{label}</span></div>
        {failed && req.error && <div className="summary" style={{ marginTop: 6 }}>{req.error}</div>}
      </div>
      {onRemove && (
        <button className="iconbtn ghost" onClick={onRemove} aria-label="Remove" title="Remove"
          style={{ position: 'absolute', top: 10, right: 10, width: 32, height: 32, background: 'var(--surface-2)', borderRadius: 'var(--radius-md)' }}>
          <Icon icon="solar:trash-bin-trash-linear" size={18} />
        </button>
      )}
    </div>
  );
}

// Auto-group books: by manual/EPUB series name if set, else by author. A series
// (even one book) keeps its name; an author cluster needs ≥2 books to form a
// section — lone books fall into "Standalone". Within a series, books order by
// index; other groups by title.
//
// The GROUP order responds to the active sort, so switching tabs visibly
// reorders the shelf:
//   • A–Z      → groups alphabetical by their title (series/author name);
//                ungrouped books A–Z; Standalone last.
//   • Last added / Last read → groups ordered by their most-recent book; ditto
//                for standalone; Standalone last.
function groupBooks(works, sort = 'added', lastRead = {}) {
  const byKey = new Map();
  const ordered = [];
  const standalone = { name: 'Standalone', items: [], standalone: true };
  for (const w of works) {
    const key = (w.seriesName || w.author || '').trim();
    if (!key) { standalone.items.push(w); continue; }
    let g = byKey.get(key.toLowerCase());
    if (!g) { g = { name: w.seriesName || w.author, items: [], series: !!w.seriesName }; byKey.set(key.toLowerCase(), g); ordered.push(g); }
    g.items.push(w);
  }
  const real = [];
  for (const g of ordered) {
    if (!g.series && g.items.length < 2) standalone.items.push(...g.items);
    else real.push(g);
  }
  // Order books within each section.
  for (const g of real) {
    g.items.sort((a, b) => g.series
      ? ((a.seriesIndex ?? 1e9) - (b.seriesIndex ?? 1e9) || (a.title || '').localeCompare(b.title || ''))
      : (a.title || '').localeCompare(b.title || ''));
  }
  standalone.items = sortWorks(standalone.items, sort, lastRead);

  // Order the sections by the active sort.
  if (sort === 'title') {
    real.sort((a, b) => a.name.localeCompare(b.name));
  } else {
    const recency = (g) => g.items.reduce((m, x) => {
      const v = sort === 'read' ? (lastRead[x.id] || '') : (x.createdAt || '');
      return v > m ? v : m;
    }, '');
    real.sort((a, b) => recency(b).localeCompare(recency(a))); // most-recent first
  }
  if (standalone.items.length) real.push(standalone); // always underneath the named groups
  return real;
}

// Auto-group AO3 fics by their AO3 series: works sharing a series cluster under
// the series name, ordered by part; everything else is "loose" and falls through
// to the existing fandom grouping. Like Books, a series keeps its section even
// with one downloaded work. Series sections sort alphabetically by series name.
function groupFicsSeries(works, sort = 'default', lastRead = {}) {
  const byKey = new Map();
  const loose = [];
  for (const w of works) {
    const key = (w.ao3SeriesId || '').trim();
    const name = (w.ao3SeriesName || '').trim();
    if (!key || !name) { loose.push(w); continue; }
    let g = byKey.get(key);
    if (!g) { g = { name, items: [] }; byKey.set(key, g); }
    g.items.push(w);
  }
  const seriesGroups = [...byKey.values()];
  for (const g of seriesGroups) {
    g.items.sort((a, b) => (a.ao3SeriesIndex ?? 1e9) - (b.ao3SeriesIndex ?? 1e9) || (a.title || '').localeCompare(b.title || ''));
  }
  orderGroups(seriesGroups, sort, lastRead);
  return { seriesGroups, loose };
}

// Order section groups by the active sort (shared by fandom + fics-series
// sections): A–Z by name, Default by size, otherwise by the group's most-recent
// item (added / updated / read).
function orderGroups(groups, sort, lastRead = {}) {
  if (sort === 'title') {
    groups.sort((a, b) => a.name.localeCompare(b.name));
  } else if (sort === 'default') {
    groups.sort((a, b) => b.items.length - a.items.length || a.name.localeCompare(b.name));
  } else {
    const recency = (g) => g.items.reduce((m, x) => {
      const v = sort === 'read' ? (lastRead[x.id] || '') : sort === 'updated' ? (x.sourceUpdated || '') : (x.createdAt || '');
      return v > m ? v : m;
    }, '');
    groups.sort((a, b) => recency(b).localeCompare(recency(a)));
  }
  return groups;
}

// Books grouped into their series/author sections (see groupBooks).
function SeriesSections({ groups, open, onDelete, collapsed, toggle }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '0 20px 24px' }}>
      {groups.map(g => {
        const isOpen = !collapsed[g.name];
        return (
          <div key={g.name}>
            <button className="fandom-head pressable" onClick={() => toggle(g.name)} aria-expanded={isOpen}>
              <Icon icon="solar:alt-arrow-down-linear" size={18}
                style={{ transition: 'transform .18s', transform: isOpen ? 'none' : 'rotate(-90deg)' }} />
              <span className="fandom-name">{g.standalone ? g.name : `📚 ${g.name}`}</span>
              <span className="fandom-count">{g.items.length}</span>
            </button>
            {isOpen && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 13, paddingTop: 11 }}>
                {g.items.map(w => <LibraryCard key={w.id} work={w} onOpen={open} onDelete={() => onDelete(w)} />)}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function FandomSections({ works, open, onDelete, collapsed, toggle, sort = 'default', lastRead = {} }) {
  const groups = [];
  const byName = new Map();
  for (const w of works) {
    const name = fandomName(w);
    let g = byName.get(name);
    if (!g) { g = { name, items: [] }; byName.set(name, g); groups.push(g); }
    g.items.push(w);
  }
  orderGroups(groups, sort, lastRead);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '0 20px 24px' }}>
      {groups.map(g => {
        const isOpen = !collapsed[g.name];
        return (
          <div key={g.name}>
            <button className="fandom-head pressable" onClick={() => toggle(g.name)} aria-expanded={isOpen}>
              <Icon icon="solar:alt-arrow-down-linear" size={18}
                style={{ transition: 'transform .18s', transform: isOpen ? 'none' : 'rotate(-90deg)' }} />
              <span className="fandom-name">{g.name}</span>
              <span className="fandom-count">{g.items.length}</span>
            </button>
            {isOpen && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 13, paddingTop: 11 }}>
                {g.items.map(w => <LibraryCard key={w.id} work={w} onOpen={open} onDelete={() => onDelete(w)} />)}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
