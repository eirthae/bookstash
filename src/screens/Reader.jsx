import { useState, useEffect, useRef } from 'react';
import Icon from '../components/Icon.jsx';
import { getChapters } from '../lib/db.js';
import { getReadingPos, getChapterPos, saveReadingPos } from '../lib/reading.js';

export const READER_THEMES = [
  { value: 'dark', label: 'Dark', bg: '#121214', fg: '#cfcfd4' },
  { value: 'light', label: 'Light', bg: '#ffffff', fg: '#1f2125' },
  { value: 'sepia', label: 'Sepia', bg: '#f1e7d0', fg: '#4f4334' },
  { value: 'yellow', label: 'Yellow', bg: '#fbf1c4', fg: '#46401f' },
];
export const READER_FONTS = [
  { value: 'serif', label: 'Serif', css: 'var(--font-serif)' },
  { value: 'sans', label: 'Sans', css: 'var(--font-sans)' },
  { value: 'mono', label: 'Mono', css: 'ui-monospace, "Cascadia Mono", Menlo, monospace' },
];

export function ReaderScreen({ work, settings, setSettings, onBack }) {
  const [chapters, setChapters] = useState(null);
  const savedPos = useRef(getReadingPos(work.id));
  const positionedFor = useRef(null); // the `cur` we've scrolled into place
  const positioned = useRef(new Set()); // chapters already placed this mount
  const lastPct = useRef(savedPos.current ? savedPos.current.pct || 0 : 0); // latest scroll fraction
  const saveTimer = useRef(null);
  const scrollRef = useRef(null);
  const [cur, setCur] = useState((savedPos.current && savedPos.current.chapter) || 1);
  const [chrome, setChrome] = useState(true);
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    let alive = true;
    getChapters(work.id).then((c) => { if (alive) setChapters(c || []); }).catch(() => { if (alive) setChapters([]); });
    return () => { alive = false; };
  }, [work.id]);
  useEffect(() => () => { if (saveTimer.current) clearTimeout(saveTimer.current); }, []);

  const total = chapters ? chapters.length : (work.chapters || 1);
  const ch = chapters ? (chapters.find((c) => c.n === cur) || chapters[0]) : null;

  // Position once per chapter, after its body renders: each chapter restores ITS
  // OWN saved scroll fraction, so reading ahead and coming back returns you to
  // where you were — not the top.
  useEffect(() => {
    if (positionedFor.current === cur) return;
    if (chapters === null) return;            // still loading
    if (chapters.length && !(ch && ch.content != null)) return;
    positionedFor.current = cur;
    positioned.current.add(cur);
    let pct = getChapterPos(work.id, cur);
    let tries = 0;
    const apply = () => {
      const n = scrollRef.current; if (!n) return;
      const max = n.scrollHeight - n.clientHeight;
      if (pct > 0 && max < 80 && tries < 25) { tries++; setTimeout(apply, 40); return; }
      n.scrollTop = max > 0 ? pct * max : 0;
    };
    setTimeout(apply, 0); // setTimeout (not rAF) so it fires reliably mid-mount
  }, [cur, chapters]); // eslint-disable-line react-hooks/exhaustive-deps

  const onScroll = (e) => {
    const el = e.target; const max = el.scrollHeight - el.clientHeight;
    const pct = max > 0 ? Math.min(1, el.scrollTop / max) : 0;
    lastPct.current = pct;
    if (chrome) setChrome(false);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => saveReadingPos(work.id, { chapter: cur, pct }), 350);
  };
  const go = (n) => {
    if (n < 1 || n > total) return;
    // Bank where we are in the chapter we're leaving, then point resume at the
    // new chapter without losing any scroll it already had.
    saveReadingPos(work.id, { chapter: cur, pct: lastPct.current });
    saveReadingPos(work.id, { chapter: n, pct: getChapterPos(work.id, n) });
    lastPct.current = getChapterPos(work.id, n);
    setCur(n);
  };

  const font = READER_FONTS.find((f) => f.value === settings.font) || READER_FONTS[0];
  const articleStyle = { '--r-font': font.css, '--r-size': (settings.size || 18) + 'px' };

  return (
    <div className="reader" data-reader-theme={settings.theme || 'dark'}>
      <div className="reader-scroll" ref={scrollRef} onScroll={onScroll} onClick={() => setChrome((c) => !c)}>
        <div className="reader-article" style={articleStyle}>
          <div className="ch-kicker">Chapter {cur} of {total}</div>
          <div className="ch-head">{ch ? ch.title : work.title}</div>
          {chapters === null ? (
            <div className="reader-skel">{Array.from({ length: 9 }).map((_, i) => <span key={i} style={{ width: i % 4 === 3 ? '62%' : '100%' }} />)}</div>
          ) : ch && ch.content ? (
            <div className="chapter-body" dangerouslySetInnerHTML={{ __html: ch.content }} />
          ) : (
            <p style={{ color: 'var(--reader-text-dim)' }}>This chapter is empty.</p>
          )}
        </div>
      </div>

      <div className={`reader-top ${chrome ? '' : 'hidden'}`}>
        <button className="iconbtn" onClick={onBack}><Icon icon="solar:arrow-left-linear" size={23} /></button>
        <div className="reader-title">
          <div className="rt-t">{work.title}</div>
          {work.author && <div className="rt-s">by {work.author}</div>}
        </div>
        <button className="iconbtn" onClick={() => setShowSettings(true)} aria-label="Reading settings">
          <span style={{ fontFamily: 'var(--font-serif)', fontSize: 20, fontWeight: 600 }}>Aa</span>
        </button>
      </div>

      {total > 1 && (
        <div className={`reader-bottom ${chrome ? '' : 'hidden'}`}>
          <button className="iconbtn" disabled={cur <= 1} style={{ opacity: cur <= 1 ? 0.3 : 1 }} onClick={() => go(cur - 1)}><Icon icon="solar:alt-arrow-left-linear" size={24} /></button>
          <span className="rb-label">Ch {cur} / {total}</span>
          <button className="iconbtn" disabled={cur >= total} style={{ opacity: cur >= total ? 0.3 : 1 }} onClick={() => go(cur + 1)}><Icon icon="solar:alt-arrow-right-linear" size={24} /></button>
        </div>
      )}

      {showSettings && <ReaderSettings settings={settings} setSettings={setSettings} onClose={() => setShowSettings(false)} />}
    </div>
  );
}

