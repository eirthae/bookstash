import { useRef, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { FilePicker } from '@capawesome/capacitor-file-picker';
import Icon from './Icon.jsx';
import { importFiles, importLink, summarize } from '../lib/import.js';

// base64 → File. The native picker hands back file bytes as base64 (readData);
// we rebuild a real File so the existing EPUB/HTML/TXT parsers work unchanged.
function fileFromPicked(f) {
  const bin = atob(f.data || '');
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new File([bytes], f.name || 'file', { type: f.mimeType || '' });
}

// Add to library — opened by the centered "+" in the bottom nav (like FicStash).
// Upload files, or add a single work by link (fetched + extracted on-device).
// Reports progress + a result notice; tells the app to reload on success.
export function AddMenu({ open, onClose, onChanged }) {
  const fileInput = useRef(null);
  const [busy, setBusy] = useState(null);     // { done, total } while importing
  const [url, setUrl] = useState('');
  const [state, setState] = useState({ kind: 'idle' }); // idle|busy|error|restricted|ok

  const runImport = async (files) => {
    if (!files || !files.length) return;
    setBusy({ done: 0, total: files.length });
    const results = await importFiles(files, setBusy);
    setBusy(null);
    const s = summarize(results);
    const added = results.find((r) => r.ok && r.work);
    onChanged?.(`${s.added} added${s.failed ? ` · ${s.failed} skipped` : ''}`, added && added.work);
    onClose();
  };

  // On-device we use the native document picker (Storage Access Framework) — it
  // opens the real file browser (Downloads, Files, SD card…), not the cramped
  // Drive view, and reliably returns the bytes. The hidden <input> below is only
  // a web/dev fallback (its change event is flaky in the Android WebView, which
  // is why "pick a file → nothing happened" was happening on the phone).
  const pick = async () => {
    if (busy) return;
    if (Capacitor.isNativePlatform()) {
      let picked;
      try {
        const result = await FilePicker.pickFiles({ readData: true });
        picked = (result && result.files) || [];
      } catch (e) { return; } // user cancelled / picker error
      if (!picked.length) return;
      await runImport(picked.map(fileFromPicked));
    } else if (fileInput.current) {
      fileInput.current.click();
    }
  };
  const onFiles = async (e) => {
    const files = Array.from(e.target.files || []); e.target.value = '';
    await runImport(files);
  };
  const submitLink = async () => {
    const u = url.trim();
    if (!u || state.kind === 'busy') return;
    setState({ kind: 'busy' });
    const res = await importLink(u);
    if (res.ok) { setUrl(''); setState({ kind: 'idle' }); onChanged?.('Added — saved offline.', res.work); onClose(); }
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
