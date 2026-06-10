import { useState, useEffect, useRef } from 'react';
import Icon from '../components/Icon.jsx';
import { getChapters } from '../lib/db.js';

// Basic reader (Phase 1): loads the book's chapters from the device, renders the
// current chapter's HTML, and steps between chapters. Reader themes, fonts, and
// resume-position come in a later phase.
export function ReaderScreen({ work, onBack }) {
  const [chapters, setChapters] = useState(null); // null = loading
  const [cur, setCur] = useState(1);
  const [chrome, setChrome] = useState(true);
  const scrollRef = useRef(null);

  useEffect(() => {
    let alive = true;
    getChapters(work.id).then((c) => { if (alive) setChapters(c || []); }).catch(() => { if (alive) setChapters([]); });
    return () => { alive = false; };
  }, [work.id]);

  const total = chapters ? chapters.length : (work.chapters || 1);
  const ch = chapters ? (chapters.find((c) => c.n === cur) || chapters[0]) : null;

  // Jump to the top of the new chapter.
  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = 0; }, [cur]);

  const go = (n) => { if (n >= 1 && n <= total) setCur(n); };

  return (
    <div className="reader" data-reader-theme="follow">
      <div className="reader-scroll" ref={scrollRef} onClick={() => setChrome((c) => !c)}>
        <div className="reader-article">
          <div className="ch-kicker">Chapter {cur} of {total}</div>
          <div className="ch-head">{ch ? ch.title : work.title}</div>
          {chapters === null ? (
            <div className="reader-skel">{Array.from({ length: 9 }).map((_, i) => <span key={i} style={{ width: i % 4 === 3 ? '62%' : '100%' }} />)}</div>
          ) : ch && ch.content ? (
            <div className="chapter-body" dangerouslySetInnerHTML={{ __html: ch.content }} />
          ) : (
            <p style={{ color: 'var(--text-tertiary)' }}>This chapter is empty.</p>
          )}
        </div>
      </div>

      <div className={`reader-top ${chrome ? '' : 'hidden'}`}>
        <button className="iconbtn" onClick={onBack}><Icon icon="solar:arrow-left-linear" size={23} /></button>
        <div className="reader-title">
          <div className="rt-t">{work.title}</div>
          {work.author && <div className="rt-s">by {work.author}</div>}
        </div>
      </div>

      {total > 1 && (
        <div className={`reader-bottom ${chrome ? '' : 'hidden'}`}>
          <button className="iconbtn" disabled={cur <= 1} style={{ opacity: cur <= 1 ? 0.3 : 1 }} onClick={() => go(cur - 1)}>
            <Icon icon="solar:alt-arrow-left-linear" size={24} />
          </button>
          <span className="rb-label">Ch {cur} / {total}</span>
          <button className="iconbtn" disabled={cur >= total} style={{ opacity: cur >= total ? 0.3 : 1 }} onClick={() => go(cur + 1)}>
            <Icon icon="solar:alt-arrow-right-linear" size={24} />
          </button>
        </div>
      )}
    </div>
  );
}
