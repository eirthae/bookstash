import { useState, useEffect, useRef, useCallback } from 'react';
import { Appbar } from '../components/chrome.jsx';
import Icon from '../components/Icon.jsx';
import { SearchField, EmptyState, TAG_COLOR, useToast, Sheet, Segmented, PullToRefresh } from '../components/ui.jsx';
import { TagTile, SuggestionCard } from '../components/cards.jsx';
import {
  fetchTrackedGroups, createGroup, createLanguageGroup, deleteGroup,
  fetchMatches, dismissMatch, markGroupSeen, autocompleteTags, requestSave,
  markLater, unmarkLater, fetchLaterMatches,
} from '../lib/tags.js';
import { kickSync, triggerSync } from '../lib/sync.js';
import { LANGUAGES } from '../lib/languages.js';
import { fetchDiscoveryPrefs, updateDiscoveryPrefs } from '../lib/discovery.js';
import { TRACKED_TAGS, SUGGESTIONS } from '../data/sample.js';
import { GOODREADS_TAGS } from '../data/goodreadsTags.js';
import {
  ROYALROAD_GENRES, ROYALROAD_TAGS, SCRIBBLEHUB_GENRES, SCRIBBLEHUB_TAGS, sourceLabel,
} from '../sources/index.js';

// Combined genre + tag taxonomy per source, for the builder's picker. Genres
// come first (kind:'genre'), then the larger tag list (kind:'tag'); each pick is
// stored as {name, id:slug, kind} so the worker filters by the right native
// mechanism (RR tagsAdd/Remove; SH Series Finder genre ids vs tag ids).
const withKind = (list, kind) => list.map((g) => ({ ...g, kind }));
const TAXONOMY_BY_SOURCE = {
  royalroad: [...withKind(ROYALROAD_GENRES, 'genre'), ...withKind(ROYALROAD_TAGS, 'tag')],
  scribblehub: [...withKind(SCRIBBLEHUB_GENRES, 'genre'), ...withKind(SCRIBBLEHUB_TAGS, 'tag')],
};

// Whether a discovered work can be saved into the library. AO3 downloads
// directly; Royal Road / Scribble Hub download server-side via the FanFicFare
// link path. "Books" is notify-only — a commercial release can't be fetched, so
// its cards just link out to Open Library and the user buys + uploads the EPUB.
const isSavableSource = (src) => src !== 'books';

// ============================================================================
// Discover — track AO3 tags / tag groups and review the works they turn up.
// Groups are stored in Supabase (tracked_groups); the worker fills tag_matches.
// ============================================================================

