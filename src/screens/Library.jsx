import { Fragment, useState } from 'react';
import Icon from '../components/Icon.jsx';
import { Appbar } from '../components/chrome.jsx';
import { sortWorks, groupBySeries } from '../lib/db.js';

// The library: a list of on-device books, auto-grouped by series. Tapping a book
// opens the reader. Adding happens through the bottom-nav "+" (AddMenu). No
// network, no accounts.
const SORTS = [
  { id: 'added', label: 'Last added' },
  { id: 'title', label: 'A–Z' },
  { id: 'author', label: 'Author' },
];

export function LibraryScreen({ works, onOpen, onAdd, notice }) {
  const [sort, setSort] = useState('added');
  const sorted = works ? sortWorks(works, sort) : null;

  return (
    <div className="screen">
      <Appbar large title="Library"
        sub={works ? `${works.length} book${works.length === 1 ? '' : 's'} · on this device` : '…'} />

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
          <EmptyLibrary onPick={onAdd} />
        ) : (
          <BookList works={sorted} onOpen={onOpen} />
        )}
      </div>
    </div>
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
