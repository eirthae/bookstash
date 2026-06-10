import Icon from '../components/Icon.jsx';

// External links — opened in the user's default browser. NO in-app payment flow,
// NO in-app purchases, NO gated features. The tip is purely optional support for
// a free, open-source project.
const TIP_URL = 'https://wise.com/pay/me/arminem34';
const REPO_URL = 'https://github.com/eirthae/bookstash';

const SUPPORT_MESSAGE = `Hi, I'm Erin.

I've been a designer for many years, but this is the first thing I've built entirely on my own.

I made this app because I was frustrated with existing readers. I wanted my own offline library, a better way to read fanfiction and articles, a place for my EPUBs, and something that wouldn't disappear if a website went down or a fic was deleted.

At first, I built it just for myself. Once it was working, I thought other people might find it useful too.

The app is free and open source, and I intend to keep it that way. There are no ads, no subscriptions, and no locked features. Your stories/books, anything you add is offline, available only to you on your device.

If this little project has made your reading life a bit better and you'd like to help support future development, you can leave a small tip.

Thank you for being part of something that started as a personal side project.`;

export function AboutScreen({ onBack }) {
  const openExternal = (url) => { try { window.open(url, '_blank', 'noopener'); } catch (e) { /* no-op */ } };

  return (
    <div className="screen">
      <div className="appbar" style={{ display: 'flex', alignItems: 'center', gap: 10, paddingBottom: 8 }}>
        <button className="iconbtn" onClick={onBack}><Icon icon="solar:arrow-left-linear" size={23} /></button>
      </div>
      <div className="scroll" style={{ padding: '4px 22px 32px' }}>
        <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 27, fontWeight: 700, lineHeight: 1.15, margin: '4px 0 20px' }}>
          About this project
        </h1>

        <div className="about-body">{SUPPORT_MESSAGE}</div>

        <button className="btn btn-primary" style={{ width: '100%', marginTop: 26, height: 50, fontSize: 15.5 }} onClick={() => openExternal(TIP_URL)}>
          💖 Leave a tip
        </button>
        <button onClick={() => openExternal(REPO_URL)}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%', height: 44, marginTop: 10,
            borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', color: 'var(--text-secondary)', fontSize: 14, fontWeight: 600 }}>
          <Icon icon="solar:code-2-linear" size={18} /> View source code
        </button>

        <div style={{ textAlign: 'center', fontSize: 12.5, color: 'var(--text-tertiary)', marginTop: 26, fontWeight: 600 }}>
          No ads. No subscriptions. No premium version.
        </div>
      </div>
    </div>
  );
}
