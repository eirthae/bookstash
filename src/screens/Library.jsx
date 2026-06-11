import { Fragment, useRef, useState } from 'react';
import Icon from '../components/Icon.jsx';
import { sortWorks, groupBySeries } from '../lib/db.js';
import { importFiles, importLink, summarize } from '../lib/import.js';

// The library: a list of on-device books + a multi-file (bulk) importer. Tapping
// a book opens the reader. No network, no accounts.
const SORTS = [
  { id: 'added', label: 'Last added' },
  { id: 'title', label: 'A–Z' },
  { id: 'author', label: 'Author' },
];

export function LibraryScreen({ works, onReload, onOpen }) {
  const fileInput = useRef(null);
  const [busy, setBusy] = useState(null);   // { done, total, current } while importing
  const [notice, setNotice] = useState(''); // result summary
  const [sort, setSort] = useState('added');
  const [addOpen, setAddOpen] = useState(false); // the Add sheet (upload / link)

  const pick = () => { if (!busy && fileInput.current) fileInput.current.click(); };
  // Add by link: fetch + extract on-device, store as a 1-chapter work. Returns
  // the per-attempt result so the sheet can show inline error / restricted notes.
  const addLink = async (url) => {
    const res = await importLink(url);
    if (res.ok) {
      onReload();
      setNotice('Added — saved offline.');
      setTimeout(() => setNotice(''), 4500);
    }
    return res;
  };
  const onFiles = async (e) => {
    const files = e.target.files; e.target.value = '';
    if (!files || !files.length) return;
    setNotice('');
    setBusy({ done: 0, total: files.length });
    const results = await importFiles(files, setBusy);
    setBusy(null);
    const s = summarize(results);
    setNotice(`${s.added} added${s.failed ? ` · ${s.failed} skipped` : ''}`);
    onReload();
    setTimeout(() => setNotice(''), 4500);
  };

  const sorted = works ? sortWorks(works, sort) : null;

  return (
    <div className="screen">
      <input ref={fileInput} type="file" accept=".epub,.html,.htm,.txt" multiple style={{ display: 'none' }} onChange={onFiles} />
      <div className="appbar" style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
        <div>
          <div className="title">Library</div>
          <div className="sub">{works ? `${works.length} book${works.length === 1 ? '' : 's'} · on this device` : '…'}</div>
        </div>
        <button className="iconbtn-lg" onClick={() => setAddOpen(true)} disabled={!!busy} aria-label="Add to library">
          <Icon icon="solar:add-circle-bold" size={32} color="var(--accent)" />
        </button>
      </div>

      {busy && <div className="importbar"><span className="spin" /> Importing {busy.done}/{busy.total}{busy.current ? ` — ${busy.current}` : ''}…</div>}
      {notice && <div className="notice">{notice}</div>}

      {sorted && sorted.length > 0 && (
        <div className="sortseg">
          {SORTS.map((s) => (
            <button key={s.id} className={sort === s.id ? 'on' : ''} onClick={() => setSort(s.id)}>{s.label}</button>
          ))}
        </div>
      )}

      <div className="scroll" style={{ padding: '4px 16px 24px' }}>
        {sorted === null ? (
          <div style={{ color: 'var(--text-tertiary)', fontSize: 13, padding: '10px 4px' }}>Loading…</div>
        ) : sorted.length === 0 ? (
          <EmptyLibrary onPick={pick} />
        ) : (
          <BookList works={sorted} onOpen={onOpen} />
        )}
      </div>

      {addOpen && <AddSheet onClose={() => setAddOpen(false)} onUpload={() => { setAddOpen(false); pick(); }} onAddLink={addLink} />}
    </div>
  );
}

