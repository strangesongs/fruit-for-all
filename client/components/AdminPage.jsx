// The admin command center (/admin): reports, recent activity, finds to review and
// hidden finds. Desktop only; anyone who isn't an admin is sent back to the map.
// Plan: the "Admin command center plan" doc; screens: the design canvas.
// Loaded lazily from index.js, so visitors never download it.
import React, { Component } from 'react';
import '../stylesheets/admin.css';
import { API_BASE } from '../utils/config.js';
import { fetchWithRetry, fetchWithTimeout } from '../utils/network.js';
import { getAuthHeader, getUser, isAdmin, isAuthenticated, handleUnauthorized } from '../utils/auth.js';
import { MOBILE_QUERY } from '../utils/breakpoints.js';
import { logoSvg } from '../utils/logo.js';
import { familyOf, markSvg } from '../utils/fruitFamilies.js';
import { findPath } from '../utils/findLinks.js';
import {
  agoLabel, whenLabel, shortDate, todayLabel, countsLine, reportCountLabel, whoLabel,
  activityWords, reasonTag, hiddenReasonLabel, handledSummary,
} from '../utils/adminView.js';

const goToMap = () => window.location.replace('/');

function Rule({ thick }) {
  return (
    <div className={`admin-rule${thick ? ' admin-rule--thick' : ''}`} aria-hidden="true">
      <span /><span />
    </div>
  );
}

// The thin meandering rule between catalog entries.
function Meander() {
  return (
    <svg className="admin-meander" viewBox="0 0 600 6" preserveAspectRatio="none" aria-hidden="true">
      <path d="M0 3 C72 1 124 5 200 3 C284 1 356 5 440 3 C516 1 564 4 600 3" />
    </svg>
  );
}

function Mark({ fruitType, size = 40 }) {
  return (
    <span
      className="admin-mark"
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: markSvg(familyOf(fruitType), { size, strokeWidth: 1.5, block: true }) }}
    />
  );
}

export default class AdminPage extends Component {
  constructor(props) {
    super(props);
    this.state = {
      narrow: typeof window !== 'undefined' && window.matchMedia(MOBILE_QUERY).matches,
      status: 'loading', // loading | ready | error
      error: '',
      data: null,
      busy: null, // the key of the action in flight
      rowErrors: {}, // key → message, shown next to that row's buttons
      showHandled: false,
    };
    this._requests = new Set();
    this._scrolled = false;
  }

  componentDidMount() {
    document.title = 'command center · fruit for all';
    if (!isAuthenticated() || !isAdmin()) {
      goToMap();
      return;
    }
    this._mql = window.matchMedia(MOBILE_QUERY);
    this._mql.addEventListener?.('change', this.syncNarrow);
    if (!this.state.narrow) this.load();
  }

  componentWillUnmount() {
    this._mql?.removeEventListener?.('change', this.syncNarrow);
    this._requests.forEach((c) => c.abort());
  }

  syncNarrow = () => {
    const narrow = this._mql.matches;
    this.setState({ narrow });
    if (!narrow && !this.state.data) this.load();
  };

  track() {
    const c = new AbortController();
    this._requests.add(c);
    return c;
  }

