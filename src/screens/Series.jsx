import { useState, useEffect } from 'react';
import { Appbar } from '../components/chrome.jsx';
import Icon from '../components/Icon.jsx';
import { useToast } from '../components/ui.jsx';
import { LibraryCard } from '../components/cards.jsx';
import { fetchSeriesWorks } from '../lib/library.js';
import { getSeriesFollow, requestSeriesDownload, setSeriesFollow } from '../lib/series.js';

// A single AO3 series: every downloaded work in reading order, plus the
// download-all / follow actions. Reached by tapping a series name in the library
// (a series card), a work's detail page, or the reader.
export function SeriesScreen({ seriesId, seriesName, nav, onReload }) {
  const [works, setWorks] = useState(null); // null = loading
  const [follow, setFollow] = useState(null); // followed_series row or null
  const [queued, setQueued] = useState(false); // a download-all/follow row exists (works arrive each sync)
  const [busy, setBusy] = useState(false);
  const [toast, showToast] = useToast();

  useEffect(() => {
    let alive = true;
    fetchSeriesWorks(seriesId).then((r) => { if (alive) setWorks(r || []); }).catch(() => { if (alive) setWorks([]); });
    getSeriesFollow(seriesId).then((r) => { if (alive) { setFollow(r); setQueued(!!r); } }).catch(() => {});
    return () => { alive = false; };
  }, [seriesId]);

  const open = (w) => nav.push('detail', { work: w, onReload });
  const name = seriesName || (works && works[0] && works[0].ao3SeriesName) || 'AO3 series';
  const count = works ? works.length : 0;
  const following = !!(follow && follow.follow);

  const downloadAll = async () => {
    if (busy) return; setBusy(true);
    const res = await requestSeriesDownload(seriesId, name);
    setBusy(false);
    if (res.ok) { setFollow({ seriesId, seriesName: name, follow: true }); setQueued(true); showToast('Downloading the whole series — works arrive each sync', 'solar:check-circle-bold'); }
    else showToast(res.error || 'Couldn’t queue the series', 'solar:danger-triangle-linear');
  };
  const toggleFollow = async () => {
    if (busy) return; setBusy(true);
    const next = !following;
    const res = await setSeriesFollow(seriesId, name, next);
    setBusy(false);
    if (res.ok) { setFollow(next ? { seriesId, seriesName: name, follow: true } : null); if (next) setQueued(true); showToast(next ? 'Following series — new works download automatically' : 'Unfollowed series', next ? 'solar:bell-bold' : 'solar:bell-off-linear'); }
    else showToast(res.error || 'Couldn’t update', 'solar:danger-triangle-linear');
  };

  return (
    <div className="screen">
      <Appbar large title={name} sub={`${count} work${count === 1 ? '' : 's'} downloaded`} back={() => nav.pop()} />
      {toast}
      <div className="scroll" style={{ padding: '0 20px 24px' }}>
        <div style={{ display: 'flex', gap: 4, marginBottom: 18, marginLeft: -10 }}>
          <button className={`btn btn-text ${queued ? 'is-done' : ''}`} style={{ flex: 'none' }} disabled={busy || queued} onClick={downloadAll}>
            <Icon icon={queued ? 'solar:check-circle-bold' : busy ? 'solar:refresh-linear' : 'solar:download-minimalistic-bold'} size={18} /> {queued ? 'Downloading' : busy ? 'Queueing…' : 'Download all'}
          </button>
          <button className={`btn btn-text ${following ? 'is-done' : ''}`} style={{ flex: 'none' }} disabled={busy} onClick={toggleFollow}>
            <Icon icon={following ? 'solar:bell-bing-bold' : 'solar:bell-linear'} size={18} /> {following ? 'Following' : 'Follow'}
          </button>
        </div>

        {works === null ? (
          <div style={{ color: 'var(--text-tertiary)', fontSize: 13, padding: '8px 2px' }}>Loading…</div>
        ) : works.length === 0 ? (
          <div style={{ padding: '24px 8px', textAlign: 'center', fontSize: 13, lineHeight: 1.55, color: 'var(--text-tertiary)' }}>
            No works from this series are downloaded yet. Tap “Download all” to fetch them — they arrive on the next sync.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
            {works.map((w) => (
              <div key={w.id} style={{ position: 'relative' }}>
                {w.ao3SeriesIndex != null && (
                  <div className="series-part-badge">#{Number.isInteger(w.ao3SeriesIndex) ? w.ao3SeriesIndex : Math.round(w.ao3SeriesIndex)}</div>
                )}
                <LibraryCard work={w} onOpen={open} onDelete={() => {}} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
