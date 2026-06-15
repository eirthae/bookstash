import { useState, useEffect } from 'react';
import { Appbar } from '../components/chrome.jsx';
import Icon from '../components/Icon.jsx';
import { StatusBadge, fmtWords, useToast, PullToRefresh } from '../components/ui.jsx';
import { fetchNewChapters, markChapterUpdateSeen } from '../lib/tags.js';
import { fetchSavedWorks } from '../lib/library.js';
import { triggerSync } from '../lib/sync.js';
import { savedTypeOf } from '../lib/shelving.js';

const SAVED_TYPES = [{ id: 'all', label: 'All' }, { id: 'ao3', label: 'AO3' }, { id: 'stories', label: 'Stories' }, { id: 'books', label: 'Books' }];

// shared row: a new chapter on a followed work
function ChapterUpdateRow({ u, onOpen }) {
  const fandom = (u.fandom || '').split('–')[0].split(' - ')[0].trim();
  return (
    <div className="update pressable" onClick={() => onOpen(u)}>
      {u.fresh && <span className="unew"></span>}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3, paddingLeft: 4 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <span className="chip" style={{ background: 'var(--accent-soft)', color: 'var(--accent)', height: 20 }}>
            <Icon icon="solar:bookmark-bold" size={12} /> New chapter</span>
          <span style={{ fontSize: 11, color: 'var(--text-tertiary)', marginLeft: 'auto' }}>{u.time}</span>
        </div>
        <div className="story-title" style={{ fontSize: 14.5 }}>{u.chapter}</div>
        <div className="story-sub" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.title}</div>
        {fandom && <div className="metarow" style={{ fontSize: 11.5 }}><Icon icon="solar:book-2-linear" size={13} /> {fandom} · {fmtWords(u.words)}</div>}
        {u.fetched === false ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2, fontSize: 11.5, color: 'var(--text-tertiary)', fontWeight: 600 }}>
            <Icon icon="solar:clock-circle-linear" size={13} /> Downloads on next sync
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2, fontSize: 11.5, color: 'var(--success)', fontWeight: 600 }}>
            <Icon icon="solar:check-circle-bold" size={13} /> Downloaded · ready to read
          </div>
        )}
      </div>
    </div>
  );
}

// shared row: a work you SAVED from Discovery, now downloaded and ready.
const SAVED_TYPE_LABEL = { ao3: 'AO3', stories: 'Story', books: 'Book' };
function SavedWorkRow({ w, onOpen }) {
  const fandom = (w.fandom || '').split('–')[0].split(' - ')[0].trim();
  const type = savedTypeOf(w);
  return (
    <div className="update pressable" onClick={() => onOpen(w)}>
      {w.fresh && <span className="unew"></span>}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3, paddingLeft: 4 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <span className="chip" style={{ background: 'var(--accent-soft)', color: 'var(--accent)', height: 20 }}>
            <Icon icon="solar:bookmark-bold" size={12} /> {SAVED_TYPE_LABEL[type] || 'Saved'}</span>
          <span style={{ fontSize: 11, color: 'var(--text-tertiary)', marginLeft: 'auto' }}>{w.time}</span>
        </div>
        <div className="story-title" style={{ fontSize: 14.5 }}>{w.customTitle || w.title}</div>
        <div className="story-sub" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>by {w.author}</div>
        {w.summary && <div className="summary" style={{ WebkitLineClamp: 2 }}>{w.summary}</div>}
        {fandom && <div className="metarow" style={{ fontSize: 11.5 }}><Icon icon="solar:book-2-linear" size={13} /> {fandom}</div>}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
          <div className="metarow"><StatusBadge status={w.status} /><span>·</span><span>{fmtWords(w.words)}</span></div>
          <span style={{ display: 'flex', alignItems: 'center', gap: 5, marginLeft: 'auto', fontSize: 11.5, color: 'var(--success)', fontWeight: 600 }}>
            <Icon icon="solar:check-circle-bold" size={13} /> Ready to read
          </span>
        </div>
      </div>
    </div>
  );
}

