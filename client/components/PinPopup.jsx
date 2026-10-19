import React, { useState, useCallback } from 'react';

import { isInSeason, getSeasonDisplay } from '../utils/fruitSeasons.js';
import { familyOf, familyLabel, markSvg } from '../utils/fruitFamilies.js';
import { seasonMonthsFor, seasonRangeText } from '../utils/pinSummary.js';
import { API_BASE } from '../utils/config.js';

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

export default function PinPopup({
  pin,
  isMyPin,
  isAdmin,
  editingPinId,
  editingNotes,
  startEditingNotes,
  cancelEditingNotes,
  saveEditedNotes,
  deletePin,
  setEditingNotes,
}) {
  // Hooks must run before any early return (rules of hooks).
  const [confirmations, setConfirmations] = useState(pin?.confirmations || []);
  const [confirmed, setConfirmed] = useState(() => {
    if (!pin) return false;
    try { return !!localStorage.getItem(storageKey(pin.pinId)); } catch { return false; }
  });
  const [confirmError, setConfirmError] = useState(null);

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

  if (!pin) return null;

  const currentMonth = new Date().getMonth() + 1;
  const fruit = pin.fruitTypeDisplay?.toLowerCase?.() || pin.fruitType?.toLowerCase?.() || 'find';
  const family = familyOf(pin.fruitType);
  const seasonMonths = seasonMonthsFor(pin.fruitType, pin.zone);
  const inSeason = seasonMonths ? isInSeason(pin.fruitType, pin.zone, currentMonth) : null;
  const display = pin.fruitType ? getSeasonDisplay(pin.fruitType) : null;
  const generalSeason = display && display !== 'Unknown season' ? display.toLowerCase() : null;
  const seasonText = seasonMonths
    ? `${seasonRangeText(seasonMonths)} here${pin.zone ? ` (zone ${pin.zone})` : ''}`
    : generalSeason || 'season varies';
  const seasonSet = new Set(seasonMonths || []);

  const freshness = freshnessText(confirmations);
  const added = pin.createdAt
    ? new Date(pin.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).toLowerCase()
    : null;
  const directionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${pin.coordinates.lat},${pin.coordinates.lng}`;
  const canEdit = isMyPin || isAdmin;

  return (
    <div className="pin-popup pin-entry">
      <div className="entry-head">
        <span className="entry-kind">{familyLabel(family)}</span>
        <div className="entry-title">
          <span className="entry-mark" aria-hidden="true"
            dangerouslySetInnerHTML={{ __html: markSvg(family, { size: 30, strokeWidth: 1.5 }) }} />
          <h3 className="fruit-title">{fruit}</h3>
        </div>
      </div>
      <div className="entry-rules" aria-hidden="true"><span /><span /></div>

      <div className="entry-notes">
        {editingPinId === pin.pinId ? (
          <div className="edit-notes-box">
            <textarea
              value={editingNotes}
              onChange={(e) => setEditingNotes(e.target.value)}
              className="notes-textarea"
              aria-label="notes"
              maxLength={1000}
            />
            <div className="edit-notes-actions">
              <button onClick={() => saveEditedNotes(pin.pinId)} className="save-notes-btn">save</button>
              <button onClick={cancelEditingNotes} className="cancel-notes-btn">cancel</button>
            </div>
          </div>
        ) : pin.notes ? (
          <>
            {canEdit ? (
              <button
                type="button"
                className="pin-notes clickable-notes pin-notes-btn"
                onClick={() => startEditingNotes(pin.pinId, pin.notes)}
                title="edit notes"
              >
                {pin.notes}
              </button>
            ) : (
              <p className="pin-notes">{pin.notes}</p>
            )}
            {pin.submittedBy && <span className="entry-signature">—{pin.submittedBy}{added ? `, ${added.replace(/, \d{4}$/, '')}` : ''}</span>}
          </>
        ) : canEdit ? (
          <button
            type="button"
            className="pin-notes add-notes-prompt pin-notes-btn"
            onClick={() => startEditingNotes(pin.pinId, '')}
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
            {inSeason === true && <> · <strong className="entry-ripe">ripe now</strong></>}
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
          know the plant for certain before you pick it, and check with a clinician before using it as medicine.
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

      {canEdit && (
        <div className="pin-actions">
          <button className="delete-pin-btn" onClick={() => deletePin(pin.pinId)}>delete this find</button>
        </div>
      )}
    </div>
  );
}
