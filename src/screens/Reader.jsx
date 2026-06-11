import { useState, useEffect, useRef } from 'react';
import Icon from '../components/Icon.jsx';
import { Sheet, fmtWords } from '../components/ui.jsx';
import { WORKS, CHAPTERS, READER_PARAS } from '../data/sample.js';
import { fetchChapters } from '../lib/library.js';
import { hasSupabase } from '../lib/supabase.js';
import { markRead, getReadingPos, getChapterPos, saveReadingPos } from '../lib/reading.js';

export const READER_FONTS = [
  { value: 'serif', label: 'Serif', css: 'var(--font-serif)' },
  { value: 'baskerville', label: 'Baskerville', css: 'var(--font-baskerville)' },
  { value: 'georgia', label: 'Georgia', css: 'var(--font-georgia)' },
  { value: 'beaufort', label: 'Beaufort', css: 'var(--font-beaufort)' },
  { value: 'sans', label: 'Sans', css: 'var(--font-sans)' },
  { value: 'dys', label: 'Dyslexic', css: 'var(--font-dys)' },
];
export const READER_THEMES = [
  { value: 'dark', label: 'Dark', bg: '#121214', fg: '#cfcfd4' },
  { value: 'light', label: 'Light', bg: '#ffffff', fg: '#1f2125' },
  { value: 'sepia', label: 'Sepia', bg: '#f1e7d0', fg: '#4f4334' },
  { value: 'yellow', label: 'Yellow', bg: '#fbf1c4', fg: '#46401f' },
];

// Shimmer placeholder shown while a downloaded chapter's text is being fetched
// (so we never flash the misleading "not downloaded" message on a work we have).
function ChapterSkeleton() {
  const lines = [100, 97, 99, 64, 0, 100, 92, 98, 71, 0, 99, 95, 60];
  return (
    <div className="reader-skel" aria-label="Loading chapter…">
      {lines.map((w, i) => w === 0
        ? <span key={i} className="gap" />
        : <span key={i} style={{ width: w + '%' }} />)}
    </div>
  );
}

