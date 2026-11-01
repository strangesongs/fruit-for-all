import React, { useState, useCallback, useEffect, useRef } from 'react';

import { familyOf, familyLabel, markSvg } from '../utils/fruitFamilies.js';
import { seasonInfoFor, seasonLine, zoneOf } from '../utils/pinSummary.js';
import { API_BASE } from '../utils/config.js';
import {
  findUrl, findSummary, REPORT_REASONS, REPORT_NOTE_MAX, validateReport,
} from '../utils/findLinks.js';

function relativeTime(isoString) {
  const diff = Date.now() - new Date(isoString).getTime();
  const m = 60 * 1000;
  const h = 60 * m;
  const d = 24 * h;
  const w = 7 * d;
  if (diff < h) return 'just now';
  if (diff < 2 * h) return '1 hour ago';
  if (diff < d) return `${Math.floor(diff / h)} hours ago`;
  if (diff < 2 * d) return 'yesterday';
  if (diff < w) return `${Math.floor(diff / d)} days ago`;
  if (diff < 2 * w) return '1 week ago';
  if (diff < 5 * w) return `${Math.floor(diff / w)} weeks ago`;
  const months = Math.round(diff / (30 * d));
  if (months < 2) return '1 month ago';
  if (months < 12) return `${months} months ago`;
  const years = Math.round(diff / (365 * d));
  return years < 2 ? '1 year ago' : `${years} years ago`;
}

function freshnessText(confirmations) {
  if (!confirmations || confirmations.length === 0) return null;
  const latest = confirmations.reduce((a, b) =>
    new Date(a.timestamp) > new Date(b.timestamp) ? a : b,
  );
  const n = confirmations.length;
  return `still good, says ${n} ${n === 1 ? 'neighbor' : 'neighbors'} · last ${relativeTime(latest.timestamp)}`;
}

const MONTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

function storageKey(pinId) {
  return `loquat_confirmed_${pinId}`;
}

// The nearest ancestor that scrolls (the card on phones, or Leaflet's wrapper), or null.
function scrollBoxOf(el) {
  let box = el.parentElement;
  while (box && box !== document.body && !(box.scrollHeight > box.clientHeight + 1
    && /(auto|scroll)/.test(getComputedStyle(box).overflowY))) box = box.parentElement;
  return box && box !== document.body ? box : null;
}

