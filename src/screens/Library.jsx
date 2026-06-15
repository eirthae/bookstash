import { useState, useEffect } from 'react';
import { Appbar } from '../components/chrome.jsx';
import { EmptyState, useToast, Sheet, PullToRefresh } from '../components/ui.jsx';
import Icon from '../components/Icon.jsx';
import { LibraryCard } from '../components/cards.jsx';
import { triggerSync } from '../lib/sync.js';
import { fetchPendingLinks, removeRequest } from '../lib/links.js';
import { removeWork } from '../lib/library.js';
import { getLastRead } from '../lib/reading.js';
import { fandomName, workTagSet, shelfOf, sortWorks, orderGroups, groupFics, filterWorks } from '../lib/shelving.js';

// shelfOf lives in lib/shelving.js (testable) — re-export so App.jsx and others
// can keep importing it from the Library screen.
export { shelfOf };

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

export function LibraryScreen({ works, layout = 'fandom', connected = true, onRemove, onReload, refreshKey, gotoShelf, nav }) {
  const open = (w) => nav.push('detail', { work: w, onRemoved: onRemove, onReload });
  const [toast, showToast] = useToast();
  const [syncing, setSyncing] = useState(false);
  const [shelf, setShelf] = useState('fics');
  // After a custom add (link/upload), App asks us to jump to the added work's
  // shelf — so adding a fic lands you on Fics, an upload on Books — and shows a
  // success toast so the add doesn't feel like it silently failed.
  useEffect(() => {
    if (!gotoShelf) return;
    if (gotoShelf.shelf) setShelf(gotoShelf.shelf);
    if (gotoShelf.msg) showToast(gotoShelf.msg, 'solar:check-circle-bold');
  }, [gotoShelf]); // eslint-disable-line react-hooks/exhaustive-deps
  const [status, setStatus] = useState('all');     // all | ongoing | complete (fics/stories)
  const [sort, setSort] = useState('default');      // default | added | updated | title
  const [pendingLinks, setPendingLinks] = useState([]);
  const [collapsed, setCollapsed] = useState({});   // fandom name -> collapsed?
  const [pendingDelete, setPendingDelete] = useState(null);
  const [query, setQuery] = useState('');           // search box (title/author/fandom/tag)
  const [incTags, setIncTags] = useState([]);        // advanced filter: must have ALL of these
  const [excTags, setExcTags] = useState([]);        // advanced filter: must have NONE of these
  const [filtersOpen, setFiltersOpen] = useState(false);
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
  const shelfAll = ready.filter(w => shelfOf(w) === shelf);

  // Search + advanced tag filter (before status/sort). Search matches
  // title/author/fandom/tags; include tags require ALL present; exclude none.
  const q = query.trim().toLowerCase();
  const inc = incTags.map(t => t.toLowerCase());
  const exc = excTags.map(t => t.toLowerCase());
  const matchesSearch = (w) => !q || [w.title, w.customTitle, w.author, w.fandom, w.pairing]
    .some(s => (s || '').toLowerCase().includes(q)) || workTagSet(w).some(t => t.includes(q));
  const matchesTags = (w) => {
    if (!inc.length && !exc.length) return true;
    const set = workTagSet(w);
    if (inc.length && !inc.every(t => set.includes(t))) return false;
    if (exc.length && exc.some(t => set.includes(t))) return false;
    return true;
  };
  const filterActive = !!q || inc.length > 0 || exc.length > 0;
  const shelfWorks = shelfAll.filter(w => matchesSearch(w) && matchesTags(w));

  // Tag pool for the filter sheet: this shelf's tags, most-common first.
  const tagPool = (() => {
    const m = new Map();
    for (const w of shelfAll) for (const t of (Array.isArray(w.tags) ? w.tags : [])) {
      const text = (typeof t === 'string' ? t : (t && (t.t || t.name)) || '').trim();
      if (!text) continue;
      const e = m.get(text.toLowerCase()) || { text, n: 0 }; e.n++; m.set(text.toLowerCase(), e);
    }
    return [...m.values()].sort((a, b) => b.n - a.n).map(e => e.text);
  })();

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
  // Fics group BY FANDOM (keeping fandom separation). Within each fandom a
  // multi-work AO3 series collapses into ONE clickable series card → series page.
  const useFandom = shelf === 'fics';
  const ficsGroups = useFandom ? groupFics(shown, sort, lastRead) : [];
  const sectionNames = useFandom
    ? ficsGroups.map(g => g.name)
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
      <PullToRefresh onRefresh={doSync}>
        <div className="seg src-seg" style={{ margin: '0 20px 14px' }}>
          {SHELVES.map(s => (
            <button key={s.id} className={shelf === s.id ? 'on' : ''} onClick={() => switchShelf(s.id)}>
              {s.label} · {counts[s.id]}
            </button>
          ))}
        </div>

        {(shelfAll.length > 0 || filterActive) && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', margin: '0 20px 12px' }}>
            <div className="searchfield" style={{ flex: 1 }}>
              <Icon icon="solar:magnifer-linear" size={18} color="var(--text-tertiary)" />
              <input placeholder={`Search ${shelf}…`} value={query} onChange={(e) => setQuery(e.target.value)}
                autoCapitalize="off" autoCorrect="off" spellCheck={false} />
              {query && <button className="iconbtn" style={{ width: 22, height: 22 }} onClick={() => setQuery('')}><Icon icon="solar:close-circle-bold" size={16} color="var(--text-tertiary)" /></button>}
            </div>
            {!isBooks && (
              <button className="iconbtn ghost" onClick={() => setFiltersOpen(true)}
                style={{ flex: 'none', width: 42, height: 42, borderRadius: 'var(--radius-md)',
                  background: (incTags.length || excTags.length) ? 'var(--accent-soft)' : 'var(--surface-2)',
                  color: (incTags.length || excTags.length) ? 'var(--accent)' : undefined }}
                aria-label="Filter by tags">
                <Icon icon="solar:tuning-2-linear" size={20} />
              </button>
            )}
          </div>
        )}

        {(incTags.length > 0 || excTags.length > 0) && (
          <div className="chiprow" style={{ flexWrap: 'wrap', gap: 8, margin: '0 20px 12px' }}>
            {incTags.map(t => (
              <span key={`i${t}`} className="chip" style={{ background: 'var(--accent-soft)', color: 'var(--accent)', paddingRight: 6 }}>
                {t}<button className="iconbtn" style={{ width: 18, height: 18, marginLeft: 2 }} onClick={() => setIncTags(xs => xs.filter(x => x !== t))}><Icon icon="solar:close-circle-bold" size={14} color="var(--accent)" /></button>
              </span>
            ))}
            {excTags.map(t => (
              <span key={`e${t}`} className="chip" style={{ background: 'color-mix(in srgb, var(--danger,#f5455c) 16%, transparent)', color: 'var(--danger,#f5455c)', paddingRight: 6 }}>
                –{t}<button className="iconbtn" style={{ width: 18, height: 18, marginLeft: 2 }} onClick={() => setExcTags(xs => xs.filter(x => x !== t))}><Icon icon="solar:close-circle-bold" size={14} color="var(--danger,#f5455c)" /></button>
              </span>
            ))}
            <button className="linklike" style={{ fontSize: 12 }} onClick={() => { setIncTags([]); setExcTags([]); }}>Clear</button>
          </div>
        )}

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
          <FicsSections groups={ficsGroups} open={open}
            openSeries={(s) => nav.push('series', { seriesId: s.seriesId, seriesName: s.name, onReload })}
            onDelete={setPendingDelete} collapsed={collapsed} toggle={toggleSection} />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 13, padding: '0 20px 24px' }}>
            {shown.map(w => <LibraryCard key={w.id} work={w} onOpen={open} onDelete={() => setPendingDelete(w)} />)}
          </div>
        )}
      </PullToRefresh>

      <FilterSheet open={filtersOpen} onClose={() => setFiltersOpen(false)} pool={tagPool}
        inc={incTags} exc={excTags} setInc={setIncTags} setExc={setExcTags} />

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