  load = async () => {
    const c = this.track();
    try {
      const res = await fetchWithRetry(`${API_BASE}/api/admin/overview`, {
        headers: getAuthHeader(),
        cache: 'no-store',
        signal: c.signal,
      });
      if (handleUnauthorized(res) || res.status === 404) {
        goToMap(); // signed out, or no longer an admin
        return;
      }
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body.success) {
        this.setState({ status: this.state.data ? 'ready' : 'error', error: body.message || 'the command center could not load. try again in a moment.' });
        return;
      }
      this.setState({ status: 'ready', error: '', data: body }, this.scrollToHash);
    } catch (err) {
      if (c.signal.aborted) return;
      this.setState({ status: this.state.data ? 'ready' : 'error', error: 'the command center could not load. check the connection and try again.' });
    } finally {
      this._requests.delete(c);
    }
  };

  // The report email links to /admin#reports.
  scrollToHash = () => {
    if (this._scrolled) return;
    this._scrolled = true;
    const id = window.location.hash.slice(1);
    if (id) document.getElementById(id)?.scrollIntoView();
  };

  /** POST one action (never retried), then reload. */
  act = async (key, path) => {
    if (this.state.busy) return;
    this.setState((s) => ({ busy: key, rowErrors: { ...s.rowErrors, [key]: '' } }));
    const c = this.track();
    try {
      const res = await fetchWithTimeout(`${API_BASE}${path}`, {
        method: 'POST',
        headers: getAuthHeader(),
        signal: c.signal,
      });
      if (handleUnauthorized(res)) {
        goToMap();
        return;
      }
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body.success) {
        const message = res.status === 404
          ? 'already done, or it’s gone. the list has been refreshed.'
          : (body.message || 'that didn’t work. try again.').toLowerCase();
        this.setState((s) => ({ rowErrors: { ...s.rowErrors, [key]: message } }));
      }
      await this.load();
    } catch (err) {
      if (!c.signal.aborted) {
        this.setState((s) => ({ rowErrors: { ...s.rowErrors, [key]: 'that didn’t work. check the connection and try again.' } }));
      }
    } finally {
      this._requests.delete(c);
      this.setState({ busy: null });
    }
  };

  renderHead() {
    const { data } = this.state;
    return (
      <header className="admin-head">
        <span className="admin-logo" dangerouslySetInnerHTML={{ __html: logoSvg({ size: 46 }) }} />
        <div className="admin-head__text">
          <h1 className="admin-title">fruit for all <span>· admin</span></h1>
          <p className="admin-head__line">
            {todayLabel()}
            {data && <> · {countsLine(data.counts)}</>}
          </p>
        </div>
        <a className="admin-btn admin-btn--outline" href="/">back to the map</a>
      </header>
    );
  }

  renderSectionHead(title, note, id) {
    return (
      <>
        <div className="admin-section__head">
          <h2 id={id} className="admin-section__title">{title}</h2>
          {note && <span className="admin-section__note">{note}</span>}
        </div>
        <Rule />
      </>
    );
  }

  renderRowError(key) {
    const message = this.state.rowErrors[key];
    return message ? <p className="admin-row-error" role="alert">{message}</p> : null;
  }

  renderReports() {
    const { data, busy, showHandled } = this.state;
    const reports = data.reports || [];
    const handled = data.handled || { count: 0, recent: [] };
    return (
      <section className="admin-section" aria-labelledby="reports">
        {this.renderSectionHead('reports', reports.length ? `${reports.length} open · newest first` : 'nothing open', 'reports')}
        {reports.length === 0 && (
          <p className="admin-aside">nothing to look at. a report lands here when someone says a find is gone, private, unsafe or misnamed.</p>
        )}
        {reports.map((r) => {
          const handleKey = `handle-${r.id}`;
          const hideKey = `hide-${r.pinId}`;
          return (
            <React.Fragment key={r.id}>
              <article className="admin-report">
                <Mark fruitType={r.fruitType} />
                <div className="admin-report__body">
                  <div className="admin-report__top">
                    <span className="admin-report__kind">{r.fruitType}</span>
                    <span className="admin-tag">{reasonTag(r.reason)}</span>
                    <span className="admin-muted">{reportCountLabel(r.reportsOnFind)}</span>
                  </div>
                  {r.note && <p className="admin-note">{r.note}</p>}
                  <span className="admin-muted admin-small">
                    reported {agoLabel(r.createdAt)} · added by {r.addedBy}, {shortDate(r.findAddedAt)}
                  </span>
                  <div className="admin-actions">
                    <button
                      type="button"
                      className="admin-btn"
                      disabled={!!busy}
                      onClick={() => this.act(handleKey, `/api/admin/reports/${r.id}/handle`)}
                    >{busy === handleKey ? 'saving…' : 'handled, it’s fine'}</button>
                    <button
                      type="button"
                      className="admin-btn admin-btn--outline"
                      disabled={!!busy}
                      onClick={() => this.act(hideKey, `/api/admin/pins/${r.pinId}/hide`)}
                    >{busy === hideKey ? 'hiding…' : 'hide the find'}</button>
                    <a className="admin-link" href={findPath(r.pinId)}>open on the map →</a>
                  </div>
                  {this.renderRowError(handleKey)}
                  {this.renderRowError(hideKey)}
                </div>
              </article>
              <Meander />
            </React.Fragment>
          );
        })}
        {handled.count > 0 && (
          <div className="admin-fold">
            <button
              type="button"
              className="admin-fold__toggle"
              aria-expanded={showHandled}
              onClick={() => this.setState({ showHandled: !showHandled })}
            >
              {showHandled ? '▾' : '▸'} handled ({handled.count})
            </button>
            {!showHandled && <span className="admin-muted"> · {handledSummary(handled)}</span>}
            {showHandled && (
              <ul className="admin-fold__list">
                {handled.recent.map((h) => (
                  <li key={h.id}>
                    <span className="admin-muted">{shortDate(h.handledAt)}</span> {h.fruitType} · {reasonTag(h.reason)} ·{' '}
                    {h.outcome === 'hidden' ? 'hidden' : 'kept'}
                    {h.handledBy ? ` by ${whoLabel(h.handledBy, getUser()?.userName)}` : ''}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </section>
    );
  }

  renderActivity() {
    const me = getUser()?.userName;
    const activity = this.state.data.activity || [];
    return (
      <section className="admin-section" aria-labelledby="activity">
        {this.renderSectionHead('recent activity', 'last 50 · newest first', 'activity')}
        {activity.length === 0 && <p className="admin-aside">nothing has happened yet.</p>}
        <ul className="admin-activity">
          {activity.map((a, i) => {
            const words = activityWords(a);
            return (
              <li className="admin-activity__row" key={`${a.at}-${a.kind}-${a.pinId}-${i}`}>
                <span className="admin-muted">{whenLabel(a.at)}</span>
                <span className="admin-activity__what">{words.what}</span>
                <span className="admin-activity__kind">
                  {a.fruitType} {words.detail && <span className="admin-muted admin-small">{words.detail}</span>}
                </span>
                <span className="admin-activity__who">{whoLabel(a.by, me)}</span>
                {a.onMap
                  ? <a className="admin-link admin-small" href={findPath(a.pinId)}>open</a>
                  : <span className="admin-muted admin-small">{a.kind === 'deleted' ? 'gone' : 'hidden'}</span>}
              </li>
            );
          })}
        </ul>
      </section>
    );
  }

  renderReview() {
    const { data, busy } = this.state;
    const stale = data.stale || [];
    const hidden = data.hidden || [];
    return (
      <section className="admin-section" aria-labelledby="review">
        {this.renderSectionHead('finds to review', stale.length ? 'no sign of life in 6 months · oldest first' : '', 'review')}
        {stale.length === 0 && (
          <p className="admin-aside">nothing to review yet. a find lands here after six months with no “still good”.</p>
        )}
        {stale.map((s) => {
          const thereKey = `there-${s.pinId}`;
          const hideKey = `hide-${s.pinId}`;
          return (
            <div className="admin-stale" key={s.pinId}>
              <div className="admin-stale__top">
                <span className="admin-stale__kind">{s.fruitType}</span>
                <span className="admin-muted admin-small">last sign of life {shortDate(s.lastSign)} · added by {s.addedBy}</span>
              </div>
              <div className="admin-actions">
                <button type="button" className="admin-btn" disabled={!!busy}
                  onClick={() => this.act(thereKey, `/api/admin/pins/${s.pinId}/still-there`)}
                >{busy === thereKey ? 'saving…' : 'still there'}</button>
                <button type="button" className="admin-btn admin-btn--outline" disabled={!!busy}
                  onClick={() => this.act(hideKey, `/api/admin/pins/${s.pinId}/hide`)}
                >{busy === hideKey ? 'hiding…' : 'hide'}</button>
                <a className="admin-link" href={findPath(s.pinId)}>open on the map →</a>
              </div>
              {this.renderRowError(thereKey)}
              {this.renderRowError(hideKey)}
            </div>
          );
        })}

        <h3 className="admin-subhead">hidden ({hidden.length})</h3>
        {hidden.length === 0 && <p className="admin-muted admin-small">none. a hidden find is off the map and its link until you put it back.</p>}
        {hidden.map((h) => {
          const key = `restore-${h.pinId}`;
          return (
            <div className="admin-hidden" key={h.pinId}>
              <span className="admin-hidden__kind">{h.fruitType}</span>
              <span className="admin-muted admin-small admin-hidden__meta">
                {[h.hiddenAt ? `hidden ${shortDate(h.hiddenAt)}` : 'hidden', hiddenReasonLabel(h.reason)].filter(Boolean).join(' · ')}
              </span>
              <button type="button" className="admin-btn admin-btn--outline admin-btn--small" disabled={!!busy}
                onClick={() => this.act(key, `/api/admin/pins/${h.pinId}/restore`)}
              >{busy === key ? 'putting back…' : 'put it back'}</button>
              {this.renderRowError(key)}
            </div>
          );
        })}
      </section>
    );
  }

  render() {
    const { narrow, status, error, data } = this.state;
    if (narrow) {
      return (
        <main className="admin-narrow">
          <span className="admin-logo" dangerouslySetInnerHTML={{ __html: logoSvg({ size: 56 }) }} />
          <Rule thick />
          <h1 className="admin-narrow__title">the command center is for a computer.</h1>
          <p className="admin-note">open fruitforall.app/admin on a laptop or desktop. reports still reach you by email.</p>
          <a className="admin-btn" href="/">back to the map</a>
        </main>
      );
    }
    return (
      <main className="admin-page">
        <div className="admin-wrap">
          {this.renderHead()}
          <Rule thick />
          {error && <p className="admin-error" role="alert">{error}</p>}
          {status === 'loading' && <p className="admin-muted" aria-live="polite">loading…</p>}
          {status === 'error' && (
            <button type="button" className="admin-btn admin-btn--outline" onClick={() => { this.setState({ status: 'loading' }); this.load(); }}>
              try again
            </button>
          )}
          {data && (
            <div className="admin-columns">
              <div className="admin-col admin-col--wide">
                {this.renderReports()}
                {this.renderActivity()}
              </div>
              <div className="admin-col">
                {this.renderReview()}
              </div>
            </div>
          )}
        </div>
      </main>
    );
  }
}