// Add to library: upload files, or add by link (fetched + extracted on-device).
function AddSheet({ onClose, onUpload, onAddLink }) {
  const [url, setUrl] = useState('');
  const [state, setState] = useState({ kind: 'idle' }); // idle | busy | error | restricted | ok

  const submit = async () => {
    const u = url.trim();
    if (!u || state.kind === 'busy') return;
    setState({ kind: 'busy' });
    const res = await onAddLink(u);
    if (res.ok) { setUrl(''); setState({ kind: 'ok' }); setTimeout(onClose, 700); }
    else if (res.restricted) setState({ kind: 'restricted', url: res.url, msg: res.error });
    else setState({ kind: 'error', msg: res.error });
  };

  return (
    <>
      <div className="bs-sheet-backdrop" onClick={onClose} />
      <div className="bs-sheet">
        <div className="bs-sheet-title">Add to library</div>

        <button className="add-row pressable" onClick={onUpload}>
          <Icon icon="solar:upload-minimalistic-bold" size={20} color="var(--accent)" />
          <div><b>Upload files</b><span>EPUB, HTML or TXT — pick many at once</span></div>
        </button>

        <div className="add-or"><span>or add by link</span></div>

        <div className="searchfield" style={{ marginBottom: 10 }}>
          <Icon icon="solar:link-linear" size={18} color="var(--text-tertiary)" />
          <input placeholder="Paste a fic or article URL" value={url}
            onChange={(e) => { setUrl(e.target.value); if (state.kind !== 'busy') setState({ kind: 'idle' }); }}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
            autoCapitalize="off" autoCorrect="off" spellCheck={false} inputMode="url" />
        </div>

        {state.kind === 'error' && <div className="add-note err">{state.msg}</div>}
        {state.kind === 'restricted' && (
          <div className="add-note warn">
            🔒 {state.msg}
            <button className="linklike" onClick={() => { try { window.open(state.url, '_blank', 'noopener'); } catch (e) {} }}>Open on AO3</button>
          </div>
        )}
        {state.kind === 'ok' && <div className="add-note ok">Added — saved offline.</div>}

        <button className="btn btn-primary" style={{ width: '100%' }} disabled={state.kind === 'busy' || !url.trim()} onClick={submit}>
          {state.kind === 'busy' ? <><span className="spin" /> Fetching…</> : <><Icon icon="solar:download-minimalistic-bold" size={18} /> Add link</>}
        </button>
        <div style={{ fontSize: 11.5, color: 'var(--text-tertiary)', textAlign: 'center', marginTop: 10, lineHeight: 1.5 }}>
          Fetched on this device and saved offline. Articles &amp; single-page works read best for now.
        </div>
      </div>
    </>
  );
}

// The shelf: books that share a series cluster under a series header (ordered by
// part); standalone books list below. Falls back to a plain list when nothing
// has series metadata.
function BookList({ works, onOpen }) {
  const { seriesGroups, loose } = groupBySeries(works);
  if (seriesGroups.length === 0) {
    return <div className="booklist">{works.map((w) => <BookCard key={w.id} w={w} onClick={() => onOpen(w)} />)}</div>;
  }
  return (
    <div className="booklist">
      {seriesGroups.map((g) => (
        <Fragment key={g.name}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '12px 2px 6px', fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)' }}>
            <Icon icon="solar:bookmark-square-bold" size={16} color="var(--accent)" />
            <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{g.name}</span>
            <span style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text-tertiary)' }}>{g.items.length}</span>
          </div>
          {g.items.map((w) => <BookCard key={w.id} w={w} onClick={() => onOpen(w)} />)}
        </Fragment>
      ))}
      {loose.map((w) => <BookCard key={w.id} w={w} onClick={() => onOpen(w)} />)}
    </div>
  );
}

function BookCard({ w, onClick }) {
  const initials = (w.title || '?').trim().slice(0, 1).toUpperCase();
  return (
    <button className="bookcard pressable" onClick={onClick}>
      <div className="bk-cover">{initials}</div>
      <div className="bk-meta">
        <div className="bk-title">{w.title || 'Untitled'}</div>
        {w.author && <div className="bk-author">{w.author}</div>}
        <div className="bk-sub">
          {w.chapters} ch{w.words ? ` · ${fmtWords(w.words)}` : ''}{w.series ? ` · ${w.series}` : ''}
        </div>
      </div>
      <Icon icon="solar:alt-arrow-right-linear" size={18} color="var(--text-tertiary)" />
    </button>
  );
}

function EmptyLibrary({ onPick }) {
  return (
    <div className="empty">
      <div className="e-ic"><Icon icon="solar:book-2-bold" size={30} /></div>
      <div className="e-t">Your shelf is empty</div>
      <div className="e-d">Import your EPUB, HTML or TXT files — pick as many as you like at once. They’re parsed and stored on this device.</div>
      <button className="btn btn-primary" onClick={onPick} style={{ marginTop: 6 }}>
        <Icon icon="solar:upload-minimalistic-bold" size={18} /> Import books
      </button>
    </div>
  );
}

function fmtWords(n) {
  if (!n) return '0 words';
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k words`;
  return `${n} words`;
}
