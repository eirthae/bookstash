import { useState, useEffect, useRef } from 'react';
import Icon from './Icon.jsx';
import { COVER_PALETTES, paletteFor } from '../data/sample.js';

// Pull-to-refresh scroll container (BookStash on-device sync). Pull down past a
// threshold while at the top → calls onRefresh (the sync). Native feel: the
// whole page glides down with your finger to reveal the spinner above it, then
// springs back on release — so the indicator can never overlap the shelf tabs.
export function PullToRefresh({ onRefresh, children, className = 'scroll', style }) {
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [dragging, setDragging] = useState(false);
  const startY = useRef(null);
  const ref = useRef(null);
  const THRESHOLD = 64;
  const onTouchStart = (e) => {
    if (ref.current && ref.current.scrollTop <= 0 && !refreshing) {
      startY.current = e.touches[0].clientY; setDragging(true);
    } else startY.current = null;
  };
  const onTouchMove = (e) => {
    if (startY.current == null) return;
    const dy = e.touches[0].clientY - startY.current;
    if (dy > 0 && ref.current.scrollTop <= 0) setPull(Math.min(dy * 0.5, 90));
    else if (dy <= 0) { startY.current = null; setPull(0); setDragging(false); }
  };
  const onTouchEnd = async () => {
    const go = startY.current != null && pull >= THRESHOLD && !refreshing;
    startY.current = null; setDragging(false);
    if (go) { setRefreshing(true); setPull(0); try { await onRefresh?.(); } finally { setRefreshing(false); } }
    else setPull(0);
  };
  // How far the page is pushed down (and the spinner gap above it).
  const offset = refreshing ? 48 : pull;
  return (
    <div className={className} ref={ref} style={{ position: 'relative', ...style }}
      onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
      {/* Spinner lives in the revealed gap at the very top, BEHIND the page. */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: Math.max(offset, 0),
        display: 'flex', justifyContent: 'center', alignItems: 'center', color: 'var(--accent)',
        fontSize: 12, fontWeight: 600, gap: 7, pointerEvents: 'none', zIndex: 0, overflow: 'hidden',
        opacity: offset > 0 ? 1 : 0 }}>
        {refreshing
          ? <><span className="spin" /> Syncing…</>
          : <><Icon icon="solar:arrow-down-linear" size={17} style={{ transform: pull >= THRESHOLD ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }} /> {pull >= THRESHOLD ? 'Release to sync' : 'Pull to sync'}</>}
      </div>
      {/* The page itself glides down over the spinner, then springs back. */}
      <div style={{ transform: `translateY(${offset}px)`, position: 'relative', zIndex: 1,
        background: 'var(--surface)', minHeight: '100%',
        transition: dragging ? 'none' : 'transform .34s cubic-bezier(.2,.85,.25,1)' }}>
        {children}
      </div>
    </div>
  );
}

export const TAG_COLOR = {
  fandom: 'var(--tag-fandom)', relationship: 'var(--tag-relationship)',
  character: 'var(--tag-character)', freeform: 'var(--tag-freeform)', warning: 'var(--tag-warning)',
};

export function TagChip({ t, k = 'freeform', onClick }) {
  const c = TAG_COLOR[k] || TAG_COLOR.freeform;
  const style = { background: `color-mix(in srgb, ${c} 16%, transparent)`, color: c };
  if (onClick) {
    return (
      <button className="chip pressable" style={{ ...style, border: 'none', cursor: 'pointer' }} onClick={onClick}>
        <span className="swatch" style={{ background: c }}></span>{t}
      </button>
    );
  }
  return (
    <span className="chip" style={style}>
      <span className="swatch" style={{ background: c }}></span>{t}
    </span>
  );
}

