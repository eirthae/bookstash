import { useRef, useState } from 'react';
import Icon from './Icon.jsx';
import { importFiles, importLink, summarize } from '../lib/import.js';

// Add to library — opened by the centered "+" in the bottom nav (like FicStash).
// Upload files, or add a single work by link (fetched + extracted on-device).
// Reports progress + a result notice; tells the app to reload on success.
export function AddMenu({ open, onClose, onChanged }) {
  const fileInput = useRef(null);
  const [busy, setBusy] = useState(null);     // { done, total } while importing
  const [url, setUrl] = useState('');
  const [state, setState] = useState({ kind: 'idle' }); // idle|busy|error|restricted|ok

  const pick = () => { if (!busy && fileInput.current) fileInput.current.click(); };
  const onFiles = async (e) => {
    const files = e.target.files; e.target.value = '';
    if (!files || !files.length) return;
    setBusy({ done: 0, total: files.length });
    const results = await importFiles(files, setBusy);
    setBusy(null);
    const s = summarize(results);
    onChanged?.(`${s.added} added${s.failed ? ` · ${s.failed} skipped` : ''}`);
    onClose();
  };
  const submitLink = async () => {
    const u = url.trim();
    if (!u || state.kind === 'busy') return;
    setState({ kind: 'busy' });
    const res = await importLink(u);
    if (res.ok) { setUrl(''); setState({ kind: 'idle' }); onChanged?.('Added — saved offline.'); onClose(); }
    else if (res.restricted) setState({ kind: 'restricted', url: res.url, msg: res.error });
    else setState({ kind: 'error', msg: res.error });
  };

  return (
    <>
      <input ref={fileInput} type="file" accept=".epub,.html,.htm,.txt" multiple style={{ display: 'none' }} onChange={onFiles} />
      {open && (
        <>
          <div className="bs-sheet-backdrop" onClick={onClose} />
          <div className="bs-sheet">
            <div className="bs-sheet-title">Add to library</div>

            {busy ? (
              <div className="add-note" style={{ background: 'var(--surface-2)', color: 'var(--text-secondary)' }}>
                <span className="spin" /> Importing {busy.done}/{busy.total}…
              </div>
            ) : (
              <button className="add-row pressable" onClick={pick}>
                <Icon icon="solar:upload-minimalistic-bold" size={20} color="var(--accent)" />
                <div><b>Upload files</b><span>EPUB, HTML or TXT — pick many at once</span></div>
              </button>
            )}

            <div className="add-or"><span>or add by link</span></div>

            <div className="searchfield" style={{ marginBottom: 10 }}>
              <Icon icon="solar:link-linear" size={18} color="var(--text-tertiary)" />
              <input placeholder="Paste a fic or article URL" value={url}
                onChange={(e) => { setUrl(e.target.value); if (state.kind !== 'busy') setState({ kind: 'idle' }); }}
                onKeyDown={(e) => e.key === 'Enter' && submitLink()}
                autoCapitalize="off" autoCorrect="off" spellCheck={false} inputMode="url" />
            </div>

            {state.kind === 'error' && <div className="add-note err">{state.msg}</div>}
            {state.kind === 'restricted' && (
              <div className="add-note warn">
                🔒 {state.msg}
                <button className="linklike" onClick={() => { try { window.open(state.url, '_blank', 'noopener'); } catch (e) {} }}>Open on AO3</button>
              </div>
            )}

            <button className="btn btn-primary" style={{ width: '100%' }} disabled={state.kind === 'busy' || !url.trim()} onClick={submitLink}>
              {state.kind === 'busy' ? <><span className="spin" /> Fetching…</> : <><Icon icon="solar:download-minimalistic-bold" size={18} /> Add link</>}
            </button>
            <div style={{ fontSize: 11.5, color: 'var(--text-tertiary)', textAlign: 'center', marginTop: 10, lineHeight: 1.5 }}>
              Fetched on this device and saved offline. Articles &amp; single-page works read best for now.
            </div>
          </div>
        </>
      )}
    </>
  );
}
