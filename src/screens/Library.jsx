import { useRef, useState } from 'react';
import Icon from '../components/Icon.jsx';
import { sortWorks } from '../lib/db.js';
import { importFiles, summarize } from '../lib/import.js';

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

  const pick = () => { if (!busy && fileInput.current) fileInput.current.click(); };
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
        <button className="iconbtn-lg" onClick={pick} disabled={!!busy} aria-label="Add books">
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
          <div className="booklist">
            {sorted.map((w) => <BookCard key={w.id} w={w} onClick={() => onOpen(w)} />)}
          </div>
        )}
      </div>
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
