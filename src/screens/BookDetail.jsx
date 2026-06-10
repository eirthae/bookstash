import { useState } from 'react';
import Icon from '../components/Icon.jsx';
import { deleteWork } from '../lib/db.js';

// Book detail: cover, metadata, summary, and the two actions — Read and Remove.
// Removing deletes the work + its chapters from the on-device database.
export function BookDetailScreen({ work, onBack, onRead, onRemoved }) {
  const [confirming, setConfirming] = useState(false);
  const [removing, setRemoving] = useState(false);

  const remove = async () => {
    if (removing) return;
    setRemoving(true);
    try {
      await deleteWork(work.id);
      onRemoved();
    } catch {
      setRemoving(false);
    }
  };

  const initials = (work.title || '?').trim().slice(0, 1).toUpperCase();
  return (
    <div className="screen">
      <div className="appbar" style={{ display: 'flex', alignItems: 'center', gap: 10, paddingBottom: 8 }}>
        <button className="iconbtn" onClick={onBack}><Icon icon="solar:arrow-left-linear" size={23} /></button>
      </div>
      <div className="scroll" style={{ padding: '4px 20px 28px' }}>
        <div style={{ display: 'flex', gap: 16, marginBottom: 18 }}>
          <div className="bk-cover" style={{ width: 84, height: 112, fontSize: 38, flex: 'none' }}>{initials}</div>
          <div style={{ minWidth: 0, alignSelf: 'center' }}>
            <div style={{ fontFamily: 'var(--font-serif)', fontSize: 21, fontWeight: 700, lineHeight: 1.2 }}>{work.title || 'Untitled'}</div>
            {work.author && <div style={{ fontSize: 13.5, color: 'var(--text-secondary)', marginTop: 4 }}>by {work.author}</div>}
            <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 8 }}>
              {work.chapters} ch{work.words ? ` · ${fmtWords(work.words)}` : ''}{work.series ? ` · ${work.series}` : ''}
            </div>
          </div>
        </div>

        <button className="btn btn-primary" style={{ width: '100%' }} onClick={() => onRead(work)}>
          <Icon icon="solar:book-2-bold" size={19} /> Read
        </button>

        {work.summary && (
          <>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '.06em', margin: '22px 2px 8px' }}>Summary</div>
            <p style={{ fontSize: 14, lineHeight: 1.6, color: 'var(--text-secondary)', margin: 0 }}>{work.summary}</p>
          </>
        )}

        {!confirming ? (
          <button onClick={() => setConfirming(true)}
            style={{ marginTop: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%', height: 46, borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', color: 'var(--danger)', fontSize: 14, fontWeight: 600 }}>
            <Icon icon="solar:trash-bin-trash-linear" size={18} /> Remove from library
          </button>
        ) : (
          <div style={{ marginTop: 28, padding: 14, borderRadius: 'var(--radius-md)', background: 'var(--danger-soft)' }}>
            <div style={{ fontSize: 13.5, color: 'var(--text-primary)', marginBottom: 12 }}>Remove “{work.title}” and its text from this device? This can’t be undone.</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setConfirming(false)} style={{ flex: 1, height: 42, borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', fontWeight: 600, color: 'var(--text-secondary)' }}>Cancel</button>
              <button onClick={remove} disabled={removing} style={{ flex: 1, height: 42, borderRadius: 'var(--radius-md)', background: 'var(--danger)', color: '#fff', fontWeight: 600 }}>
                {removing ? 'Removing…' : 'Remove'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function fmtWords(n) {
  if (!n) return '0 words';
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k words`;
  return `${n} words`;
}
