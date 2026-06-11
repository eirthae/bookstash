import Icon from './Icon.jsx';

// Shared app chrome — kept visually identical to FicStash (same appbar + the
// centered floating "+" bottom nav), so the two apps feel like one family.

// ---- App header -----------------------------------------------------------
export function Appbar({ title, large, sub, back, actions }) {
  if (large) {
    return (
      <div className="appbar lg">
        {(back || (actions && actions.length)) && (
          <div className="appbar-row">
            {back && <button className="iconbtn" onClick={back}><Icon icon="solar:arrow-left-linear" size={23} /></button>}
            <div style={{ flex: 1 }}></div>
            {actions && actions.map((a, i) => <button key={i} className="iconbtn ghost" onClick={a.onClick} aria-label={a.label}><Icon icon={a.icon} size={23} /></button>)}
          </div>
        )}
        <div>
          <div className="title">{title}</div>
          {sub && <div style={{ fontSize: 13, color: 'var(--text-tertiary)', fontWeight: 500, marginTop: 2 }}>{sub}</div>}
        </div>
      </div>
    );
  }
  return (
    <div className="appbar">
      {back && <button className="iconbtn" style={{ marginLeft: -8 }} onClick={back}><Icon icon="solar:arrow-left-linear" size={23} /></button>}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="title-sm">{title}</div>
        {sub && <div style={{ fontSize: 11.5, color: 'var(--text-tertiary)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sub}</div>}
      </div>
      {actions && actions.map((a, i) => <button key={i} className="iconbtn ghost" onClick={a.onClick} aria-label={a.label}><Icon icon={a.icon} size={23} /></button>)}
    </div>
  );
}

// BookStash has three sections; like FicStash they sit around a centered,
// half-floating "+" (the Add menu): Library + Discover on the left, Settings
// on the right.
const TABS = [
  { id: 'library', label: 'Library', icon: 'solar:book-minimalistic-linear', iconOn: 'solar:book-minimalistic-bold' },
  { id: 'discover', label: 'Discover', icon: 'solar:compass-linear', iconOn: 'solar:compass-bold' },
  { id: 'settings', label: 'Settings', icon: 'solar:settings-linear', iconOn: 'solar:settings-bold' },
];

export function BottomNav({ active, onTab, onAdd, addActive }) {
  const left = TABS.slice(0, 2);
  const right = TABS.slice(2);
  const renderTab = (t) => (
    <button key={t.id} className={`navitem ${active === t.id ? 'active' : ''}`} onClick={() => onTab(t.id)}>
      <span className="navicon"><Icon icon={active === t.id ? t.iconOn : t.icon} size={25} /></span>
      <span className="navlabel">{t.label}</span>
    </button>
  );
  return (
    <div className="bottomnav">
      {left.map(renderTab)}
      <button className={`navfab ${addActive ? 'open' : ''}`} onClick={onAdd} aria-label="Add to library" aria-expanded={!!addActive}>
        <span className="fab-circle"><span className="fab-plus-w" /></span>
      </button>
      {right.map(renderTab)}
    </div>
  );
}
