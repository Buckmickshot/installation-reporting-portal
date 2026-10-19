// Field evidence: geotagged/timestamped photos and on-site signatures.
import React, { useRef, useState } from 'react';
import { supabase } from '../../relationship/supabaseConfig';
import { uploadFile } from '../../relationship/storage';
import { EVIDENCE_KINDS, evidenceLabel, formatDate } from '../../utils/jobStatus';
import SignaturePad from './SignaturePad';

function getPosition() {
  return new Promise(resolve => {
    if (!navigator.geolocation) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      p => resolve({ latitude: p.coords.latitude, longitude: p.coords.longitude, accuracy_m: p.coords.accuracy }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 6000, maximumAge: 60000 }
    );
  });
}

export async function addEvidence({ installationId, kind, file, note }) {
  const ext = (file.name?.split('.').pop() || (file.type === 'image/png' ? 'png' : 'jpg')).toLowerCase();
  const path = `jobs/${installationId}/evidence/${kind}-${Date.now().toString(36)}.${ext}`;
  const [{ url }, geo] = await Promise.all([uploadFile(path, file), getPosition()]);
  const { data, error } = await supabase
    .from('job_evidence')
    .insert({
      installation_id: installationId,
      kind,
      file_url: url,
      file_name: file.name || `${kind}.${ext}`,
      note: note || null,
      ...(geo || {}),
    })
    .select()
    .single();
  if (error) throw error;
  await supabase.from('job_events').insert({
    installation_id: installationId,
    event_type: 'evidence',
    message: `Added ${evidenceLabel(kind).toLowerCase()}${note ? ` (${note})` : ''}`,
    actor: (await supabase.auth.getUser()).data.user?.id,
  });
  return data;
}

export default function EvidencePanel({ installationId, evidence, editable, onChanged, compact = false }) {
  const [kind, setKind] = useState('new_outdoor_unit');
  const [busy, setBusy] = useState(false);
  const [signing, setSigning] = useState(null); // 'customer_signature' | 'installer_signature'
  const [signer, setSigner] = useState('');
  const fileRef = useRef(null);

  const photoKinds = EVIDENCE_KINDS.filter(k => k.group === 'photo');

  const onFiles = async e => {
    const files = [...(e.target.files || [])];
    e.target.value = '';
    if (!files.length) return;
    setBusy(true);
    try {
      for (const f of files) await addEvidence({ installationId, kind, file: f });
      onChanged?.();
    } catch (err) {
      alert('Could not save photo: ' + err.message);
    } finally {
      setBusy(false);
    }
  };

  const saveSignature = async blob => {
    if (!signer.trim()) return alert('Enter the name of the person signing.');
    setBusy(true);
    try {
      const file = new File([blob], `${signing}.png`, { type: 'image/png' });
      await addEvidence({ installationId, kind: signing, file, note: signer.trim() });
      setSigning(null);
      setSigner('');
      onChanged?.();
    } catch (err) {
      alert('Could not save signature: ' + err.message);
    } finally {
      setBusy(false);
    }
  };

  const remove = async ev => {
    if (!window.confirm(`Remove this ${evidenceLabel(ev.kind).toLowerCase()}?`)) return;
    const { error } = await supabase.from('job_evidence').delete().eq('evidence_id', ev.evidence_id);
    if (error) return alert(error.message);
    onChanged?.();
  };

  return (
    <div>
      {editable && (
        <>
          <div className="capture-row">
            <select className="input" value={kind} onChange={e => setKind(e.target.value)} aria-label="Photo type">
              {photoKinds.map(k => <option key={k.value} value={k.value}>{k.label}</option>)}
            </select>
            <button className="btn primary" onClick={() => fileRef.current?.click()} disabled={busy}>
              {busy && !signing ? 'Uploading…' : '📷 Add photo'}
            </button>
            <input ref={fileRef} type="file" accept="image/*" capture="environment" multiple hidden onChange={onFiles} />
            <button className="btn" onClick={() => setSigning('customer_signature')} disabled={busy}>✍️ Customer signature</button>
            <button className="btn" onClick={() => setSigning('installer_signature')} disabled={busy}>✍️ Installer signature</button>
          </div>
          {signing && (
            <div className="card" style={{ marginBottom: 12 }}>
              <h2>{evidenceLabel(signing)}</h2>
              <input className="input" style={{ width: '100%', marginBottom: 8 }} placeholder="Full name of person signing"
                value={signer} onChange={e => setSigner(e.target.value)} />
              <SignaturePad busy={busy} onSave={saveSignature} onCancel={() => setSigning(null)} />
            </div>
          )}
        </>
      )}

      {evidence.length === 0 ? (
        <p className="sub">No photos or signatures yet.</p>
      ) : (
        <div className="evidence-grid">
          {evidence.map(ev => (
            <div key={ev.evidence_id} className={`evidence-item ${ev.kind.includes('signature') ? 'sig' : ''}`}>
              <a href={ev.file_url} target="_blank" rel="noreferrer">
                <img src={ev.file_url} alt={evidenceLabel(ev.kind)} loading="lazy" />
              </a>
              <div className="meta">
                <b>{evidenceLabel(ev.kind)}</b>
                {ev.note && <div>{ev.note}</div>}
                <div className="sub">{formatDate(ev.captured_at, true)}</div>
                {!compact && (
                  <div className="sub">
                    {ev.latitude != null
                      ? <a href={`https://maps.google.com/?q=${ev.latitude},${ev.longitude}`} target="_blank" rel="noreferrer">📍 {ev.latitude.toFixed(4)}, {ev.longitude.toFixed(4)}</a>
                      : 'No GPS'}
                  </div>
                )}
                {editable && <button className="btn small ghost danger" style={{ padding: 0, marginTop: 4 }} onClick={() => remove(ev)}>Remove</button>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