export function DiscoverScreen({ nav }) {
  const [groups, setGroups] = useState(null); // null = loading
  const [builderOpen, setBuilderOpen] = useState(false);
  const [addLangOpen, setAddLangOpen] = useState(false); // follow a new language
  const [filtersOpen, setFiltersOpen] = useState(false); // global discovery filters
  const [tagShelf, setTagShelf] = useState('ao3'); // ao3 | sites | books
  const [toast, showToast] = useToast();

  const load = useCallback(() => {
    fetchTrackedGroups()
      .then((r) => setGroups(r ?? TRACKED_TAGS))
      .catch(() => setGroups(TRACKED_TAGS));
  }, []);
  useEffect(() => { load(); }, [load]);

  // Pull-to-refresh: run the on-device sync (tag discovery + follow-updates),
  // then reload the tracked groups so new match counts show.
  const doSync = useCallback(async () => { try { await triggerSync(); } finally { load(); } }, [load]);

  const all = groups || [];
  // Language groups get their own section; keep them out of the tag grid.
  const tags = all.filter((t) => t.kind !== 'language');
  const langGroups = all.filter((t) => t.kind === 'language');
  const fresh = tags.reduce((a, t) => a + (t.fresh || 0), 0);
  // Shelve the tracked groups by source, mirroring the library's shelves.
  const shelfMatch = {
    ao3: (s) => (s || 'ao3') === 'ao3',
    sites: (s) => s === 'royalroad' || s === 'scribblehub',
    books: (s) => s === 'books',
  };
  const TAG_SHELVES = [
    { id: 'ao3', label: 'AO3' },
    { id: 'sites', label: 'Stories' },
    { id: 'books', label: 'Books' },
  ];
  const shelfCount = (id) => tags.filter((t) => shelfMatch[id](t.source)).length;
  const shelfTags = tags.filter((t) => shelfMatch[tagShelf](t.source));
  const open = (tag) => nav.push('tagresults', { tag, onLeave: load });
  const openLater = () => nav.push('later', { onLeave: load });

  const onCreated = (g) => {
    setBuilderOpen(false);
    // Jump to the shelf the new group lives on, so you land on the tag you just
    // created instead of staying on whatever shelf you opened the builder from.
    const s = g && g.source;
    setTagShelf(s === 'royalroad' || s === 'scribblehub' ? 'sites' : s === 'books' ? 'books' : 'ao3');
    showToast(`Now tracking “${g.name}”`);
    load();
  };

  // Follow a language: start a "browse this whole language" group, unless we
  // already follow it. Codes already followed are hidden from the picker.
  const followLanguage = async (lang) => {
    setAddLangOpen(false);
    if (langGroups.some((g) => g.language === lang.code)) { showToast(`Already following ${lang.english}`); return; }
    try {
      await createLanguageGroup({ code: lang.code, name: lang.native, label: lang.english });
      showToast(`Now following ${lang.english}`);
      load();
    } catch {
      showToast("Couldn't add — check your connection", 'solar:danger-triangle-linear');
    }
  };
  const followedLangCodes = new Set(langGroups.map((g) => g.language));

  return (
    <div className="screen">
      <Appbar large title="Discover" actions={[{ icon: 'solar:filter-bold', onClick: () => setFiltersOpen(true) }]} />
      <PullToRefresh className="scroll" onRefresh={doSync} style={{ padding: '0 20px 24px' }}>
        <button className="set-group pressable" onClick={openLater}
          style={{ display: 'flex', alignItems: 'center', gap: 13, padding: 13, width: '100%', textAlign: 'left', marginBottom: 18 }}>
          <div className="set-ic"><Icon icon="solar:bookmark-linear" size={18} /></div>
          <div style={{ flex: 1 }}>
            <div className="set-h">Later</div>
            <div className="set-d">Works you set aside to decide on.</div>
          </div>
          <Icon icon="solar:alt-arrow-right-linear" size={18} color="var(--text-tertiary)" />
        </button>

        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 12 }}>
          <div className="section-label">Tracked · {tags.length}</div>
          {fresh > 0 && <span style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 600 }}>{fresh} new matches</span>}
        </div>

        <div className="seg src-seg" style={{ marginBottom: 14 }}>
          {TAG_SHELVES.map((s) => (
            <button key={s.id} className={tagShelf === s.id ? 'on' : ''} onClick={() => setTagShelf(s.id)}>
              {s.label} · {shelfCount(s.id)}
            </button>
          ))}
        </div>

        {groups === null ? (
          <div style={{ color: 'var(--text-tertiary)', fontSize: 13, padding: '8px 2px' }}>Loading…</div>
        ) : shelfTags.length === 0 ? (
          <EmptyState
            icon="solar:hashtag-circle-linear"
            title="Nothing tracked here yet"
            desc="Track a tag or a tag group and BookStash will surface matching works on each sync — fetched on your device."
            action={<button className="btn btn-lg btn-primary" onClick={() => setBuilderOpen(true)}>Track a tag</button>}
          />
        ) : (
          <div className="tilegrid">
            {shelfTags.map((t) => <TagTile key={t.id} tag={t} onOpen={open} />)}
            <button className="tile add pressable" onClick={() => setBuilderOpen(true)}>
              <Icon icon="solar:add-circle-linear" size={30} />
              <div className="t-name" style={{ marginTop: 6 }}>Track a new tag</div>
            </button>
          </div>
        )}

        {groups !== null && tagShelf === 'ao3' && (
          <>
            <div className="section-label" style={{ marginTop: 26, marginBottom: 12 }}>Followed languages</div>
            <div className="tilegrid">
              {langGroups.map((g) => <TagTile key={g.id} tag={g} onOpen={() => open(g)} />)}
              <button className="tile add pressable" onClick={() => setAddLangOpen(true)}>
                <Icon icon="solar:add-circle-linear" size={30} />
                <div className="t-name" style={{ marginTop: 6 }}>Add language</div>
              </button>
            </div>
            <div style={{ fontSize: 11.5, color: 'var(--text-tertiary)', marginTop: 8 }}>
              Follow a whole language to see new works in it. Follow as many as you like.
            </div>
          </>
        )}
      </PullToRefresh>

      <TagGroupBuilder open={builderOpen} onClose={() => setBuilderOpen(false)} onCreated={onCreated}
        initialSource={{ ao3: 'ao3', sites: 'royalroad', books: 'books' }[tagShelf] || 'ao3'} />
      <AddLanguageSheet open={addLangOpen} onClose={() => setAddLangOpen(false)}
        followedCodes={followedLangCodes} onPick={followLanguage} />
      <DiscoveryFiltersSheet open={filtersOpen} onClose={() => setFiltersOpen(false)} showToast={showToast} shelf={tagShelf} />
      {toast}
    </div>
  );
}