// ---- Cover fallback (generated typographic, net-new) ----------------------
export function Cover({ title, author, fandom, palette, w = 86, h = 116, big = false, style, variant = 'gradient' }) {
  const pal = typeof palette === 'number' ? (COVER_PALETTES[palette] || COVER_PALETTES[0]) : paletteFor(fandom || title);
  const cs = variant;
  const numW = typeof w === 'number' ? w : 120;
  const titleSize = big ? Math.max(15, Math.min(26, numW * 0.13)) : Math.max(10.5, Math.min(15.5, numW * 0.135));
  const pad = big ? 16 : Math.max(9, numW * 0.11);
  const fl = (fandom || '').split('–')[0].split(' - ')[0].trim();

  let bg, fg = '#fff', ruleBg = 'rgba(255,255,255,.7)', border = 'none', grain = true, fandomColor;
  if (cs === 'gradient') { bg = `linear-gradient(150deg, ${pal[0]}, ${pal[1]})`; }
  else if (cs === 'solid') { bg = pal[0]; ruleBg = pal[1]; }
  else if (cs === 'frame') { bg = '#16161a'; fg = '#ecedee'; border = '1px solid rgba(255,255,255,.14)'; ruleBg = pal[1]; grain = false; fandomColor = pal[1]; }

  return (
    <div className="cover pressable" style={{ width: w, height: h, background: bg, padding: pad, color: fg, border, ...style }}>
      {grain && <div className="grain"></div>}
      {cs === 'frame' && <div style={{ position: 'absolute', inset: 6, border: '1px solid rgba(255,255,255,.1)', borderRadius: 6, pointerEvents: 'none' }}></div>}
      <div style={{ position: 'relative', zIndex: 1 }}>
        <div className="c-fandom" style={{ fontSize: big ? 11 : 8.5, color: fandomColor }}>{fl}</div>
      </div>
      <div style={{ position: 'relative', zIndex: 1 }}>
        <div className="c-rule" style={{ marginBottom: big ? 10 : 6, background: ruleBg, width: cs === 'frame' ? 26 : 22 }}></div>
        <div className="c-title" style={{ fontSize: titleSize, marginBottom: big ? 8 : 5 }}>{title}</div>
        <div className="c-author" style={{ fontSize: big ? 12 : 9.5 }}>by {author}</div>
        {cs === 'frame' && <div style={{ position: 'absolute', bottom: -2, right: 0, width: 7, height: 7, borderRadius: '50%', background: pal[1] }}></div>}
      </div>
    </div>
  );
}

// ---- Fetch-state affordance (net-new: the reinterpreted "lock") -----------
export function FetchButton({ state = 'idle', progress = 0, onClick, size = 34 }) {
  const r = size / 2 - 2.4, circ = 2 * Math.PI * r;
  const icon = { idle: 'solar:download-minimalistic-linear', done: 'solar:check-read-linear', failed: 'solar:restart-linear' }[state];
  return (
    <button className={`fetch ${state}`} style={{ width: size, height: size }} onClick={onClick}
      aria-label={{ idle: 'Download', busy: 'Downloading', done: 'Downloaded', failed: 'Retry' }[state]}>
      {state === 'busy' && (
        <svg className="ring" viewBox={`0 0 ${size} ${size}`}>
          <circle className="track" cx={size / 2} cy={size / 2} r={r}></circle>
          <circle className="bar" cx={size / 2} cy={size / 2} r={r}
            strokeDasharray={circ} strokeDashoffset={circ * (1 - Math.max(0.08, progress))}></circle>
        </svg>
      )}
      {state !== 'busy' && <Icon icon={icon} size={size * 0.5} />}
    </button>
  );
}

export function StatusBadge({ status, updated }) {
  const complete = status === 'complete';
  return (
    <span className="statusbadge" style={{ color: complete ? 'var(--success)' : 'var(--warning)' }}>
      <span className="ic"><Icon icon={complete ? 'solar:check-circle-bold' : 'solar:refresh-circle-bold'} size={14} /></span>
      {complete ? 'Complete' : 'Ongoing'}
      {updated && <span style={{ color: 'var(--text-tertiary)', fontWeight: 500 }}>· {updated}</span>}
    </span>
  );
}