export function ReaderScreen({ work: propWork, workId, chapterN = null, chapterTitle, settings, setSettings, nav }) {
  const work = propWork || WORKS.find(w => w.id === workId) || WORKS[0];
  // Stamp this work as just-read (drives the library's "Last read" sort).
  useEffect(() => { markRead(work.id); }, [work.id]);
  // Saved resume position (read once on mount): which chapter + how far down it.
  // An explicit chapterN (e.g. tapped a specific chapter) wins; otherwise resume.
  const savedPos = useRef(getReadingPos(work.id));
  const positionedFor = useRef(null); // the `cur` we've already scrolled into place
  const positioned = useRef(new Set()); // chapters we've already placed this mount
  const saveTimer = useRef(null);
  const [chapters, setChapters] = useState(null); // null until live load resolves
  useEffect(() => {
    let alive = true;
    fetchChapters(work.id)
      .then(r => { if (alive) setChapters(r && r.length ? r : []); })
      .catch(() => { if (alive) setChapters([]); });
    return () => { alive = false; };
  }, [work.id]);

  const hasReal = chapters && chapters.length > 0;
  // Sample prose only renders in the unconnected demo build. When connected,
  // an undownloaded work shows an honest message — never fabricated chapters.
  const demo = !hasSupabase;
  const total = hasReal ? chapters.length
    : demo ? (work.chaptersTotal || work.chapters || CHAPTERS.length)
    : (work.chaptersTotal || work.chapters || 1);
  const [cur, setCur] = useState(chapterN || savedPos.current?.chapter || work.lastChapter || 1);
  const curChapter = hasReal
    ? (chapters.find(c => c.n === cur) || chapters[Math.min(cur, chapters.length) - 1])
    : demo ? (CHAPTERS[Math.min(cur, CHAPTERS.length) - 1] || CHAPTERS[0])
    : null;
  const ch = curChapter || { title: '', words: 0 };
  const [chrome, setChrome] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [showTOC, setShowTOC] = useState(false);
  const scrollRef = useRef(null);
  const [scrollPct, setScrollPct] = useState(0);
  const touch = useRef(null);

  const f = READER_FONTS.find(x => x.value === settings.font) || READER_FONTS[0];

  useEffect(() => { const t = setTimeout(() => setChrome(false), 2200); return () => clearTimeout(t); }, []);
  useEffect(() => () => { if (saveTimer.current) clearTimeout(saveTimer.current); }, []);

  // Position the viewport once per chapter, after its body is in the DOM (so
  // scrollHeight is real). Each chapter restores ITS OWN saved scroll fraction
  // (≈ the paragraph you left off on), so reading ahead and coming back returns
  // you to where you were — not the top. An explicit chapter tap (chapterN)
  // opens that one chapter at the top on the very first placement.
  // Idempotent per `cur` (ref guard) so StrictMode double-invokes and async
  // re-renders can't clobber a restore.
  useEffect(() => {
    if (positionedFor.current === cur) return;
    const contentReady = demo || (hasReal && !!(curChapter && curChapter.content));
    if (!contentReady) return; // wait until the chapter text has rendered
    positionedFor.current = cur;
    const firstPlacement = positioned.current.size === 0;
    positioned.current.add(cur);
    // First placement honours an explicit chapter tap (top); otherwise restore
    // this chapter's own saved scroll position.
    let pct = (firstPlacement && chapterN) ? 0 : getChapterPos(work.id, cur);
    let tries = 0;
    const apply = () => {
      const node = scrollRef.current; if (!node) return;
      const max = node.scrollHeight - node.clientHeight;
      if (pct > 0 && max < 80 && tries < 25) { tries++; setTimeout(apply, 40); return; }
      node.scrollTop = max > 0 ? pct * max : 0;
      setScrollPct(pct);
    };
    setTimeout(apply, 0);
  }, [cur, chapters, hasReal]); // eslint-disable-line react-hooks/exhaustive-deps

  const onScroll = (e) => {
    const el = e.target; const max = el.scrollHeight - el.clientHeight;
    const pct = max > 0 ? Math.min(1, el.scrollTop / max) : 0;
    setScrollPct(pct);
    if (chrome) setChrome(false);
    // Persist where we are (throttled) so reopening resumes here.
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => saveReadingPos(work.id, { chapter: cur, pct }), 350);
  };
  const goCh = (n) => {
    if (n < 1 || n > total) return;
    // Bank where we are in the chapter we're leaving, so returning restores it.
    saveReadingPos(work.id, { chapter: cur, pct: scrollPct });
    // Move the resume pointer to the new chapter without losing any scroll it
    // already had (0 if first visit) — its own restore happens on placement.
    saveReadingPos(work.id, { chapter: n, pct: getChapterPos(work.id, n) });
    setCur(n);
  };

  const onTS = (e) => { touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }; };
  const onTE = (e) => {
    if (!touch.current) return;
    const dx = e.changedTouches[0].clientX - touch.current.x;
    const dy = e.changedTouches[0].clientY - touch.current.y;
    if (Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy) * 1.6) { dx < 0 ? goCh(cur + 1) : goCh(cur - 1); }
    touch.current = null;
  };

  const articleStyle = {
    '--r-font': f.css, '--r-size': settings.size + 'px',
    '--r-leading': settings.leading, '--r-margin': settings.margin + 'px',
    '--r-para': (settings.leading * 0.62).toFixed(2) + 'em',
  };

  return (
    <div className="reader" data-reader-theme={settings.theme}>
      <div className="reader-scroll" ref={scrollRef} onScroll={onScroll}
        onClick={() => setChrome(c => !c)} onTouchStart={onTS} onTouchEnd={onTE}>
        <div className="reader-article" style={articleStyle}>
          <div className="ch-head">
            <div className="ch-kicker">Chapter {cur} of {total}</div>
            <div className="ch-h">{!hasReal && !demo ? work.title : (chapterTitle && cur === chapterN ? chapterTitle : ch.title)}</div>
          </div>
          {chapters === null && !demo ? (
            // Still fetching the downloaded text — show a skeleton, not the
            // "not downloaded" message (which wrongly implies it's missing).
            <ChapterSkeleton />
          ) : hasReal ? (
            curChapter && curChapter.content
              ? <div className="chapter-body" dangerouslySetInnerHTML={{ __html: curChapter.content }} />
              : <p style={{ color: 'var(--reader-text-dim)' }}>This chapter hasn’t been downloaded yet.</p>
          ) : demo ? (
            <>
              {READER_PARAS.map((p, i) => <p key={i}>{p}</p>)}
              {READER_PARAS.slice(0, 4).map((p, i) => <p key={'b' + i}>{p}</p>)}
            </>
          ) : (
            <p style={{ color: 'var(--reader-text-dim)' }}>
              This work hasn’t been downloaded yet — it’s queued for offline download, and the next sync will fetch the full text so you can read it here.
            </p>
          )}

          <div className="eoc" style={{ display: !hasReal && !demo ? 'none' : undefined }}>
            <div className="star"><span className="ln"></span><Icon icon="solar:asterisk-linear" size={16} /><span className="ln"></span></div>
            {cur < total ? (
              <button className="nextbtn pressable" onClick={(e) => { e.stopPropagation(); goCh(cur + 1); }}>
                Next chapter <Icon icon="solar:arrow-right-linear" size={18} />
              </button>
            ) : (
              <div style={{ color: 'var(--reader-text-dim)' }}>
                <Icon icon={work.status === 'complete' ? 'solar:check-circle-bold' : 'solar:clock-circle-linear'} size={26} style={{ marginBottom: 8 }} />
                <div style={{ fontFamily: 'var(--font-sans)', fontSize: 14, fontWeight: 600 }}>
                  {work.status === 'complete' ? 'The end · you’re all caught up' : 'Caught up — no newer chapters yet'}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="reader-brightness" style={{ opacity: (1 - settings.brightness) * 0.55 }}></div>

      <div className={`reader-chrome reader-top ${chrome ? '' : 'hidden'}`}>
        <button className="reader-icbtn" onClick={() => nav.pop()}><Icon icon="solar:arrow-left-linear" size={23} /></button>
        <div className="rt-title">
          <div className="rt-t">{work.title}</div>
          <div className="rt-s">by {work.author}</div>
        </div>
        <button className="reader-icbtn" onClick={() => nav.push('detail', { work })}><Icon icon="solar:info-circle-linear" size={22} /></button>
      </div>

      <div className={`reader-chrome reader-bottom ${chrome ? '' : 'hidden'}`}>
        <div className="reader-progress">
          <span>Ch {cur}</span>
          <div className="bar"><i style={{ width: `${scrollPct * 100}%` }}></i></div>
          <span>{Math.round(scrollPct * 100)}%</span>
        </div>
        <div className="reader-nav">
          <button className="reader-icbtn" disabled={cur <= 1} style={{ opacity: cur <= 1 ? .3 : 1 }} onClick={() => goCh(cur - 1)}><Icon icon="solar:alt-arrow-left-linear" size={24} /></button>
          <button className="reader-icbtn" onClick={() => setShowSettings(true)}>
            <span style={{ fontSize: 21, fontFamily: 'var(--font-serif)', fontWeight: 600 }}>Aa</span></button>
          <button className="reader-icbtn" onClick={() => { const i = READER_THEMES.findIndex(t => t.value === settings.theme); setSettings({ ...settings, theme: READER_THEMES[(i + 1) % 4].value }); }}>
            <Icon icon="solar:pallete-2-linear" size={23} /></button>
          <button className="reader-icbtn" onClick={() => setShowTOC(true)}><Icon icon="solar:list-linear" size={23} /></button>
          <button className="reader-icbtn" disabled={cur >= total} style={{ opacity: cur >= total ? .3 : 1 }} onClick={() => goCh(cur + 1)}><Icon icon="solar:alt-arrow-right-linear" size={24} /></button>
        </div>
      </div>

      <ReaderSettingsSheet open={showSettings} onClose={() => setShowSettings(false)} settings={settings} setSettings={setSettings} />
      <ReaderTOCSheet open={showTOC} onClose={() => setShowTOC(false)} total={total} cur={cur} chapters={hasReal ? chapters : null} demo={demo} onPick={(n) => { goCh(n); setShowTOC(false); }} />
    </div>
  );
}

function ReaderSettingsSheet({ open, onClose, settings, setSettings }) {
  const set = (k, v) => setSettings({ ...settings, [k]: v });
  return (
    <Sheet open={open} onClose={onClose} reader title="Reading settings">
      <div className="section-label" style={{ marginBottom: 10, color: 'var(--reader-text-dim)' }}>Theme</div>
      <div className="themeswatches" style={{ marginBottom: 22 }}>
        {READER_THEMES.map(t => (
          <button key={t.value} className={`themeswatch pressable ${settings.theme === t.value ? 'on' : ''}`}
            style={{ background: t.bg, color: t.fg }} onClick={() => set('theme', t.value)}>
            {settings.theme === t.value && <span className="check"><Icon icon="solar:check-circle-bold" size={16} /></span>}
            <span style={{ fontFamily: 'var(--font-serif)', fontSize: 17, fontWeight: 600 }}>Aa</span>
            <span>{t.label}</span>
          </button>
        ))}
      </div>

      <div className="section-label" style={{ marginBottom: 10, color: 'var(--reader-text-dim)' }}>Font</div>
      <div className="seg" style={{ marginBottom: 22 }}>
        {READER_FONTS.map(ft => (
          <button key={ft.value} className={settings.font === ft.value ? 'on' : ''} onClick={() => set('font', ft.value)}
            style={{ fontFamily: ft.css, flexDirection: 'column', gap: 1, height: 48 }}>
            <span style={{ fontSize: 17 }}>Ag</span><span style={{ fontSize: 10.5, fontFamily: 'var(--font-sans)' }}>{ft.label}</span>
          </button>
        ))}
      </div>

      <SheetStepperRow label="Text size" value={settings.size + 'px'} onMinus={() => set('size', Math.max(14, settings.size - 1))} onPlus={() => set('size', Math.min(28, settings.size + 1))} />
      <SheetStepperRow label="Line height" value={settings.leading.toFixed(2)} onMinus={() => set('leading', Math.max(1.3, +(settings.leading - 0.05).toFixed(2)))} onPlus={() => set('leading', Math.min(2.2, +(settings.leading + 0.05).toFixed(2)))} />
      <SheetStepperRow label="Margins" value={settings.margin + 'px'} onMinus={() => set('margin', Math.max(12, settings.margin - 4))} onPlus={() => set('margin', Math.min(56, settings.margin + 4))} />

      <div style={{ display: 'flex', alignItems: 'center', gap: 13, padding: '14px 2px 8px' }}>
        <Icon icon="solar:sun-2-linear" size={20} color="var(--reader-text-dim)" />
        <input className="range" type="range" min="0.4" max="1" step="0.02" value={settings.brightness}
          onChange={e => set('brightness', +e.target.value)} />
        <Icon icon="solar:sun-2-bold" size={22} color="var(--reader-ui)" />
      </div>
    </Sheet>
  );
}

function SheetStepperRow({ label, value, onMinus, onPlus }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, padding: '9px 0' }}>
      <span style={{ fontSize: 14.5, fontWeight: 600 }}>{label}</span>
      <div className="stepper" style={{ width: 150 }}>
        <button onClick={onMinus}><Icon icon="solar:minus-circle-linear" size={20} /></button>
        <span className="val">{value}</span>
        <button onClick={onPlus}><Icon icon="solar:add-circle-linear" size={20} /></button>
      </div>
    </div>
  );
}

