import Icon from './Icon.jsx';
import { Cover, FetchButton, StatusBadge, FrozenBadge, OriginBadges, TagChip, fmtWords } from './ui.jsx';
import { COVER_PALETTES } from '../data/sample.js';
import { pickCardTags } from '../lib/cardtags.js';

// ---- Library list card (horizontal) --------------------------------------
export function LibraryCard({ work, onOpen, onDelete }) {
  return (
    <div className="libcard pressable" onClick={() => onOpen && onOpen(work)} style={{ position: 'relative' }}>
      {onDelete && (
        <button className="iconbtn ghost" aria-label="Remove from library" title="Remove from library"
          onClick={(e) => { e.stopPropagation(); onDelete(work); }}
          style={{ position: 'absolute', top: 8, right: 8, width: 30, height: 30, zIndex: 2 }}>
          <Icon icon="solar:close-circle-linear" size={19} color="var(--text-tertiary)" />
        </button>
      )}
      <div className="meta">
        <div className="story-title" style={{ marginBottom: 2, paddingRight: onDelete ? 30 : 0 }}>{work.customTitle || work.title}</div>
        <div className="story-sub" style={{ marginBottom: 7 }}>by {work.author}</div>
        <div className="chiprow" style={{ marginBottom: 8, alignItems: 'center' }}>
          {work.frozen ? <FrozenBadge /> : <StatusBadge status={work.status} updated={work.updated} />}
          {work.words ? <span style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text-tertiary)' }}>· {fmtWords(work.words)}</span> : null}
          <OriginBadges bookmarked={work.bookmarked} subscribed={work.subscribed} />
        </div>
        <div className="summary" style={{ flex: 1 }}>{work.summary}</div>
        {(work.tags && work.tags.length) ? (
          <div className="chiprow" style={{ marginTop: 8, gap: 6 }}>
            {work.tags.slice(0, 3).map((t, i) => (
              <TagChip key={i} t={typeof t === 'string' ? t : t.t} k={typeof t === 'string' ? undefined : t.k} />
            ))}
          </div>
        ) : null}
        {(work.offline === false || work.progress >= 1 || work.progress > 0) && (
          <div style={{ marginTop: 9 }}>
            {work.offline === false ? (
              <div className="metarow" style={{ color: 'var(--text-tertiary)' }}><Icon icon="solar:clock-circle-linear" size={14} /><span>Downloads on next sync</span></div>
            ) : work.progress >= 1 ? (
              <div className="metarow"><Icon icon="solar:check-circle-bold" size={14} color="var(--success)" /><span>Finished</span></div>
            ) : (
              <>
                <div className="progress" style={{ marginBottom: 5 }}><i style={{ width: `${work.progress * 100}%` }}></i></div>
                <div className="metarow"><span>Chapter {work.lastChapter} of {work.chaptersTotal}</span><span>·</span><span>{Math.round(work.progress * 100)}%</span></div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ---- Library grid card (cover-forward) ------------------------------------
export function GridCard({ work, onOpen }) {
  return (
    <div className="gridcard pressable" onClick={() => onOpen && onOpen(work)}>
      <div style={{ position: 'relative' }}>
        <Cover title={work.title} author={work.author} fandom={work.fandom} palette={work.palette}
          w={'100%'} h={210} style={{ width: '100%' }} />
        {work.frozen && <div style={{ position: 'absolute', top: 8, left: 8 }}><FrozenBadge /></div>}
        {work.unread && <div style={{ position: 'absolute', top: 8, right: 8, width: 9, height: 9, borderRadius: '50%', background: 'var(--accent)', boxShadow: '0 0 0 2px rgba(0,0,0,.25)' }}></div>}
      </div>
      <div>
        {work.progress > 0 && work.progress < 1 && <div className="progress" style={{ marginBottom: 6 }}><i style={{ width: `${work.progress * 100}%` }}></i></div>}
        <div className="metarow" style={{ justifyContent: 'space-between' }}>
          {work.offline === false ? (
            <span style={{ color: 'var(--text-tertiary)', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <Icon icon="solar:clock-circle-linear" size={13} /> Queued
            </span>
          ) : (
            <span style={{ color: work.status === 'complete' ? 'var(--success)' : 'var(--warning)', fontWeight: 600 }}>
              {work.progress >= 1 ? 'Finished' : work.progress > 0 ? `Ch ${work.lastChapter}/${work.chaptersTotal}` : work.status === 'complete' ? 'Complete' : 'Ongoing'}
            </span>
          )}
          <span>{fmtWords(work.words)}</span>
        </div>
      </div>
    </div>
  );
}

// ---- Suggestion card (+ save / dismiss) -----------------------------------
// saveState: 'idle' → 'queued' (worker will fetch on next sync) → 'saved' (in library)
export function SuggestionCard({ work, onSave, saveState = 'idle', onDismiss, onOpen, cta = 'Open', onLater, laterIcon = 'solar:bookmark-linear', laterTitle = 'Save for later', excludeTags = [] }) {
  return (
    <div className="libcard fade-enter">
      <div className="meta">
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
          <div style={{ flex: 1, minWidth: 0, cursor: 'pointer' }} onClick={() => onOpen && onOpen(work)}>
            <div className="story-title" style={{ marginBottom: 2 }}>{work.title}</div>
            <div className="story-sub">by {work.author}</div>
          </div>
          <button className="iconbtn" style={{ width: 30, height: 30, marginRight: -4, marginTop: -2 }} onClick={onDismiss} aria-label="Dismiss">
            <Icon icon="solar:close-circle-linear" size={20} color="var(--text-tertiary)" />
          </button>
        </div>
        <div className="summary" style={{ margin: '7px 0' }}>{work.summary}</div>
        <div className="chiprow" style={{ marginBottom: 9 }}>
          {pickCardTags(work.tags, excludeTags).map((t, i) => <TagChip key={i} t={t.t} k={t.k} />)}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <div className="metarow"><StatusBadge status={work.status} /><span>·</span><span>{fmtWords(work.words)}</span></div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {onLater && (
            <button className="iconbtn ghost" onClick={() => onLater(work)} aria-label={laterTitle} title={laterTitle}
              style={{ width: 36, height: 32, background: 'var(--surface-2)', borderRadius: 'var(--radius-md)', flex: 'none' }}>
              <Icon icon={laterIcon} size={18} />
            </button>
          )}
          {onSave ? (
            <button
              className={`btn btn-sm ${saveState === 'idle' ? 'btn-primary' : 'btn-flat'}`}
              onClick={() => saveState === 'idle' && onSave(work)}
              disabled={saveState !== 'idle'}
              style={{ minWidth: 104 }}
              title={saveState === 'queued' ? 'Downloading — sync started' : undefined}
            >
              {saveState === 'saved' ? <><Icon icon="solar:check-read-linear" size={16} /> In library</>
                : saveState === 'queued' ? <><Icon icon="solar:clock-circle-linear" size={16} /> Queued</>
                : <><Icon icon="solar:download-minimalistic-linear" size={16} /> Save</>}
            </button>
          ) : (
            <button className="btn btn-sm btn-flat" onClick={() => onOpen && onOpen(work)} style={{ minWidth: 92 }}>
              <Icon icon="solar:arrow-right-linear" size={16} /> {cta}
            </button>
          )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ---- Tag tile (discovery grid) --------------------------------------------
export function TagTile({ tag, onOpen }) {
  const pal = COVER_PALETTES[tag.palette] || COVER_PALETTES[0];
  const kindLabel = { relationship: 'Relationship', fandom: 'Fandom', freeform: 'Tag', character: 'Character', group: 'Tag group', language: 'Language' }[tag.kind] || 'Tag';
  return (
    <div className="tile pressable" onClick={() => onOpen && onOpen(tag)} style={{ background: `linear-gradient(150deg, ${pal[0]}, ${pal[1]})` }}>
      <div className="grain"></div>
      {tag.fresh > 0 && <div className="t-new"><span style={{ width: 6, height: 6, borderRadius: '50%', background: '#fff' }}></span>{tag.fresh} new</div>}
      <div style={{ position: 'relative', zIndex: 1 }}>
        <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase', opacity: .85 }}>{kindLabel}</div>
      </div>
      <div style={{ position: 'relative', zIndex: 1 }}>
        <div className="t-name">{tag.name}</div>
        <div className="t-count" style={{ marginTop: 5 }}>{tag.count} works tracked</div>
      </div>
    </div>
  );
}

// ---- Chapter row (TOC, with fetch state) ----------------------------------
export function ChapterRow({ ch, current, onOpen, onFetch, fetchState }) {
  const state = fetchState || ch.state;
  return (
    <div className={`chrow pressable ${current ? 'current' : ''}`} onClick={() => state === 'done' && onOpen && onOpen(ch)}>
      <div className="chnum">{current ? <Icon icon="solar:bookmark-bold" size={16} color="var(--accent)" /> : ch.n}</div>
      <div className="chmeta">
        <div className="chtitle">{ch.title}</div>
        <div className="chsub">{fmtWords(ch.words)}{state === 'failed' ? ' · fetch failed' : state === 'idle' ? ' · not downloaded' : ''}</div>
      </div>
      <FetchButton state={state} onClick={(e) => { e.stopPropagation(); onFetch && onFetch(ch); }} />
    </div>
  );
}
