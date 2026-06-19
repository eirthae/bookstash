import { useRef, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { FilePicker } from '@capawesome/capacitor-file-picker';
import Icon from './Icon.jsx';
import { importFiles, importLink, summarize } from '../lib/import.js';

// base64 → File. The native picker hands back file bytes as base64 (readData);
// we rebuild a real File so the existing EPUB/HTML/TXT parsers work unchanged.
// Robust: strip a possible data-URL prefix and never throw on bad/missing data
// (an empty File is then reported as "empty" by the importer rather than blowing
// up the whole batch).
function fileFromPicked(f) {
  let b64 = (f && f.data) || '';
  const comma = b64.indexOf(',');
  if (b64.startsWith('data:') && comma !== -1) b64 = b64.slice(comma + 1);
  let bytes = new Uint8Array(0);
  try {
    const bin = atob(b64);
    bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  } catch (e) { /* leave empty → importFile flags it instead of crashing */ }
  return new File([bytes], (f && f.name) || 'file', { type: (f && f.mimeType) || '' });
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
    setState({ kind: 'idle' });
    setBusy({ done: 0, total: files.length });
    const results = await importFiles(files, setBusy);
    setBusy(null);
    const s = summarize(results);
    if (s.added === 0) {
      // Nothing imported — keep the sheet open and show why (e.g. unsupported
      // type, empty/cloud-placeholder file, unreadable EPUB) instead of closing
      // silently and looking like the picker "did nothing".
      const reason = (s.failures && s.failures[0] && s.failures[0].error) || 'Couldn’t read the selected file(s).';
      setState({ kind: 'error', msg: reason });
      return;
    }
    const added = results.find((r) => r.ok && r.work);
    onChanged?.(`${s.added} added${s.failed ? ` · ${s.failed} skipped` : ''}`, added && added.work);
    onClose();
  };

  // On-device we use the native document picker (Storage Access Framework) — it
  // opens the real file browser (Downloads, Files, SD card…), not the cramped
  // Drive view. limit:0 = unlimited (multi-select). The hidden <input> below is
  // only a web/dev fallback (its change event is flaky in the Android WebView).
  const pick = async () => {
    if (busy) return;
    setState({ kind: 'idle' });
    if (Capacitor.isNativePlatform()) {
      let picked;
      try {
        const result = await FilePicker.pickFiles({ readData: true, limit: 0 });
        picked = (result && result.files) || [];
      } catch (e) {
        const msg = (e && (e.message || e.errorMessage)) || String(e || '');
        if (/cancel/i.test(msg)) return; // user backed out of the picker
        setState({ kind: 'error', msg: `Couldn’t open the file picker: ${msg}` });
        return;
      }
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
    if (res.ok && res.series) { setUrl(''); setState({ kind: 'idle' }); onChanged?.('Queued the whole series — works arrive on the next sync.', null); onClose(); }
    else if (res.ok) { setUrl(''); setState({ kind: 'idle' }); onChanged?.('Added — saved offline.', res.work); onClose(); }
    else if (res.duplicate) setState({ kind: 'info', msg: res.error || 'Already in your library.' });
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

            {state.kind === 'info' && <div className="add-note" style={{ background: 'var(--surface-2)', color: 'var(--text-secondary)' }}>✓ {state.msg}</div>}
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