function ReaderTOCSheet({ open, onClose, total, cur, chapters, demo, onPick }) {
  const list = chapters && chapters.length ? chapters : demo ? CHAPTERS.slice(0, total) : [];
  return (
    <Sheet open={open} onClose={onClose} reader title="Chapters" maxH="78%">
      <div style={{ paddingBottom: 8 }}>
        {list.length === 0 && (
          <div style={{ padding: '12px 2px', fontSize: 13.5, lineHeight: 1.5, color: 'var(--reader-text-dim)' }}>
            No chapters downloaded yet.
          </div>
        )}
        {list.map(ch => (
          <button key={ch.n} onClick={() => onPick(ch.n)} className="chrow pressable" style={{ width: '100%', textAlign: 'left' }}>
            <div className="chnum" style={{ color: ch.n === cur ? 'var(--reader-accent)' : 'var(--reader-text-dim)' }}>{ch.n === cur ? <Icon icon="solar:bookmark-bold" size={15} /> : ch.n}</div>
            <div className="chmeta">
              <div className="chtitle" style={{ color: ch.n === cur ? 'var(--reader-accent)' : 'var(--reader-ui)' }}>{ch.title}</div>
              <div className="chsub" style={{ color: 'var(--reader-text-dim)' }}>{fmtWords(ch.words)}</div>
            </div>
            {ch.n === cur && <span style={{ fontSize: 11, color: 'var(--reader-accent)', fontWeight: 700 }}>Reading</span>}
          </button>
        ))}
      </div>
    </Sheet>
  );
}