// ---- Add a language to follow --------------------------------------------
// Searchable list of AO3 languages; ones already followed are hidden.
function AddLanguageSheet({ open, onClose, followedCodes, onPick }) {
  const [q, setQ] = useState('');
  const needle = q.trim().toLowerCase();
  const choices = LANGUAGES
    .filter((l) => !followedCodes.has(l.code))
    .filter((l) => !needle || l.english.toLowerCase().includes(needle) || l.native.toLowerCase().includes(needle));
  return (
    <Sheet open={open} onClose={onClose} title="Follow a language" maxH="80%">
      <div className="searchfield" style={{ marginBottom: 12 }}>
        <Icon icon="solar:magnifer-linear" size={18} color="var(--text-tertiary)" />
        <input placeholder="Search languages…" value={q} onChange={(e) => setQ(e.target.value)}
          autoCapitalize="off" autoCorrect="off" spellCheck={false} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, maxHeight: '52vh', overflowY: 'auto' }}>
        {choices.length === 0 ? (
          <div style={{ fontSize: 13, color: 'var(--text-tertiary)', padding: '12px 4px' }}>No more languages to add.</div>
        ) : choices.map((l) => (
          <button key={l.code} className="set-row pressable" style={{ width: '100%', textAlign: 'left' }} onClick={() => onPick(l)}>
            <div className="set-ic"><Icon icon="solar:global-linear" size={18} /></div>
            <div className="set-tx"><div className="set-h">{l.english}</div><div className="set-d">{l.native}</div></div>
            <Icon icon="solar:add-circle-linear" size={20} color="var(--accent)" />
          </button>
        ))}
      </div>
    </Sheet>
  );
}

// ---- Global discovery filters --------------------------------------------
// Preferred languages (empty = all) + globally-excluded tags. Applied by the
// worker to every tag-discovery search.
const SHELF_LABEL = { ao3: 'AO3', sites: 'Stories', books: 'Books' };

