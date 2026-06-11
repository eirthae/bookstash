import { useMemo, useState } from 'react';
import Icon from '../components/Icon.jsx';
import { GOODREADS_TAGS } from '../data/goodreadsTags.js';
import { discoverBooks } from '../lib/goodreads.js';

// Discover: find *new* books by reader tag. Notify-only — BookStash shows basic
// info + a link to Goodreads; sourcing the file (buy / borrow / upload) is the
// reader's job. Local-first: one outbound call, only when you tap "Find books".
export function DiscoverScreen() {
  const [include, setInclude] = useState([]);   // up to 3 (AND)
  const [exclude, setExclude] = useState([]);   // up to 2
  const [state, setState] = useState({ kind: 'idle' }); // idle|busy|results|error
  const [results, setResults] = useState([]);

  const search = async () => {
    if (!include.length || state.kind === 'busy') return;
    setState({ kind: 'busy' });
    try {
      const books = await discoverBooks(include, exclude);
      setResults(books);
      setState({ kind: 'results' });
    } catch (e) {
      setState({ kind: 'error', msg: 'Could not reach Goodreads. Check your connection and try again.' });
    }
  };

  const open = (url) => { try { window.open(url, '_blank', 'noopener'); } catch (e) {} };

  return (
    <div className="screen">
      <div className="appbar">
        <div className="title">Discover</div>
        <div className="sub">Find new books by reader tags · opens on Goodreads</div>
      </div>

      <div className="scroll" style={{ padding: '4px 16px 24px' }}>
        <TagField
          label="Include (matches all)" max={3} accent
          tags={include} setTags={setInclude} placeholder="e.g. Hockey, M/M Romance"
        />
        <TagField
          label="Exclude (optional)" max={2}
          tags={exclude} setTags={setExclude} placeholder="e.g. Vampires"
        />

        <button className="btn btn-primary" style={{ width: '100%', marginTop: 4 }}
          disabled={!include.length || state.kind === 'busy'} onClick={search}>
          {state.kind === 'busy'
            ? <><span className="spin" /> Searching Goodreads…</>
            : <><Icon icon="solar:magnifer-bold" size={18} /> Find books</>}
        </button>

        {state.kind === 'error' && <div className="add-note err" style={{ marginTop: 12 }}>{state.msg}</div>}

        {state.kind === 'results' && (
          results.length === 0 ? (
            <div className="empty" style={{ marginTop: 18 }}>
              <div className="e-ic"><Icon icon="solar:magnifer-linear" size={28} /></div>
              <div className="e-t">No books found</div>
              <div className="e-d">Try fewer or broader tags — every included tag has to match.</div>
            </div>
          ) : (
            <div className="booklist" style={{ marginTop: 14 }}>
              <div style={{ fontSize: 12.5, color: 'var(--text-tertiary)', padding: '0 2px 8px' }}>
                {results.length} book{results.length === 1 ? '' : 's'} · tap to view on Goodreads
              </div>
              {results.map((b) => <ResultCard key={b.id} b={b} onOpen={() => open(b.url)} />)}
            </div>
          )
        )}

        {state.kind === 'idle' && (
          <div style={{ fontSize: 12, color: 'var(--text-tertiary)', textAlign: 'center', marginTop: 22, lineHeight: 1.6 }}>
            BookStash doesn’t download books here — it points you to them.<br />
            Find one you like, get it in <b>EPUB</b>, then add it from <b>Library → Add</b> to read it offline.
          </div>
        )}
      </div>
    </div>
  );
}

// A chip input with autocomplete from the reader-tag vocabulary (free text ok).
function TagField({ label, tags, setTags, placeholder, max, accent }) {
  const [q, setQ] = useState('');
  const suggestions = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return [];
    const chosen = new Set(tags.map((t) => t.toLowerCase()));
    return GOODREADS_TAGS.filter((t) => t.toLowerCase().includes(s) && !chosen.has(t.toLowerCase())).slice(0, 6);
  }, [q, tags]);

  const add = (t) => {
    const v = String(t).trim();
    if (!v || tags.length >= max) return;
    if (tags.some((x) => x.toLowerCase() === v.toLowerCase())) { setQ(''); return; }
    setTags([...tags, v]);
    setQ('');
  };
  const remove = (t) => setTags(tags.filter((x) => x !== t));

  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-secondary)', margin: '0 2px 7px' }}>{label}</div>
      {tags.length > 0 && (
        <div className="chiprow" style={{ marginBottom: 8 }}>
          {tags.map((t) => (
            <button key={t} className={`chip ${accent ? 'chip-on' : ''}`} onClick={() => remove(t)}>
              {t} <Icon icon="solar:close-circle-bold" size={14} />
            </button>
          ))}
        </div>
      )}
      {tags.length < max && (
        <>
          <div className="searchfield">
            <Icon icon="solar:tag-linear" size={18} color="var(--text-tertiary)" />
            <input value={q} placeholder={placeholder}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(suggestions[0] || q); } }}
              autoCapitalize="words" autoCorrect="off" />
          </div>
          {suggestions.length > 0 && (
            <div className="suggestions">
              {suggestions.map((s) => (
                <button key={s} className="sugg pressable" onClick={() => add(s)}>{s}</button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function ResultCard({ b, onOpen }) {
  return (
    <button className="bookcard pressable" onClick={onOpen}>
      <div className="bk-cover">{(b.title || '?').trim().slice(0, 1).toUpperCase()}</div>
      <div className="bk-meta">
        <div className="bk-title">{b.title}</div>
        <div className="bk-author">{b.author}</div>
        {b.rating && <div className="bk-sub">★ {b.rating} avg</div>}
      </div>
      <Icon icon="solar:square-top-down-linear" size={17} color="var(--text-tertiary)" />
    </button>
  );
}
