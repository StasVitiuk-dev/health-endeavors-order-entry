// #72 Export watermarking. Pure, synthetic. Attaches a TRACEABLE label to an
// export manifest so a copy that leaves can be traced back to the export event:
// who exported, when, why, a classification, and a deterministic trace id bound
// to the manifest's content checksum + the actor + the time. It does NOT alter
// the manifest or its checksum — the label accompanies it. verifyLabel()
// recomputes the trace id and confirms it still matches the manifest.
//
// Pure. Dual-mode (Node require + browser HE.reports registry).
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root && root.HE) { (root.HE.reports = root.HE.reports || {})['he-export-label'] = api; }
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const CLASSIFICATIONS = ['INTERNAL', 'CONFIDENTIAL', 'RESTRICTED'];

  function fnv1a(str) {
    let h = 0x811c9dc5;
    const s = String(str);
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0; }
    return ('0000000' + h.toString(16)).slice(-8);
  }

  // The manifest's own content fingerprint. Prefer the manifest's checksum; fall
  // back to a fingerprint of its canonical form so any export can be labeled.
  function manifestFingerprint(manifest) {
    const m = manifest || {};
    if (m.checksum) return String(m.checksum);
    try { return fnv1a(JSON.stringify(m)); } catch (e) { return '00000000'; }
  }

  // Build a traceable label for an export. Deterministic: the same manifest +
  // actor + time + purpose always yields the same trace id.
  function labelExport(manifest, opts) {
    const o = opts || {};
    const fp = manifestFingerprint(manifest);
    const exportedBy = String(o.exportedBy || 'unknown');
    const at = o.at || null;
    const purpose = String(o.purpose || 'owner review');
    const classification = CLASSIFICATIONS.indexOf(o.classification) !== -1 ? o.classification : 'CONFIDENTIAL';
    const traceId = fnv1a(fp + '|' + exportedBy + '|' + (at || '') + '|' + purpose);
    return {
      traceId: traceId, manifestChecksum: fp, exportedBy: exportedBy, at: at,
      purpose: purpose, classification: classification,
      watermark: 'HE · ' + classification + ' · trace ' + traceId + ' · ' + exportedBy + (at ? ' · ' + at : ''),
      synthetic: true, label: 'SIMULATED',
    };
  }

  // Confirm a label belongs to a manifest and was not altered: the recomputed
  // trace id and the stored manifest checksum must both still match.
  function verifyLabel(label, manifest) {
    if (!label) return { ok: false, reason: 'no label' };
    const fp = manifestFingerprint(manifest);
    if (label.manifestChecksum !== fp) return { ok: false, reason: 'label does not match this manifest (content changed)' };
    const expected = fnv1a(fp + '|' + label.exportedBy + '|' + (label.at || '') + '|' + label.purpose);
    if (label.traceId !== expected) return { ok: false, reason: 'trace id altered' };
    return { ok: true, traceId: label.traceId };
  }

  return { CLASSIFICATIONS, fnv1a, manifestFingerprint, labelExport, verifyLabel };
}));