function ReaderSettings({ settings, setSettings, onClose }) {
  const set = (k, v) => setSettings({ ...settings, [k]: v });
  const size = settings.size || 18;
  return (
    <>
      <div className="rsheet-backdrop" onClick={onClose} />
      <div className="rsheet">
        <div className="rsheet-title">Reading</div>

        <div className="rsheet-label">Theme</div>
        <div className="rsheet-themes">
          {READER_THEMES.map((t) => (
            <button key={t.value} onClick={() => set('theme', t.value)}
              className={settings.theme === t.value ? 'on' : ''}
              style={{ background: t.bg, color: t.fg }}>
              Aa{settings.theme === t.value ? <span className="dot" /> : null}
            </button>
          ))}
        </div>

        <div className="rsheet-label">Font</div>
        <div className="rsheet-fonts">
          {READER_FONTS.map((f) => (
            <button key={f.value} className={settings.font === f.value ? 'on' : ''} onClick={() => set('font', f.value)} style={{ fontFamily: f.css }}>{f.label}</button>
          ))}
        </div>

        <div className="rsheet-label">Text size</div>
        <div className="rsheet-size">
          <button onClick={() => set('size', Math.max(14, size - 1))}>A−</button>
          <span>{size}px</span>
          <button onClick={() => set('size', Math.min(28, size + 1))}>A+</button>
        </div>
      </div>
    </>
  );
}
