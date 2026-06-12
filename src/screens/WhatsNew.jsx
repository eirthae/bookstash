import { useState, useEffect } from 'react';
import { Appbar } from '../components/chrome.jsx';
import Icon from '../components/Icon.jsx';
import { StatusBadge, fmtWords, useToast, PullToRefresh } from '../components/ui.jsx';
import { fetchNewMatches, fetchNewChapters, markChapterUpdateSeen, markMatchSeen, dismissMatch, requestSave } from '../lib/tags.js';
import { kickSync, triggerSync } from '../lib/sync.js';

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

// shared row: a new work matching a tracked tag (metadata-first)
function MatchUpdateRow({ u, onOpen, onDismiss, onSave, saveState = 'idle' }) {
  const tagLabel = u.tag || 'Tracked tag';
  const fandom = (u.fandom || '').split('–')[0].split(' - ')[0].trim();
  return (
    <div className="update pressable" onClick={() => onOpen(u)}>
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3, paddingLeft: 4 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <span className="chip" style={{ background: 'color-mix(in srgb, var(--tag-relationship) 16%, transparent)', color: 'var(--tag-relationship)', height: 20 }}>
            <span className="swatch" style={{ background: 'var(--tag-relationship)' }}></span>{tagLabel.length > 22 ? tagLabel.slice(0, 21) + '…' : tagLabel}</span>
          <span style={{ fontSize: 11, color: 'var(--text-tertiary)', marginLeft: 'auto' }}>{u.time}</span>
          <button className="iconbtn" style={{ width: 24, height: 24 }} onClick={(e) => { e.stopPropagation(); onDismiss(u); }} aria-label="Dismiss">
            <Icon icon="solar:close-circle-linear" size={17} color="var(--text-tertiary)" />
          </button>
        </div>
        <div className="story-title" style={{ fontSize: 14.5 }}>{u.title}</div>
        <div className="story-sub" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>by {u.author}</div>
        <div className="summary" style={{ WebkitLineClamp: 2 }}>{u.summary}</div>
        {fandom && <div className="metarow" style={{ fontSize: 11.5 }}><Icon icon="solar:book-2-linear" size={13} /> {fandom}</div>}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
          <div className="metarow"><StatusBadge status={u.status} /><span>·</span><span>{fmtWords(u.words)}</span></div>
          <button
            className={`btn btn-sm ${saveState === 'idle' ? 'btn-primary' : 'btn-flat'}`}
            disabled={saveState !== 'idle'}
            onClick={(e) => { e.stopPropagation(); if (saveState === 'idle') onSave(u); }}
            style={{ minWidth: 100 }}
            title={saveState === 'queued' ? 'Downloading — sync started' : undefined}
          >
            {saveState === 'saved' ? <><Icon icon="solar:check-read-linear" size={15} /> In library</>
              : saveState === 'queued' ? <><Icon icon="solar:clock-circle-linear" size={15} /> Queued</>
              : <><Icon icon="solar:download-minimalistic-linear" size={15} /> Save</>}
          </button>
        </div>
      </div>
    </div>
  );
}