export default function PinPopup({
  pin,
  isMyPin,
  isAdmin,
  onEdit,
  deletePin,
}) {
  // Hooks must run before any early return (rules of hooks).
  const [confirmations, setConfirmations] = useState(pin?.confirmations || []);
  const [confirmed, setConfirmed] = useState(() => {
    if (!pin) return false;
    try { return !!localStorage.getItem(storageKey(pin.pinId)); } catch { return false; }
  });
  const [confirmError, setConfirmError] = useState(null);
  // Delete asks first, in the popup ('ask'), then shows any error ('busy' while it runs).
  const [deleteState, setDeleteState] = useState('idle');
  const [deleteError, setDeleteError] = useState(null);
  // Share: the system share sheet, else copy the link, else show it to copy by hand.
  const [shareNote, setShareNote] = useState(null); // 'copied' | { url }
  // Report: 'idle' → 'open' (the form) → 'busy' → 'sent'
  const [reportState, setReportState] = useState('idle');
  const [reportReason, setReportReason] = useState(null);
  const [reportNote, setReportNote] = useState('');
  const [reportError, setReportError] = useState(null);

  // The card can grow after it opens (delete asks, "thanks for checking", an error).
  // Leaflet grows a popup upwards from its pin, so tell the map to keep it on screen.
  const rootRef = useRef(null);
  useEffect(() => {
    const el = rootRef.current;
    if (!el || typeof ResizeObserver !== 'function') return undefined;
    let lastH = null;
    let frame = 0;
    const ro = new ResizeObserver(() => {
      const h = el.getBoundingClientRect().height;
      if (lastH !== null && Math.abs(h - lastH) > 1) {
        cancelAnimationFrame(frame);
        frame = requestAnimationFrame(() => window.dispatchEvent(new CustomEvent('ffa:popup-resize')));
      }
      lastH = h;
    });
    ro.observe(el);
    return () => { ro.disconnect(); cancelAnimationFrame(frame); };
  }, []);

  const handleConfirm = useCallback(async () => {
    if (!pin || confirmed) return;

    // optimistic update — show feedback immediately
    const optimistic = [...confirmations, { timestamp: new Date().toISOString(), anonymous: true }];
    setConfirmations(optimistic);
    setConfirmed(true);
    setConfirmError(null);
    localStorage.setItem(storageKey(pin.pinId), new Date().toISOString());

    try {
      const res = await fetch(`${API_BASE}/api/pins/${encodeURIComponent(pin.pinId)}/confirm`, { method: 'POST' });
      if (res.status === 429) {
        // revert
        setConfirmations(pin.confirmations || []);
        setConfirmed(false);
        localStorage.removeItem(storageKey(pin.pinId));
        setConfirmError('too many confirmations — try again later');
        return;
      }
      if (res.status === 409) {
        // already confirmed from this IP — keep the optimistic confirmed state, no error
        return;
      }
      if (!res.ok) {
        // revert
        setConfirmations(pin.confirmations || []);
        setConfirmed(false);
        localStorage.removeItem(storageKey(pin.pinId));
        setConfirmError('something went wrong');
        return;
      }
      // reconcile with server response
      const data = await res.json();
      if (data.confirmations?.length) {
        setConfirmations(data.confirmations);
      }
    } catch {
      // revert on network failure
      setConfirmations(pin.confirmations || []);
      setConfirmed(false);
      localStorage.removeItem(storageKey(pin.pinId));
      setConfirmError('something went wrong');
    }
  }, [confirmed, confirmations, pin]);

  // The report form opens below the fold of a tall card on a phone (the card scrolls
  // inside its max-height): bring the form to the top of the card.
  const reportRef = useRef(null);
  useEffect(() => {
    if (reportState !== 'open' || !reportRef.current) return;
    const form = reportRef.current;
    const box = scrollBoxOf(form);
    if (!box) return;
    const top = form.getBoundingClientRect().top - box.getBoundingClientRect().top + box.scrollTop - 8;
    box.scrollTo({ top, behavior: 'smooth' });
  }, [reportState === 'open']);

  // "delete this … for good?" replaces the edit/delete row at the very bottom of the
  // card; on a phone that's below the card's max-height, so its buttons were cut off.
  // Scroll the card until the whole question and its buttons (and any error) show.
  const deleteAskRef = useRef(null);
  useEffect(() => {
    if (deleteState !== 'ask' || !deleteAskRef.current) return undefined;
    const frame = requestAnimationFrame(() => {
      const ask = deleteAskRef.current;
      const box = ask && scrollBoxOf(ask);
      if (!box) return;
      const over = ask.getBoundingClientRect().bottom - box.getBoundingClientRect().bottom + 8;
      if (over > 0) box.scrollTo({ top: box.scrollTop + over, behavior: 'smooth' });
    });
    return () => cancelAnimationFrame(frame);
  }, [deleteState, deleteError]);

  const handleShare = useCallback(async () => {
    if (!pin) return;
    const url = findUrl(window.location.origin, pin.pinId);
    const { title } = findSummary(pin, new Date().getMonth() + 1);
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({ title, url });
        return;
      } catch (e) {
        if (e && e.name === 'AbortError') return; // they closed the sheet
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setShareNote('copied');
    } catch {
      setShareNote({ url });
    }
  }, [pin]);

  const sendReport = useCallback(async () => {
    if (!pin) return;
    const check = validateReport({ reason: reportReason, note: reportNote });
    if (!check.valid) {
      setReportError(reportReason ? 'say a few words about what’s wrong.' : 'choose what’s wrong.');
      return;
    }
    setReportState('busy');
    setReportError(null);
    try {
      // Not auto-retried: it's a POST.
      const res = await fetch(`${API_BASE}/api/pins/${encodeURIComponent(pin.pinId)}/report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(check.report),
      });
      if (res.ok || res.status === 409) {
        setReportState('sent');
        return;
      }
      setReportState('open');
      if (res.status === 429) setReportError('too many reports from here. try again later.');
      else if (res.status === 404) setReportError('this find is no longer on the map.');
      else setReportError('couldn’t send it. try again in a moment.');
    } catch {
      setReportState('open');
      setReportError('couldn’t reach fruit for all. check your connection and try again.');
    }
  }, [pin, reportReason, reportNote]);

  if (!pin) return null;

  const currentMonth = new Date().getMonth() + 1;
  const fruit = pin.fruitTypeDisplay?.toLowerCase?.() || pin.fruitType?.toLowerCase?.() || 'find';
  const family = familyOf(pin.fruitType);
  const zone = zoneOf(pin);
  const season = seasonInfoFor(pin.fruitType, zone);
  const seasonMonths = season ? season.months : null;
  const inSeason = seasonMonths ? seasonMonths.includes(currentMonth) : null;
  const seasonText = season ? seasonLine(season, zone) : 'season varies';
  const seasonSet = new Set(seasonMonths || []);

  const freshness = freshnessText(confirmations);
  const added = pin.createdAt
    ? new Date(pin.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).toLowerCase()
    : null;
  const directionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${pin.coordinates.lat},${pin.coordinates.lng}`;
  const canEdit = isMyPin || isAdmin;

  return (
    <div className="pin-popup pin-entry" ref={rootRef}>
      <div className="entry-head">
        <span className="entry-kind">{familyLabel(family)}</span>
        <div className="entry-title">
          <span className="entry-mark" aria-hidden="true"
            dangerouslySetInnerHTML={{ __html: markSvg(family, { size: 40, strokeWidth: 1.3, block: true }) }} />
          <h3 className="fruit-title">{fruit}</h3>
        </div>
      </div>
      <div className="entry-rules" aria-hidden="true"><span /><span /></div>

      <div className="entry-notes">
        {pin.notes ? (
          <>
            <p className="pin-notes">{pin.notes}</p>
            {pin.submittedBy && <span className="entry-signature">—{pin.submittedBy}{added ? `, ${added.replace(/, \d{4}$/, '')}` : ''}</span>}
          </>
        ) : canEdit ? (
          <button
            type="button"
            className="pin-notes add-notes-prompt pin-notes-btn"
            onClick={() => onEdit && onEdit(pin)}
          >
            + add a note: what's there, how to reach it
          </button>
        ) : (
          <p className="pin-notes pin-notes--empty">no notes yet.</p>
        )}
      </div>

      <svg className="entry-meander" viewBox="0 0 300 6" preserveAspectRatio="none" aria-hidden="true">
        <path d="M0 3 C36 1 62 5 100 3 C142 1 178 5 220 3 C258 1 282 4 300 3" />
      </svg>

      <dl className="entry-facts">
        <dt>season</dt>
        <dd>
          <span>
            {seasonText}
            {inSeason === true && <> · <strong className="entry-ripe">in season</strong></>}
          </span>
          {seasonMonths && (
            <span className="entry-band" aria-hidden="true">
              {MONTHS.map((m) => (
                <i key={m} className={`${seasonSet.has(m) ? 'on' : ''}${m === currentMonth ? ' now' : ''}`} />
              ))}
            </span>
          )}
        </dd>
        <dt>vouched</dt>
        <dd>{freshness || (confirmed ? 'you said still good' : 'nobody has checked in yet')}</dd>
        {added && (
          <>
            <dt>added</dt>
            <dd>{added}</dd>
          </>
        )}
      </dl>

      {family === 'medicinal' && (
        <p className="entry-caution">
          know the plant for certain before you pick it, take only a little from each plant, and check with a clinician before using it as medicine.
        </p>
      )}

      <div className="entry-actions">
        {!confirmed ? (
          <button type="button" className="still-good-btn" onClick={handleConfirm}>still good →</button>
        ) : (
          <span className="entry-thanks">thanks for checking</span>
        )}
        <a className="entry-directions" href={directionsUrl} target="_blank" rel="noopener noreferrer">directions</a>
      </div>
      {confirmError && <p className="freshness-line confirm-error">{confirmError}</p>}

      {reportState === 'idle' && (
        <div className="entry-links">
          <button type="button" className="entry-link" onClick={handleShare}>share</button>
          {!canEdit && (
            // A tick's wait, as with delete: the click must land before the contents swap.
            <button type="button" className="entry-link"
              onClick={() => setTimeout(() => { setReportState('open'); setShareNote(null); }, 0)}>
              report a problem
            </button>
          )}
        </div>
      )}
      {reportState === 'idle' && shareNote === 'copied' && (
        <p className="entry-share-note" role="status">link copied. paste it anywhere.</p>
      )}
      {reportState === 'idle' && shareNote && shareNote.url && (
        <label className="entry-share-note">
          copy this link:
          <input className="entry-share-url" readOnly value={shareNote.url}
            onFocus={(e) => e.target.select()} />
        </label>
      )}

      {(reportState === 'open' || reportState === 'busy') && (
        <form className="entry-report" ref={reportRef} onSubmit={(e) => { e.preventDefault(); sendReport(); }}>
          <fieldset disabled={reportState === 'busy'}>
            <legend>what’s wrong with this {fruit}?</legend>
            {REPORT_REASONS.map((r) => (
              <label key={r.id} className={`entry-report__reason${reportReason === r.id ? ' is-on' : ''}`}>
                <input type="radio" name={`report-${pin.pinId}`} value={r.id}
                  checked={reportReason === r.id}
                  onChange={() => { setReportReason(r.id); setReportError(null); }} />
                <span>{r.label}{r.hint && <small>{r.hint}</small>}</span>
              </label>
            ))}
            <textarea className="entry-report__note" rows={2} maxLength={REPORT_NOTE_MAX}
              placeholder={reportReason === 'other' ? 'what’s wrong?' : 'anything else? (optional)'}
              value={reportNote} onChange={(e) => setReportNote(e.target.value)} />
            <div className="entry-report__actions">
              <button type="submit" className="btn entry-report__send">
                {reportState === 'busy' ? 'sending…' : 'send report'}
              </button>
              <button type="button" className="btn entry-report__cancel"
                onClick={() => setTimeout(() => { setReportState('idle'); setReportError(null); }, 0)}>
                never mind
              </button>
            </div>
            {reportError && <p className="entry-report__error" role="alert">{reportError}</p>}
          </fieldset>
        </form>
      )}
      {reportState === 'sent' && (
        <p className="entry-report-thanks" role="status">thanks for telling us. we’ll take a look.</p>
      )}

      {canEdit && (
        deleteState === 'idle' ? (
          <div className="pin-actions">
            <button type="button" className="btn pin-edit-btn" onClick={() => onEdit && onEdit(pin)}>edit</button>
            {/* Swapping the popup's contents inside the click detaches the button before
                Leaflet sees the click (it then closes the popup), so wait a tick. */}
            <button type="button" className="btn delete-pin-btn" onClick={() => setTimeout(() => setDeleteState('ask'), 0)}>delete</button>
          </div>
        ) : (
          <div className="pin-actions pin-actions--confirm" role="group" aria-label="delete this find?" ref={deleteAskRef}>
            <p className="pin-delete-ask">delete this {fruit} for good?</p>
            <button type="button" className="btn delete-pin-btn delete-pin-btn--confirm" disabled={deleteState === 'busy'}
              onClick={async () => {
                setDeleteState('busy');
                setDeleteError(null);
                const r = await deletePin(pin.pinId);
                if (r && !r.ok) { setDeleteState('ask'); setDeleteError(r.message); }
              }}>
              {deleteState === 'busy' ? 'deleting…' : 'delete'}
            </button>
            <button type="button" className="btn delete-pin-btn" disabled={deleteState === 'busy'}
              onClick={() => setTimeout(() => { setDeleteState('idle'); setDeleteError(null); }, 0)}>keep it</button>
            {deleteError && <p className="pin-delete-error" role="alert">{deleteError}</p>}
          </div>
        )
      )}
    </div>
  );
}
