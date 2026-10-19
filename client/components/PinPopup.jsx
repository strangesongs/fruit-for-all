import React, { useState, useCallback } from 'react';

import SeasonStrip from './SeasonStrip.jsx';
import { getSeasonForZone, isInSeason, getSeasonDisplay } from '../utils/fruitSeasons.js';
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
  return `confirmed ${relativeTime(latest.timestamp)} by ${n} ${n === 1 ? 'neighbor' : 'neighbors'}`;
}

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

  // Season data: these helpers used to be called as window.* globals that were never
  // defined, so every pin with a zone rendered as "out of season".
  const currentMonth = new Date().getMonth() + 1;
  const seasonMonths = pin.zone && pin.fruitType ? getSeasonForZone(pin.fruitType, pin.zone) : null;
  // No zone data for this fruit → null, so SeasonStrip shows the general season instead.
  const inSeason = seasonMonths ? isInSeason(pin.fruitType, pin.zone, currentMonth) : null;
  // getSeasonDisplay returns "Unknown season" for fruit without data; let SeasonStrip say "season varies".
  const display = pin.fruitType ? getSeasonDisplay(pin.fruitType) : null;
  const generalSeason = display && display !== 'Unknown season' ? display : null;

  const freshness = freshnessText(confirmations);
  const showConfirmSection = !confirmed || freshness || confirmed;

  return (
    <div className="pin-popup">
      <div className="popup-header">
        <h3 className="fruit-title">
          {pin.fruitTypeDisplay?.toLowerCase?.() || pin.fruitType?.toLowerCase?.()}
        </h3>
        <SeasonStrip
          inSeason={inSeason}
          seasonMonths={seasonMonths}
          generalSeason={generalSeason}
          currentMonth={currentMonth}
        />
      </div>
      <div className="popup-content">
        {(pin.notes || editingPinId === pin.pinId || isMyPin || isAdmin) && (
          <div className="notes-section">
            <strong>notes:</strong>
            {editingPinId === pin.pinId ? (
              <div className="edit-notes-box">
                <textarea
                  value={editingNotes}
                  onChange={(e) => setEditingNotes(e.target.value)}
                  className="notes-textarea"
                />
                <div className="edit-notes-actions">
                  <button onClick={() => saveEditedNotes(pin.pinId)} className="save-notes-btn">
                    save
                  </button>
                  <button onClick={cancelEditingNotes} className="cancel-notes-btn">
                    cancel
                  </button>
                </div>
              </div>
            ) : pin.notes ? (
              isMyPin || isAdmin ? (
                <button
                  type="button"
                  className="pin-notes clickable-notes pin-notes-btn"
                  onClick={() => startEditingNotes(pin.pinId, pin.notes)}
                  title="Click to edit"
                >
                  {pin.notes}
                </button>
              ) : (
                <p className="pin-notes">{pin.notes}</p>
              )
            ) : isMyPin || isAdmin ? (
              <button
                type="button"
                className="pin-notes add-notes-prompt pin-notes-btn"
                onClick={() => startEditingNotes(pin.pinId, '')}
              >
                + add notes
              </button>
            ) : null}
          </div>
        )}

        {showConfirmSection && (
          <div className="confirm-section">
            {!confirmed && (
              <button
                type="button"
                className="still-good-btn"
                onClick={handleConfirm}
              >
                still good? →
              </button>
            )}
            {freshness && <p className="freshness-line">{freshness}</p>}
            {confirmed && !freshness && (
              <p className="freshness-line">you said still good</p>
            )}
            {confirmError && <p className="freshness-line confirm-error">{confirmError}</p>}
          </div>
        )}

        <details className="metadata-details">
          <summary className="metadata-summary">details</summary>
          <div className="metadata-grid">
            <div className="metadata-item">
              <strong>location:</strong>
              <span>
                {pin.coordinates.lat.toFixed(4)}, {pin.coordinates.lng.toFixed(4)}
              </span>
            </div>
            <div className="metadata-item">
              <strong>added by:</strong>
              <span>{pin.submittedBy || 'anonymous'}</span>
            </div>
            <div className="metadata-item">
              <strong>date:</strong>
              <span>
                {new Date(pin.createdAt).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric',
                })}
              </span>
            </div>
          </div>
        </details>

        {(isMyPin || isAdmin) && (
          <div className="pin-actions">
            <button className="delete-pin-btn" onClick={() => deletePin(pin.pinId)}>
              delete pin
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