export function WhatsNewScreen({ chapters, matches, nav }) {
  const [tab, setTab] = useState('chapters');
  const [toast, showToast] = useToast();
  const [bump, setBump] = useState(0); // re-fetch trigger (pull-to-refresh)

  // Live matches across all tracked groups; fall back to the passed sample data.
  const [liveMatches, setLiveMatches] = useState(null);
  useEffect(() => {
    let alive = true;
    fetchNewMatches()
      .then((r) => { if (alive) setLiveMatches(r ?? matches); })
      .catch(() => { if (alive) setLiveMatches(matches); });
    return () => { alive = false; };
  }, [matches, bump]);
  const matchList = liveMatches || matches;

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

  // Pull-to-refresh: run the on-device sync (follow-updates + tag discovery),
  // then re-fetch the new-chapters / new-matches feeds.
  const doSync = async () => { try { await triggerSync(); } finally { setBump((b) => b + 1); } };

  const openChapter = (u) => {
    markChapterUpdateSeen(u.id).catch(() => {});
    nav.push('reader', { work: u.work, workId: u.workId, chapterN: u.chapterN, chapterTitle: u.chapter });
  };

  const markWanted = (u, wanted = true) =>
    setLiveMatches((arr) => (arr || matchList).map((x) => (x.id === u.id ? { ...x, wanted } : x)));

  const openMatch = (u) => {
    markMatchSeen(u.matchId || u.id).catch(() => {});
    nav.push('detail', { work: u, suggestion: true, onSaved: () => markWanted(u) });
  };
  const onDismissMatch = (u) => {
    setLiveMatches((arr) => (arr || matchList).filter((x) => x.id !== u.id));
    dismissMatch(u.matchId || u.id).catch(() => {});
    showToast('Dismissed', 'solar:eye-closed-linear');
  };
  const saveMatch = async (u) => {
    markWanted(u, true);
    try {
      await requestSave(u.matchId || u.id);
      kickSync();
      showToast(u.status !== 'complete'
        ? 'Saved — downloading; new chapters arrive on each sync'
        : 'Saved — starting download', 'solar:check-circle-bold');
    } catch {
      markWanted(u, false);
      showToast("Couldn't save — try again", 'solar:danger-triangle-linear');
    }
  };
  const saveStateOf = (u) => (u.saved ? 'saved' : u.wanted ? 'queued' : 'idle');

  const days = (arr) => {
    const order = ['Today', 'Yesterday', 'This week'];
    const groups = {}; arr.forEach(u => { (groups[u.day] = groups[u.day] || []).push(u); });
    return order.filter(d => groups[d]).map(d => ({ day: d, items: groups[d] }));
  };

  const active = tab === 'chapters' ? chapterList : matchList;
  return (
    <div className="screen">
      <Appbar large title="What's New" sub={`${chapterList.length + matchList.length} updates`} />
      <div className="wn-seg" style={{ marginBottom: 16 }}>
        <button className={tab === 'chapters' ? 'on' : ''} onClick={() => setTab('chapters')}>
          New chapters <span className="pill">{chapterList.length}</span>
        </button>
        <button className={tab === 'matches' ? 'on' : ''} onClick={() => setTab('matches')}>
          New matches <span className="pill">{matchList.length}</span>
        </button>
      </div>
      <PullToRefresh className="scroll fade-enter" key={tab} onRefresh={doSync} style={{ padding: '0 20px 24px' }}>
        <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
          <Icon icon={tab === 'chapters' ? 'solar:download-minimalistic-linear' : 'solar:magnifer-linear'} size={14} />
          {tab === 'chapters' ? 'On works you follow — downloaded automatically.' : 'Matching tags you track — tap Save to download.'}
        </div>
        {active.length === 0 && (
          <div style={{ padding: '28px 8px', textAlign: 'center', fontSize: 13, lineHeight: 1.55, color: 'var(--text-tertiary)' }}>
            {tab === 'chapters'
              ? 'No new chapters yet. When a sync pulls fresh chapters for your ongoing works, they show up here — already downloaded.'
              : 'No new tag matches right now. Track tags in Discover and matches will land here.'}
          </div>
        )}
        {days(active).map(g => (
          <div key={g.day} style={{ marginBottom: 18 }}>
            <div className="daygroup" style={{ marginBottom: 10 }}>{g.day}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
              {g.items.map(u => tab === 'chapters'
                ? <ChapterUpdateRow key={u.id} u={u} onOpen={openChapter} />
                : <MatchUpdateRow key={u.id} u={u} onOpen={openMatch} onDismiss={onDismissMatch} onSave={saveMatch} saveState={saveStateOf(u)} />)}
            </div>
          </div>
        ))}
        {toast}
      </PullToRefresh>
    </div>
  );
}