// Reassuring, not an error (brief §5)
export function FrozenBadge({ date, full }) {
  return (
    <span className="frozen" title="Saved copy — no longer on AO3">
      <Icon icon="solar:shield-check-bold" size={13} />
      {full ? 'Saved copy · no longer on AO3' : 'Saved copy'}
      {date && full && <span style={{ opacity: .8, fontWeight: 500 }}>· {date}</span>}
    </span>
  );
}

// Origin chips — where a work entered the library (a work can have several)
export function OriginBadges({ bookmarked, subscribed }) {
  if (!bookmarked && !subscribed) return null;
  return (
    <>
      {bookmarked && (
        <span className="originbadge" style={{ color: 'var(--accent)' }} title="You bookmarked this on AO3">
          <Icon icon="solar:bookmark-bold" size={13} /> Bookmarked
        </span>
      )}
      {subscribed && (
        <span className="originbadge" style={{ color: 'var(--tag-relationship)' }} title="Ongoing — new chapters download on each sync">
          <Icon icon="solar:bell-bold" size={13} /> Following
        </span>
      )}
    </>
  );
}

export function fmtWords(n) {
  return n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k words` : `${n} words`;
}

export function SearchField({ placeholder, value, onChange, onSubmit, onBlur }) {
  return (
    <div className="searchfield">
      <Icon icon="solar:magnifer-linear" size={20} color="var(--text-tertiary)" />
      <input placeholder={placeholder} value={value || ''}
        onChange={e => onChange && onChange(e.target.value)}
        onBlur={() => onBlur && onBlur()}
        onKeyDown={e => e.key === 'Enter' && onSubmit && onSubmit()} />
      {value ? <button className="iconbtn" style={{ width: 28, height: 28 }} onClick={() => onChange('')}>
        <Icon icon="solar:close-circle-bold" size={20} color="var(--text-tertiary)" /></button> : null}
    </div>
  );
}

export function Toggle({ on, onChange }) {
  return <button className={`toggle ${on ? 'on' : ''}`} onClick={() => onChange(!on)}><span className="knob"></span></button>;
}

export function Segmented({ options, value, onChange }) {
  return (
    <div className="seg">
      {options.map(o => {
        const val = typeof o === 'string' ? o : o.value;
        const label = typeof o === 'string' ? o : o.label;
        return (
          <button key={val} className={value === val ? 'on' : ''} onClick={() => onChange(val)}>
            {typeof o !== 'string' && o.icon && <Icon icon={o.icon} size={16} />}{label}
          </button>
        );
      })}
    </div>
  );
}

export function Sheet({ open, onClose, title, children, reader, maxH }) {
  const [mounted, setMounted] = useState(open);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    if (open) { setMounted(true); requestAnimationFrame(() => requestAnimationFrame(() => setShown(true))); }
    else { setShown(false); const t = setTimeout(() => setMounted(false), 320); return () => clearTimeout(t); }
  }, [open]);
  if (!mounted) return null;
  return (
    <>
      <div className={`sheet-scrim ${shown ? 'in' : ''}`} onClick={onClose}></div>
      <div className={`sheet ${reader ? 'reader-sheet' : ''} ${shown ? 'in' : ''}`} style={maxH ? { maxHeight: maxH } : null}>
        <div className="grab"></div>
        {title && <div className="sheet-title">{title}</div>}
        <div className="sheet-body">{children}</div>
      </div>
    </>
  );
}

export function EmptyState({ icon, title, desc, action }) {
  return (
    <div className="empty">
      <div className="e-ic"><Icon icon={icon} size={34} /></div>
      <div className="e-h">{title}</div>
      <div className="e-d">{desc}</div>
      {action && <div style={{ marginTop: 16 }}>{action}</div>}
    </div>
  );
}

export function useToast() {
  const [toast, setToast] = useState(null);
  const show = (msg, icon = 'solar:check-circle-bold') => {
    setToast({ msg, icon });
    clearTimeout(show._t); show._t = setTimeout(() => setToast(null), 2400);
  };
  const node = toast ? (
    <div className="toast"><Icon icon={toast.icon} size={20} color="var(--accent)" /><span>{toast.msg}</span></div>
  ) : null;
  return [node, show];
}