export function WhatsNewScreen({ chapters, nav }) {
  const [tab, setTab] = useState('chapters');
  const [typeFilter, setTypeFilter] = useState('all'); // all | ao3 | stories | books
  const [toast] = useToast();
  const [bump, setBump] = useState(0); // re-fetch trigger (pull-to-refresh)

  // Live new-chapter feed (real, downloaded chapters); fall back to sample.
  const [liveChapters, setLiveChapters] = useState(null);
  useEffect(() => {
    let alive = true;
    fetchNewChapters()
      .then((r) => { if (alive) setLiveChapters(r ?? chapters); })
      .catch(() => { if (alive) setLiveChapters(chapters); });
    return () => { alive = false; };
  }, [chapters, bump]);
  const chapterList = liveChapters || chapters;

  // "Saved" feed: works you saved from Discovery that are now downloaded.
  const [savedWorks, setSavedWorks] = useState(null);
  useEffect(() => {
    let alive = true;
    fetchSavedWorks()
      .then((r) => { if (alive) setSavedWorks(r ?? []); })
      .catch(() => { if (alive) setSavedWorks([]); });
    return () => { alive = false; };
  }, [bump]);
  const savedList = savedWorks || [];

  // Pull-to-refresh: kick a sync, then re-fetch both feeds.
  const doSync = async () => { try { await triggerSync(); } finally { setBump((b) => b + 1); } };

  const openChapter = (u) => {
    markChapterUpdateSeen(u.id).catch(() => {});
    nav.push('reader', { work: u.work, workId: u.workId, chapterN: u.chapterN, chapterTitle: u.chapter });
  };
  const openSaved = (w) => nav.push('reader', { work: w });

  const typeCount = (id) => id === 'all' ? savedList.length : savedList.filter((w) => savedTypeOf(w) === id).length;
  const filteredSaved = typeFilter === 'all' ? savedList : savedList.filter((w) => savedTypeOf(w) === typeFilter);

  const days = (arr) => {
    const order = ['Today', 'Yesterday', 'This week'];
    const groups = {}; arr.forEach(u => { (groups[u.day] = groups[u.day] || []).push(u); });
    return order.filter(d => groups[d]).map(d => ({ day: d, items: groups[d] }));
  };

  const active = tab === 'chapters' ? chapterList : filteredSaved;
  return (
    <div className="screen">
      <Appbar large title="What's New" sub={`${chapterList.length + savedList.length} updates`} />
      <div className="wn-seg" style={{ marginBottom: 16 }}>
        <button className={tab === 'chapters' ? 'on' : ''} onClick={() => setTab('chapters')}>
          New chapters <span className="pill">{chapterList.length}</span>
        </button>
        <button className={tab === 'saved' ? 'on' : ''} onClick={() => setTab('saved')}>
          Saved <span className="pill">{savedList.length}</span>
        </button>
      </div>
      <PullToRefresh className="scroll fade-enter" key={tab} onRefresh={doSync} style={{ padding: '0 20px 24px' }}>
        <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
          <Icon icon={tab === 'chapters' ? 'solar:download-minimalistic-linear' : 'solar:bookmark-bold'} size={14} />
          {tab === 'chapters' ? 'On works you follow — downloaded automatically.' : 'Works you saved from Discovery — downloaded and ready to read.'}
        </div>

        {tab === 'saved' && savedList.length > 0 && (
          <div className="seg statusseg" style={{ marginBottom: 14 }}>
            {SAVED_TYPES.map((t) => (
              <button key={t.id} className={typeFilter === t.id ? 'on' : ''} onClick={() => setTypeFilter(t.id)}>
                {t.label}{typeFilter === t.id ? ` · ${typeCount(t.id)}` : ''}
              </button>
            ))}
          </div>
        )}

        {active.length === 0 && (
          <div style={{ padding: '28px 8px', textAlign: 'center', fontSize: 13, lineHeight: 1.55, color: 'var(--text-tertiary)' }}>
            {tab === 'chapters'
              ? 'No new chapters yet. When a sync pulls fresh chapters for your ongoing works, they show up here — already downloaded.'
              : 'Nothing saved yet. Save a work from Discovery and it lands here once it’s downloaded.'}
          </div>
        )}
        {days(active).map(g => (
          <div key={g.day} style={{ marginBottom: 18 }}>
            <div className="daygroup" style={{ marginBottom: 10 }}>{g.day}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
              {g.items.map(u => tab === 'chapters'
                ? <ChapterUpdateRow key={u.id} u={u} onOpen={openChapter} />
                : <SavedWorkRow key={u.id} w={u} onOpen={openSaved} />)}
            </div>
          </div>
        ))}
        {toast}
      </PullToRefresh>
    </div>
  );
}