// Fics shelf: fandom sections, each with its series cards (clickable → series
// page) above its loose works. Built by groupFics.
function FicsSections({ groups, open, openSeries, onDelete, collapsed, toggle }) {
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
                {g.series.map(s => <SeriesRow key={s.seriesId} series={s} onOpen={() => openSeries(s)} />)}
                {g.loose.map(w => <LibraryCard key={w.id} work={w} onOpen={open} onDelete={() => onDelete(w)} />)}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// A series, collapsed to one row in the fandom list. Tap → the series page.
function SeriesRow({ series, onOpen }) {
  const n = series.items.length;
  const have = series.items.filter(w => (w.chapters || 0) > 0 || w.offline).length;
  return (
    <button className="series-row pressable" onClick={onOpen}
      style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', textAlign: 'left',
        padding: 13, borderRadius: 'var(--radius-md)', background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
      <Icon icon="solar:bookmark-square-bold" size={22} color="var(--accent)" />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 700, lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{series.name}</div>
        <div style={{ fontSize: 11.5, color: 'var(--text-tertiary)', marginTop: 2 }}>Series · {n} work{n === 1 ? '' : 's'}{have < n ? ` · ${have} downloaded` : ''}</div>
      </div>
      <Icon icon="solar:alt-arrow-right-linear" size={18} color="var(--text-tertiary)" />
    </button>
  );
}

// Advanced tag filter: pick tags from the shelf's pool. Tap to require (AND),
// − to exclude. A tag can't be both.
function FilterSheet({ open, onClose, pool, inc, exc, setInc, setExc }) {
  const [q, setQ] = useState('');
  const needle = q.trim().toLowerCase();
  const list = pool.filter(t => !needle || t.toLowerCase().includes(needle)).slice(0, 100);
  const toggle = (set, other, t) => { set(xs => xs.includes(t) ? xs.filter(x => x !== t) : [...xs, t]); other(xs => xs.filter(x => x !== t)); };
  return (
    <Sheet open={open} onClose={onClose} title="Filter by tags" maxH="82%">
      <div className="searchfield" style={{ marginBottom: 10 }}>
        <Icon icon="solar:magnifer-linear" size={18} color="var(--text-tertiary)" />
        <input placeholder="Find a tag…" value={q} onChange={(e) => setQ(e.target.value)} autoCapitalize="off" autoCorrect="off" spellCheck={false} />
      </div>
      <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 10, lineHeight: 1.45 }}>
        Tap a tag to require it · − to exclude. Works must match every required tag.
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, maxHeight: '50vh', overflowY: 'auto' }}>
        {list.length === 0 ? (
          <div style={{ fontSize: 13, color: 'var(--text-tertiary)', padding: '12px 4px' }}>No tags on this shelf.</div>
        ) : list.map(t => {
          const isInc = inc.includes(t), isExc = exc.includes(t);
          return (
            <div key={t} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button className="pressable" onClick={() => toggle(setInc, setExc, t)}
                style={{ flex: 1, textAlign: 'left', background: 'transparent', padding: '10px 4px', fontSize: 13.5,
                  fontWeight: (isInc || isExc) ? 700 : 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  color: isInc ? 'var(--accent)' : isExc ? 'var(--danger,#f5455c)' : 'var(--text-primary)' }}>
                {isInc ? '✓ ' : ''}{t}
              </button>
              <button className="iconbtn" onClick={() => toggle(setExc, setInc, t)} aria-label="Exclude tag"
                style={{ width: 30, height: 30, borderRadius: 8, flex: 'none',
                  background: isExc ? 'color-mix(in srgb, var(--danger,#f5455c) 18%, transparent)' : 'var(--surface-2)',
                  color: isExc ? 'var(--danger,#f5455c)' : 'var(--text-tertiary)' }}>
                <Icon icon="solar:minus-circle-linear" size={16} />
              </button>
            </div>
          );
        })}
      </div>
      <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
        {(inc.length > 0 || exc.length > 0) && (
          <button className="btn btn-surface" style={{ flex: 1 }} onClick={() => { setInc([]); setExc([]); }}>Clear</button>
        )}
        <button className="btn btn-primary" style={{ flex: 1 }} onClick={onClose}>Done</button>
      </div>
    </Sheet>
  );
}