function DiscoveryFiltersSheet({ open, onClose, showToast, shelf = 'ao3' }) {
  const [langs, setLangs] = useState([]);       // [{code,native,english}]
  const [excludedObj, setExcludedObj] = useState({ ao3: [], sites: [], books: [] }); // per-shelf {name,id,kind}
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [langPick, setLangPick] = useState(false);
  const excluded = excludedObj[shelf] || []; // the active shelf's exclude list

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    fetchDiscoveryPrefs()
      .then((p) => { setLangs(p.languages || []); setExcludedObj(p.excludedTags || { ao3: [], sites: [], books: [] }); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [open]);

  const removeLang = (code) => setLangs((ls) => ls.filter((l) => l.code !== code));
  const addLang = (l) => { setLangs((ls) => (ls.some((x) => x.code === l.code) ? ls : [...ls, l])); setLangPick(false); };
  const addExcluded = (t) => setExcludedObj((o) => {
    const cur = o[shelf] || [];
    return cur.some((x) => x.name === t.name) ? o : { ...o, [shelf]: [...cur, t] };
  });
  const removeExcluded = (name) => setExcludedObj((o) => ({ ...o, [shelf]: (o[shelf] || []).filter((x) => x.name !== name) }));

  const save = async () => {
    setSaving(true);
    try {
      await updateDiscoveryPrefs({ languages: langs, excludedTags: excludedObj });
      showToast('Discovery filters saved');
      onClose();
    } catch {
      showToast("Couldn't save filters", 'solar:danger-triangle-linear');
    } finally { setSaving(false); }
  };

  const pickable = LANGUAGES.filter((l) => !langs.some((x) => x.code === l.code));

  return (
    <Sheet open={open} onClose={onClose} title={`Discovery filters · ${SHELF_LABEL[shelf] || ''}`} maxH="86%">
      {loading ? (
        <div style={{ fontSize: 13, color: 'var(--text-tertiary)', padding: '12px 4px' }}>Loading…</div>
      ) : (
        <>
          {shelf === 'ao3' && (<>
          <div className="section-label" style={{ marginBottom: 8 }}>Only these languages</div>
          <div style={{ fontSize: 11.5, color: 'var(--text-tertiary)', marginBottom: 10 }}>
            Discovery will only surface works in these languages. Leave empty to allow all.
          </div>
          <div className="chiprow" style={{ marginBottom: 10 }}>
            {langs.map((l) => (
              <button key={l.code} className="chip pressable" onClick={() => removeLang(l.code)}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                {l.english}
                <Icon icon="solar:close-circle-bold" size={15} color="var(--text-tertiary)" />
              </button>
            ))}
            {langs.length === 0 && <span style={{ fontSize: 12.5, color: 'var(--text-tertiary)' }}>All languages</span>}
          </div>
          {langPick ? (
            <div style={{ maxHeight: 200, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', marginBottom: 14 }}>
              {pickable.map((l) => (
                <button key={l.code} className="pressable" onClick={() => addLang(l)}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', textAlign: 'left', padding: '9px 12px', background: 'transparent', borderBottom: '1px solid var(--border)', fontSize: 13.5, color: 'var(--text-primary)' }}>
                  <Icon icon="solar:global-linear" size={15} color="var(--text-tertiary)" />
                  <span>{l.english}</span>
                  <span style={{ color: 'var(--text-tertiary)', marginLeft: 'auto' }}>{l.native}</span>
                </button>
              ))}
            </div>
          ) : (
            <button className="btn btn-surface" style={{ marginBottom: 18 }} onClick={() => setLangPick(true)}>
              <Icon icon="solar:add-circle-linear" size={18} /> Add language
            </button>
          )}
          </>)}

          <div className="section-label" style={{ marginTop: 6, marginBottom: 8 }}>Never show {SHELF_LABEL[shelf]} works tagged</div>
          <div style={{ fontSize: 11.5, color: 'var(--text-tertiary)', marginBottom: 10 }}>
            Hide any discovered {SHELF_LABEL[shelf]} work carrying these tags{shelf === 'ao3' ? ' — including ratings like “Explicit”' : ''}. Applies to this shelf only.
          </div>
          {shelf === 'ao3'
            ? <TagPicker picked={excluded} onAdd={addExcluded} onRemove={removeExcluded}
                placeholder="Search AO3 tags to exclude…" accent="var(--danger, #f5455c)" />
            : <SubjectPicker picked={excluded} onAdd={addExcluded} onRemove={removeExcluded}
                placeholder="Type a tag to exclude…" accent="var(--danger, #f5455c)" />}

          <button className="btn btn-lg btn-primary" style={{ width: '100%', marginTop: 18 }} disabled={saving} onClick={save}>
            {saving ? 'Saving…' : <><Icon icon="solar:check-circle-bold" size={18} /> Save filters</>}
          </button>
        </>
      )}
    </Sheet>
  );
}

// Search AO3 tags + pick them into a list, shown as removable chips. Reused for
// both the include set and the exclude set; `accent` recolors the exclude one.
function TagPicker({ picked, onAdd, onRemove, placeholder, accent }) {
  const [term, setTerm] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [err, setErr] = useState(''); // why the live AO3 lookup failed (if it did)
  const debounce = useRef();
  const reqId = useRef(0); // monotonic id so a slow earlier search can't overwrite a newer one

  useEffect(() => {
    clearTimeout(debounce.current);
    const q = term.trim();
    if (q.length < 2) { setResults([]); setSearching(false); setErr(''); return; }
    const id = ++reqId.current; // this query's ticket
    setSearching(true); setErr('');
    debounce.current = setTimeout(() => {
      autocompleteTags(q)
        .then((r) => { if (id === reqId.current) { setResults(r); setErr(''); } })   // ignore stale resolutions
        .catch((e) => { if (id === reqId.current) { setResults([]); setErr((e && e.message) || 'AO3 unreachable'); } })
        .finally(() => { if (id === reqId.current) setSearching(false); });
    }, 280);
    return () => clearTimeout(debounce.current);
  }, [term]);

  const add = (t) => { onAdd(t); setTerm(''); setResults([]); reqId.current++; };
  // Close this picker's suggestion list when it loses focus, so moving to the
  // other (include ↔ exclude) field doesn't leave a stale dropdown open. Delay
  // so a tap on a suggestion still registers before the list clears.
  const onBlur = () => { reqId.current++; setTimeout(() => setResults([]), 150); };

  return (
    <div>
      {picked.length > 0 && (
        <div className="chiprow" style={{ flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
          {picked.map((t) => {
            const c = accent || TAG_COLOR[t.kind] || TAG_COLOR.freeform;
            return (
              <span key={t.name} className="chip" style={{ background: `color-mix(in srgb, ${c} 16%, transparent)`, color: c, paddingRight: 6 }}>
                <span className="swatch" style={{ background: c }}></span>{t.name}
                <button className="iconbtn" style={{ width: 18, height: 18, marginLeft: 2 }} onClick={() => onRemove(t.name)} aria-label="Remove tag">
                  <Icon icon="solar:close-circle-bold" size={15} color={c} />
                </button>
              </span>
            );
          })}
        </div>
      )}
      <SearchField placeholder={placeholder} value={term} onChange={setTerm} onBlur={onBlur}
        onSubmit={() => { const t = term.trim(); if (t) add(results[0] || { name: t, id: '', kind: 'freeform' }); }} />
      {searching && <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 6, paddingLeft: 2 }}>Searching AO3…</div>}
      {!searching && err && (
        <div style={{ fontSize: 12, color: 'var(--danger, #f5455c)', marginTop: 6, paddingLeft: 2 }}>
          Couldn’t reach AO3 ({err}) — you can still add the tag below.
        </div>
      )}
      {!searching && term.trim().length >= 2 && results.length === 0 && (
        <button className="pressable" onClick={() => add({ name: term.trim(), id: '', kind: 'freeform' })}
          style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'left', marginTop: 8, padding: '11px 14px', border: '1px solid var(--border)', borderRadius: 12, background: 'transparent' }}>
          <Icon icon="solar:add-circle-linear" size={18} color={accent || 'var(--accent)'} />
          <span style={{ flex: 1, minWidth: 0 }}>Add “{term.trim()}”</span>
        </button>
      )}
      {results.length > 0 && (
        <div className="tag-suggest" style={{ marginTop: 8, border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
          {results.map((t) => (
            <button
              key={`${t.name}-${t.id}`}
              className="pressable"
              onClick={() => add(t)}
              style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'left', padding: '11px 14px', background: 'transparent', borderBottom: '1px solid var(--border)' }}
            >
              <Icon icon="solar:add-circle-linear" size={18} color={accent || 'var(--accent)'} />
              <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// Pick from a source's fixed genre + tag taxonomy (no live search — the list is
// shipped in the source registry). Stores each pick as {name, id:slug, kind}.
function GenrePicker({ genres, label, picked, onAdd, onRemove }) {
  const [term, setTerm] = useState('');
  const q = term.trim().toLowerCase();
  const pickedSlugs = new Set(picked.map((t) => t.id));
  const matches = genres
    .filter((g) => !pickedSlugs.has(g.slug))
    .filter((g) => !q || g.name.toLowerCase().includes(q))
    .slice(0, 14);
  const add = (g) => { onAdd({ name: g.name, id: g.slug, kind: g.kind || 'genre' }); setTerm(''); };

  return (
    <div>
      {picked.length > 0 && (
        <div className="chiprow" style={{ flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
          {picked.map((t) => {
            const c = TAG_COLOR.freeform;
            return (
              <span key={t.id} className="chip" style={{ background: `color-mix(in srgb, ${c} 16%, transparent)`, color: c, paddingRight: 6 }}>
                <span className="swatch" style={{ background: c }}></span>{t.name}
                <button className="iconbtn" style={{ width: 18, height: 18, marginLeft: 2 }} onClick={() => onRemove(t.name)} aria-label="Remove genre">
                  <Icon icon="solar:close-circle-bold" size={15} color={c} />
                </button>
              </span>
            );
          })}
        </div>
      )}
      <SearchField placeholder={`Filter ${label} genres…`} value={term} onChange={setTerm} />
      {matches.length > 0 && (
        <div className="tag-suggest" style={{ marginTop: 8, border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
          {matches.map((g) => (
            <button
              key={g.slug}
              className="pressable"
              onClick={() => add(g)}
              style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'left', padding: '11px 14px', background: 'transparent', borderBottom: '1px solid var(--border)' }}
            >
              <Icon icon="solar:add-circle-linear" size={18} color="var(--accent)" />
              <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{g.name}</span>
              <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '.04em', textTransform: 'uppercase', color: 'var(--text-tertiary)' }}>{g.kind === 'tag' ? 'tag' : 'genre'}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// Free-text subject/genre entry for the Books watcher. Open Library has an
// open-ended subject vocabulary (no fixed list, no autocomplete), so the user
// types a subject and it becomes a chip. Stored as {name, id:'', kind:'subject'}
// so the worker queries Open Library's search.json by subject.
function SubjectPicker({ picked, onAdd, onRemove, placeholder = 'Search reader tags — romance, m/m, enemies to lovers, hockey…', accent }) {
  const [term, setTerm] = useState('');
  const add = (name) => {
    const n = (name || '').trim();
    if (!n) return;
    onAdd({ name: n, id: '', kind: 'subject' });
    setTerm('');
  };
  const commit = () => add(term);
  const c = accent || TAG_COLOR.freeform;

  // Autocomplete over the Goodreads reader-tag vocabulary (free text still works
  // for anything not listed). Hide ones already picked.
  const q = term.trim().toLowerCase();
  const pickedLc = new Set(picked.map((p) => (p.name || '').toLowerCase()));
  const suggestions = q
    ? GOODREADS_TAGS.filter((t) => t.toLowerCase().includes(q) && !pickedLc.has(t.toLowerCase())).slice(0, 8)
    : [];

  return (
    <div>
      {picked.length > 0 && (
        <div className="chiprow" style={{ flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
          {picked.map((t) => (
            <span key={t.name} className="chip" style={{ background: `color-mix(in srgb, ${c} 16%, transparent)`, color: c, paddingRight: 6 }}>
              <span className="swatch" style={{ background: c }}></span>{t.name}
              <button className="iconbtn" style={{ width: 18, height: 18, marginLeft: 2 }} onClick={() => onRemove(t.name)} aria-label="Remove subject">
                <Icon icon="solar:close-circle-bold" size={15} color={c} />
              </button>
            </span>
          ))}
        </div>
      )}
      <div style={{ display: 'flex', gap: 8 }}>
        <div style={{ flex: 1 }}>
          <SearchField placeholder={placeholder} value={term} onChange={setTerm} onSubmit={commit} />
        </div>
        <button className="btn btn-flat" onClick={commit} disabled={!term.trim()} style={{ opacity: term.trim() ? 1 : 0.5 }}>
          <Icon icon="solar:add-circle-linear" size={18} /> Add
        </button>
      </div>
      {suggestions.length > 0 && (
        <div className="chiprow" style={{ flexWrap: 'wrap', gap: 7, marginTop: 10 }}>
          {suggestions.map((s) => (
            <button key={s} className="chip pressable" onClick={() => add(s)}
              style={{ background: 'var(--surface-2)', color: 'var(--text-secondary)' }}>
              <Icon icon="solar:add-circle-linear" size={13} color="var(--text-tertiary)" /> {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ---- Builder sheet: pick a source, pick tags/genres → save a group ----------
const BUILDER_SOURCES = ['ao3', 'royalroad', 'scribblehub', 'books'];

export function TagGroupBuilder({ open, onClose, onCreated, initialSource = 'ao3', initialTags = [] }) {
  const [source, setSource] = useState(initialSource);
  const [picked, setPicked] = useState([]);
  const [excluded, setExcluded] = useState([]);
  const [matchMode, setMatchMode] = useState('all');
  const [status, setStatus] = useState('all'); // all | ongoing | complete
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  // Seed source + included tag(s) each time it opens — lets a story's detail
  // page open this pre-filled with the tapped tag and the right source.
  useEffect(() => {
    if (open) {
      setSource(initialSource || 'ao3');
      setPicked(initialTags || []);
      setExcluded([]); setMatchMode('all'); setStatus('all'); setErr('');
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  // Switching source clears picks — AO3 tags and RR genres aren't interchangeable.
  const changeSource = (s) => { setSource(s); setPicked([]); setExcluded([]); setMatchMode('all'); setStatus('all'); setErr(''); };

  const isAo3 = source === 'ao3';
  const isBooks = source === 'books';
  const noun = isAo3 ? 'tag' : isBooks ? 'subject' : 'genre';
  const has = (list, t) => list.some((x) => x.name.toLowerCase() === t.name.toLowerCase());
  const addPicked = (t) => { setPicked((p) => (has(p, t) ? p : [...p, t])); setErr(''); };
  const removePicked = (name) => setPicked((p) => p.filter((x) => x.name !== name));
  const addExcluded = (t) => setExcluded((p) => (has(p, t) ? p : [...p, t]));
  const removeExcluded = (name) => setExcluded((p) => p.filter((x) => x.name !== name));

  const save = async () => {
    if (!picked.length) { setErr(`Add at least one ${noun} first.`); return; }
    setBusy(true); setErr('');
    try {
      // AO3 honours the chosen match mode. Royal Road / Scribble Hub / Books all
      // AND their tags natively now (multi tagsAdd / Series Finder / Open Library
      // subject query) and subtract excludes, so a multi-tag group is "all".
      const g = await createGroup({
        source,
        tags: picked,
        excludedTags: excluded,
        matchMode: isAo3 ? matchMode : 'all',
        status: isBooks ? 'all' : status,
      });
      onCreated(g);
    } catch (e) {
      setErr(e?.message ? String(e.message) : 'Could not save — check your connection.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet open={open} onClose={onClose} title="Track a tag group" maxH="88vh">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div>
          <div className="section-label" style={{ marginBottom: 8 }}>Source</div>
          <Segmented
            value={source}
            onChange={changeSource}
            options={BUILDER_SOURCES.map((s) => ({ value: s, label: sourceLabel(s) }))}
          />
        </div>

        <div>
          <div className="section-label" style={{ marginBottom: 8 }}>
            {picked.length <= 1
              ? `Track this ${noun}`
              : isAo3
                ? `Track works with ${matchMode === 'all' ? 'ALL' : 'ANY'} of these tags`
                : isBooks
                  ? 'Watch new releases in ALL of these subjects'
                  : 'Track works with ALL of these genres & tags'}
          </div>
          {isAo3 ? (
            <TagPicker picked={picked} onAdd={addPicked} onRemove={removePicked} placeholder="Search AO3 tags to include…" />
          ) : isBooks ? (
            <SubjectPicker picked={picked} onAdd={addPicked} onRemove={removePicked} />
          ) : (
            <GenrePicker
              genres={TAXONOMY_BY_SOURCE[source] || []}
              label={sourceLabel(source)}
              picked={picked}
              onAdd={addPicked}
              onRemove={removePicked}
            />
          )}
          {isBooks && (
            <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 7 }}>
              Notify-only — BookStash can't download bought books. Matches show up to review, then you get the EPUB and upload it.
            </div>
          )}
        </div>

        {isAo3 && picked.length > 1 && (
          <div>
            <div className="section-label" style={{ marginBottom: 8 }}>Match</div>
            <Segmented
              value={matchMode}
              onChange={setMatchMode}
              options={[{ value: 'all', label: 'Has all tags' }, { value: 'any', label: 'Has any tag' }]}
            />
            <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 7 }}>
              {matchMode === 'all'
                ? 'A work must carry every tag in the group.'
                : 'A work matches if it has at least one of these tags.'}
            </div>
          </div>
        )}

        {!isBooks && (
          <div>
            <div className="section-label" style={{ marginBottom: 8 }}>Status</div>
            <Segmented
              value={status}
              onChange={setStatus}
              options={[{ value: 'all', label: 'All' }, { value: 'ongoing', label: 'Ongoing' }, { value: 'complete', label: 'Complete' }]}
            />
            <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 7 }}>
              {status === 'all' ? 'Match works of any completion status.'
                : status === 'ongoing' ? 'Only works still in progress.'
                : 'Only finished works.'}
            </div>
          </div>
        )}

        {isAo3 && (
          <div>
            <div className="section-label" style={{ marginBottom: 8 }}>Exclude <span style={{ fontWeight: 500, color: 'var(--text-tertiary)' }}>(optional)</span></div>
            <TagPicker picked={excluded} onAdd={addExcluded} onRemove={removeExcluded} placeholder="Search AO3 tags to exclude…" accent="var(--danger, #f5455c)" />
            <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 7 }}>
              Works carrying any excluded tag are left out of your matches.
            </div>
          </div>
        )}

        {!isAo3 && !isBooks && (
          <div>
            <div className="section-label" style={{ marginBottom: 8 }}>Exclude genres &amp; tags <span style={{ fontWeight: 500, color: 'var(--text-tertiary)' }}>(optional)</span></div>
            <GenrePicker
              genres={TAXONOMY_BY_SOURCE[source] || []}
              label={sourceLabel(source)}
              picked={excluded}
              onAdd={addExcluded}
              onRemove={removeExcluded}
            />
            <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 7 }}>
              Works with any excluded genre or tag are left out of your matches.
            </div>
          </div>
        )}

        {isBooks && (
          <div>
            <div className="section-label" style={{ marginBottom: 8 }}>Exclude subjects <span style={{ fontWeight: 500, color: 'var(--text-tertiary)' }}>(optional)</span></div>
            <SubjectPicker picked={excluded} onAdd={addExcluded} onRemove={removeExcluded}
              placeholder="Subjects to exclude…" accent="var(--danger, #f5455c)" />
            <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 7 }}>
              Books in any excluded subject are left out of your matches.
            </div>
          </div>
        )}

        {err && <div style={{ color: 'var(--danger, #f5455c)', fontSize: 13 }}>{err}</div>}

        <button className="btn btn-lg btn-primary btn-block" disabled={busy || !picked.length} onClick={save} style={{ opacity: busy || !picked.length ? 0.6 : 1 }}>
          {busy ? 'Saving…' : `Track this ${picked.length > 1 ? 'group' : noun}`}
        </button>
      </div>
    </Sheet>
  );
}

// ---- Results: works the worker found for a tracked group -------------------
export function TagResultsScreen({ tag, nav, onLeave }) {
  const [items, setItems] = useState(null); // null = loading
  const [titleExpanded, setTitleExpanded] = useState(false); // tap title to see full tag-group name
  const [toast, showToast] = useToast();
  const c = TAG_COLOR[tag.kind] || 'var(--accent)';
  const kindLabel = { relationship: 'relationship', fandom: 'fandom', freeform: 'tag', character: 'character', group: 'tag group', language: 'language', genre: 'genre' }[tag.kind] || 'tag';
  const srcLabel = sourceLabel(tag.source || 'ao3');

  useEffect(() => {
    let alive = true;
    fetchMatches(tag.id)
      .then((r) => { if (alive) setItems(r ?? SUGGESTIONS); })
      .catch(() => { if (alive) setItems(SUGGESTIONS); });
    // Viewing the matches clears the "N new" badge on the tile.
    markGroupSeen(tag.id).catch(() => {});
    return () => { alive = false; };
  }, [tag.id]);

  const leave = () => { onLeave && onLeave(); nav.pop(); };

  const dismiss = (w) => {
    setItems((arr) => (arr || []).filter((x) => x.id !== w.id));
    dismissMatch(w.matchId || w.id).catch(() => {});
    showToast('Deleted', 'solar:trash-bin-trash-linear');
  };

  const later = (w) => {
    setItems((arr) => (arr || []).filter((x) => x.id !== w.id));
    markLater(w.matchId || w.id).catch(() => {});
    showToast('Saved for later', 'solar:bookmark-linear');
  };

  const save = (w) => {
    setItems((arr) => (arr || []).map((x) => (x.id === w.id ? { ...x, wanted: true } : x)));
    requestSave(w.matchId || w.id).then(() => kickSync()).catch(() => {});
    showToast('Saved — starting download', 'solar:download-minimalistic-linear');
  };
  const saveStateOf = (w) => (w.saved ? 'saved' : w.wanted ? 'queued' : 'idle');

  const removeGroup = async () => {
    try { await deleteGroup(tag.id); } catch (e) { /* sample data / offline */ }
    showToast('Stopped tracking');
    leave();
  };

  const list = items || [];
  return (
    <div className="screen">
      <Appbar
        back={leave}
        title={tag.name}
        sub={`${tag.count ?? list.length} works · ${kindLabel}`}
        actions={[{ icon: 'solar:trash-bin-trash-linear', onClick: removeGroup }]}
        onTitleClick={() => setTitleExpanded((v) => !v)}
        titleExpanded={titleExpanded}
      />
      <div className="scroll" style={{ padding: '4px 20px 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 16, flexWrap: 'wrap' }}>
          <span className="chip" style={{ background: `color-mix(in srgb, ${c} 16%, transparent)`, color: c, height: 26 }}>
            <span className="swatch" style={{ background: c }}></span>{kindLabel}
          </span>
          <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>metadata only — nothing downloaded</span>
        </div>

        {items === null ? (
          <div style={{ color: 'var(--text-tertiary)', fontSize: 13 }}>Loading…</div>
        ) : list.length === 0 ? (
          <EmptyState icon="solar:inbox-line-linear" title="No matches yet" desc={`When the worker next checks ${srcLabel}, new works for this ${kindLabel} will appear here.`} />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
            {list.map((w) => (
              <SuggestionCard
                key={w.id}
                work={w}
                onSave={isSavableSource(w.source) ? save : null}
                saveState={saveStateOf(w)}
                onLater={() => later(w)}
                onDismiss={() => dismiss(w)}
                onOpen={() => nav.push('detail', { work: w, suggestion: true })}
              />
            ))}
          </div>
        )}
        {toast}
      </div>
    </div>
  );
}

// ---- Later stash: works swiped left ("maybe") for safe-keeping --------------
export function LaterScreen({ nav, onLeave }) {
  const [items, setItems] = useState(null); // null = loading
  const [toast, showToast] = useToast();

  const load = useCallback(() => {
    fetchLaterMatches()
      .then((r) => setItems(r ?? []))
      .catch(() => setItems([]));
  }, []);
  useEffect(() => { load(); }, [load]);

  const leave = () => { onLeave && onLeave(); nav.pop(); };

  const remove = (w) => {
    setItems((arr) => (arr || []).filter((x) => x.id !== w.id));
    dismissMatch(w.matchId || w.id).catch(() => {});
    showToast('Deleted', 'solar:trash-bin-trash-linear');
  };
  const putBack = (w) => {
    setItems((arr) => (arr || []).filter((x) => x.id !== w.id));
    unmarkLater(w.matchId || w.id).catch(() => {});
    showToast('Back in Discover', 'solar:undo-left-round-linear');
  };
  const save = (w) => {
    setItems((arr) => (arr || []).map((x) => (x.id === w.id ? { ...x, wanted: true } : x)));
    requestSave(w.matchId || w.id).then(() => kickSync()).catch(() => {});
    showToast('Saved — starting download', 'solar:download-minimalistic-linear');
  };
  const saveStateOf = (w) => (w.saved ? 'saved' : w.wanted ? 'queued' : 'idle');

  const list = items || [];
  return (
    <div className="screen">
      <Appbar back={leave} title="Later" sub={`${list.length} kept · metadata only`} />
      <div className="scroll" style={{ padding: '4px 20px 24px' }}>
        <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 14 }}>
          Works you set aside to decide on later. Tap ✕ to delete, or the arrow to send one back to Discover.
        </div>
        {items === null ? (
          <div style={{ color: 'var(--text-tertiary)', fontSize: 13 }}>Loading…</div>
        ) : list.length === 0 ? (
          <EmptyState icon="solar:bookmark-linear" title="Nothing saved for later"
            desc="Tap Later on a discovered work to keep its blurb here without downloading it." />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
            {list.map((w) => (
              <SuggestionCard
                key={w.id}
                work={w}
                onSave={isSavableSource(w.source) ? save : null}
                saveState={saveStateOf(w)}
                onLater={() => putBack(w)}
                laterIcon="solar:undo-left-round-linear"
                laterTitle="Send back to Discover"
                onDismiss={() => remove(w)}
                onOpen={() => nav.push('detail', { work: w, suggestion: true })}
              />
            ))}
          </div>
        )}
        {toast}
      </div>
    </div>
  );
}
