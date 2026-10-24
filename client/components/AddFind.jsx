import React from 'react';
import { getAuthHeader, handleUnauthorized } from '../utils/auth.js';
import { API_BASE } from '../utils/config.js';
import { fetchWithRetry } from '../utils/network.js';
import { containsProfanity } from '../utils/profanity.js';
import { familyOf, familyLabel, markSvg } from '../utils/fruitFamilies.js';
import { FRUIT_LIST } from '../utils/fruitList.js';
import { groupedKinds, searchKinds } from '../utils/kindSearch.js';
import { isAppleMobile, locateErrorMessage } from '../utils/geolocation.js';
import {
    NUDGE_LIMIT_M, describeOffset, formatFeet, nearbySameKind, saveErrorMessage,
} from '../utils/findPlacement.js';
import { MAX_NOTES_CHARS } from '../../server/schemas/validation.js';

import '../stylesheets/addFind.css';

// Add a find (or edit one you added). It takes over the screen and talks to the map
// with window events (map.jsx):
//   → ffa:place-start { origin, start, limitM, family, from, pinId }  map: fixed pin, range circle
//   ← ffa:place-move  { lat, lng, distanceM, atLimit, nearby } where the pin is now
//   → ffa:place-spot  { lat, lng, sheetPx, family, pan, pinId } map: the chosen spot, above the sheet
//   → ffa:place-end                                             map: back to normal
//   → ffa:find-saved  { pin, mode }                             map: show it, open its popup
//
// Steps: locating → (nolocation) → placing → details ⇄ kinds → saving.
// Adding starts at your GPS fix and lets you nudge the pin up to NUDGE_LIMIT_M (admin:
// anywhere). Editing starts at the details, with the find's own spot as the origin.

// A fresh, precise fix: this is where the find goes.
const FIX_OPTIONS = { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 };
const GROUPS = groupedKinds();

function emit(name, detail) {
    window.dispatchEvent(new CustomEvent(name, { detail }));
}

function Mark({ family, size = 20, block = true }) {
    return (
        <span className="add-find-mark" aria-hidden="true"
            dangerouslySetInnerHTML={{ __html: markSvg(family, { size, block }) }} />
    );
}

export default class AddFind extends React.Component {
    constructor(props) {
        super(props);
        const edit = props.mode === 'edit' && props.pin;
        this.state = edit ? {
            step: 'details',
            origin: { ...props.pin.coordinates },
            spot: { ...props.pin.coordinates },
            live: null,
            fruitType: String(props.pin.fruitType || '').toLowerCase(),
            notes: props.pin.notes || '',
            query: '',
            error: '',
            locError: '',
            nearby: [],
        } : {
            step: 'locating',
            origin: null,
            spot: null,
            live: null,      // last ffa:place-move while placing
            fruitType: '',
            notes: '',
            query: '',
            error: '',
            locError: '',
            nearby: [],
        };
        this.sheetRef = React.createRef();
        this.headRef = React.createRef();
        this.searchRef = React.createRef();
        this._controller = null;
        this._unmounted = false;
    }

    get isEdit() { return this.props.mode === 'edit' && !!this.props.pin; }
    get limitM() { return this.props.isAdmin ? null : NUDGE_LIMIT_M; }

    componentDidMount() {
        document.body.classList.add('ffa-adding');
        window.addEventListener('ffa:place-move', this.handlePlaceMove);
        document.addEventListener('keydown', this.handleKeyDown);
        if (this.isEdit) this.showSpot(true);
        else this.locate();
    }

    componentWillUnmount() {
        this._unmounted = true;
        document.body.classList.remove('ffa-adding');
        window.removeEventListener('ffa:place-move', this.handlePlaceMove);
        document.removeEventListener('keydown', this.handleKeyDown);
        if (this._controller) this._controller.abort();
        emit('ffa:place-end');
    }

    componentDidUpdate(prevProps, prevState) {
        const { step } = this.state;
        if (step !== prevState.step) {
            if (step === 'details' && prevState.step !== 'kinds') this.showSpot(true);
            if (step === 'kinds') {
                // Focus the search box (keyboard opens on phones; that's the point of it).
                setTimeout(() => this.searchRef.current && this.searchRef.current.focus(), 0);
            } else if (this.headRef.current) {
                this.headRef.current.focus({ preventScroll: true });
            }
        }
        if (step === 'details' && prevState.fruitType !== this.state.fruitType) this.showSpot(false);
    }

    // ── map ────────────────────────────────────────────────────────────────

    // Tell the map where the spot is and how much of the screen the sheet covers.
    showSpot = (pan) => {
        const { spot, fruitType } = this.state;
        if (!spot) return;
        requestAnimationFrame(() => {
            const el = this.sheetRef.current;
            const sheetPx = el ? Math.round(el.getBoundingClientRect().height) : 0;
            emit('ffa:place-spot', {
                lat: spot.lat, lng: spot.lng, sheetPx, pan,
                family: fruitType ? familyOf(fruitType) : 'seed',
                pinId: this.isEdit ? this.props.pin.pinId : null,
            });
        });
    };

    startPlacing = (start) => {
        const { origin, fruitType } = this.state;
        this.setState({ step: 'placing', live: null, error: '' });
        emit('ffa:place-start', {
            origin,
            start: start || origin,
            limitM: origin ? this.limitM : null,
            family: fruitType ? familyOf(fruitType) : 'seed',
            from: this.isEdit ? 'pin' : 'you',
            pinId: this.isEdit ? this.props.pin.pinId : null,
        });
    };

    handlePlaceMove = (e) => {
        if (this.state.step !== 'placing' || !e.detail) return;
        this.setState({ live: e.detail });
    };

    confirmSpot = () => {
        const { live } = this.state;
        if (!live) return;
        this.setState({
            step: 'details',
            spot: { lat: live.lat, lng: live.lng },
            nearby: Array.isArray(live.nearby) ? live.nearby : [],
        });
    };

    // ── location ───────────────────────────────────────────────────────────

    locate = () => {
        if (typeof navigator === 'undefined' || !navigator.geolocation) {
            this.setState({ step: 'nolocation', locError: 'this browser can’t share your location, so finds can’t be added from it.' });
            return;
        }
        this.setState({ step: 'locating', locError: '' });
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                if (this._unmounted) return;
                const origin = { lat: pos.coords.latitude, lng: pos.coords.longitude };
                try { sessionStorage.setItem('ffa_last_location', JSON.stringify(origin)); } catch (e) { /* private mode */ }
                this.setState({ origin }, () => this.startPlacing(origin));
            },
            (err) => {
                if (this._unmounted) return;
                const apple = isAppleMobile(navigator.userAgent, navigator.maxTouchPoints || 0);
                this.setState({ step: 'nolocation', locError: locateErrorMessage(err && err.code, { apple }) });
            },
            FIX_OPTIONS,
        );
    };

    // Admin only: no fix, so place it wherever the map is (no range).
    placeWithoutFix = () => {
        this.setState({ origin: null }, () => this.startPlacing(null));
    };

    // ── form ───────────────────────────────────────────────────────────────

    chooseKind = (kind) => {
        this.setState({ fruitType: kind, query: '', step: 'details', error: '' });
    };

    handleKeyDown = (e) => {
        if (e.key !== 'Escape') return;
        const { step } = this.state;
        if (step === 'saving') return;
        e.preventDefault();
        if (step === 'kinds') this.setState({ step: 'details', query: '' });
        else if (step === 'placing' && this.state.spot) this.setState({ step: 'details' });
        else this.cancel();
    };

    cancel = () => {
        if (this.state.step === 'saving') return;
        this.props.onClose();
    };

    // What an edit changes (only these are sent).
    changes() {
        const { pin } = this.props;
        const { spot, fruitType, notes } = this.state;
        const out = {};
        if (fruitType !== String(pin.fruitType || '').toLowerCase()) out.fruitType = fruitType;
        if (notes.trim() !== (pin.notes || '').trim()) out.notes = notes.trim();
        if (spot && (spot.lat !== pin.coordinates.lat || spot.lng !== pin.coordinates.lng)) out.coordinates = spot;
        return out;
    }

    save = async () => {
        const { spot, fruitType, notes } = this.state;
        if (!spot) { this.setState({ error: 'place the pin first.' }); return; }
        if (!FRUIT_LIST.includes(fruitType)) { this.setState({ error: 'choose what’s there from the list.' }); return; }
        if (containsProfanity(notes)) { this.setState({ error: 'please keep notes family-friendly.' }); return; }
        if (notes.length > MAX_NOTES_CHARS) { this.setState({ error: saveErrorMessage(400, 'notes cannot exceed') }); return; }

        const edit = this.isEdit;
        const body = edit ? this.changes() : { coordinates: spot, fruitType, notes: notes.trim() };
        if (edit && Object.keys(body).length === 0) { this.props.onClose(); return; }

        this.setState({ step: 'saving', error: '' });
        const controller = new AbortController();
        this._controller = controller;
        let status = 0;
        let message = '';
        try {
            const url = edit ? `${API_BASE}/api/pins/${encodeURIComponent(this.props.pin.pinId)}` : `${API_BASE}/api/pins`;
            const response = await fetchWithRetry(url, {
                method: edit ? 'PATCH' : 'POST',
                headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
                signal: controller.signal,
                body: JSON.stringify(body),
            }, {
                timeoutMs: 12000,
                retries: 0, // never auto-retry a write
            });
            status = response.status;
            if (handleUnauthorized(response)) return; // Sidebar signs out and says why
            const result = await response.json().catch(() => ({}));
            message = result.message || '';
            if (response.ok && result.success && result.pin) {
                emit('ffa:find-saved', { pin: result.pin, mode: edit ? 'edit' : 'add' });
                this.props.onClose(edit ? 'saved.' : 'added. thank you!');
                return;
            }
        } catch (err) {
            if (controller.signal.aborted && this._unmounted) return;
            status = 0;
        } finally {
            if (this._controller === controller) this._controller = null;
        }
        if (this._unmounted) return;
        this.setState({ step: 'details', error: saveErrorMessage(status, message) });
    };

    // ── render ─────────────────────────────────────────────────────────────

    renderHead(title, sub) {
        return (
            <div className="add-find-head">
                <h2 className="add-find-title" tabIndex={-1} ref={this.headRef}>{title}</h2>
                {sub && <p className="add-find-sub">{sub}</p>}
                <div className="add-find-rules" aria-hidden="true"><span /><span /></div>
            </div>
        );
    }

    renderLocating() {
        return (
            <div className="add-find-card" role="dialog" aria-modal="false" aria-label="add a find" ref={this.sheetRef}>
                {this.renderHead('add a find', null)}
                <p className="add-find-status" role="status">
                    <span className="add-find-pulse" aria-hidden="true" /> finding where you are…
                </p>
                <div className="add-find-actions">
                    <button type="button" className="add-find-outline" onClick={this.cancel}>cancel</button>
                </div>
            </div>
        );
    }

    renderNoLocation() {
        return (
            <div className="add-find-card" role="dialog" aria-modal="false" aria-label="add a find" ref={this.sheetRef}>
                {this.renderHead('add a find', null)}
                <p className="add-find-aside">
                    finds go where you’re standing, so we need your location to add one.
                </p>
                <p className="add-find-error" role="alert">{this.state.locError}</p>
                <div className="add-find-actions">
                    <button type="button" className="btn add-find-primary" onClick={this.locate}>try again</button>
                    <button type="button" className="add-find-outline" onClick={this.cancel}>cancel</button>
                </div>
                {this.props.isAdmin && (
                    <button type="button" className="add-find-link" onClick={this.placeWithoutFix}>
                        admin: place it on the map instead →
                    </button>
                )}
            </div>
        );
    }

    renderPlacing() {
        const { live, origin } = this.state;
        const edit = this.isEdit;
        let where = 'move the map; the pin stays in the middle.';
        if (live && origin && Number.isFinite(live.distanceM)) {
            where = describeOffset(origin, live, { from: edit ? 'pin' : 'you' });
        }
        const limitWords = `about a block (${formatFeet(NUDGE_LIMIT_M)})`;
        return (
            <div className="add-find-card add-find-card--placing" role="dialog" aria-modal="false"
                aria-label={edit ? 'move this find' : 'put the pin on the tree'} ref={this.sheetRef}>
                {this.renderHead(edit ? 'move the pin to the tree' : 'put the pin on the tree', null)}
                <p className="add-find-where" aria-live="polite">{where}</p>
                {live && live.atLimit ? (
                    <p className="add-find-hint add-find-hint--limit">
                        that’s as far as it goes: {limitWords} from {edit ? 'where it was' : 'you'}.
                        {edit ? ' to move it further, delete it and add it again.' : ' walk closer to place it further.'}
                    </p>
                ) : (
                    <p className="add-find-hint">drag the map until the pin sits on the tree{origin ? `; it can go ${limitWords} from ${edit ? 'where it was' : 'you'}` : ''}.</p>
                )}
                <div className="add-find-actions">
                    <button type="button" className="btn add-find-primary" onClick={this.confirmSpot} disabled={!live}>
                        {edit ? 'use this spot' : 'this is the spot →'}
                    </button>
                    <button type="button" className="add-find-outline"
                        onClick={this.state.spot ? () => this.setState({ step: 'details' }) : this.cancel}>
                        {this.state.spot ? 'back' : 'cancel'}
                    </button>
                </div>
            </div>
        );
    }

    renderKindField() {
        const { fruitType } = this.state;
        const family = fruitType ? familyOf(fruitType) : null;
        return (
            <div className="add-find-field">
                <span className="add-find-label" id="add-find-kind-label">what’s there</span>
                <button type="button" className={`add-find-kind${fruitType ? '' : ' is-empty'}`}
                    aria-labelledby="add-find-kind-label add-find-kind-value"
                    onClick={() => this.setState({ step: 'kinds', error: '' })}>
                    {family && <Mark family={family} size={26} />}
                    <span id="add-find-kind-value" className="add-find-kind__name">
                        {fruitType || 'choose from the list'}
                    </span>
                    {family && <span className="add-find-kind__family">{familyLabel(family)}</span>}
                    <span className="add-find-kind__chev" aria-hidden="true">›</span>
                </button>
            </div>
        );
    }

    renderDetails() {
        const { spot, origin, fruitType, notes, error, nearby, step } = this.state;
        const edit = this.isEdit;
        const saving = step === 'saving';
        const family = fruitType ? familyOf(fruitType) : null;
        const spotWords = edit
            ? (spot && origin ? describeOffset(origin, spot, { from: 'pin' }) : '')
            : (spot && origin ? describeOffset(origin, spot) : 'placed on the map');
        const same = !edit && fruitType ? nearbySameKind(nearby, spot, fruitType)[0] : null;
        const left = MAX_NOTES_CHARS - notes.length;
        const unchanged = edit && Object.keys(this.changes()).length === 0;
        return (
            <div className="add-find-card add-find-card--sheet" role="dialog" aria-modal="false"
                aria-labelledby="add-find-title" ref={this.sheetRef}>
                <div className="add-find-head">
                    <h2 className="add-find-title" id="add-find-title" tabIndex={-1} ref={this.headRef}>
                        {edit ? 'edit this find' : 'add a find'}
                    </h2>
                    <div className="add-find-rules" aria-hidden="true"><span /><span /></div>
                </div>
                <div className="add-find-body">
                    <div className="add-find-field add-find-field--spot">
                        <span className="add-find-label">the spot</span>
                        <span className="add-find-spot">{spotWords}</span>
                        <button type="button" className="add-find-link" onClick={() => this.startPlacing(spot)} disabled={saving}>
                            move it
                        </button>
                    </div>

                    {this.renderKindField()}

                    {family === 'medicinal' && (
                        <p className="add-find-caution">
                            know the plant for certain before you pick it, take only a little from each plant,
                            and check with a clinician before using it as medicine.
                        </p>
                    )}
                    {same && (
                        <p className="add-find-aside">
                            there’s already a {fruitType} logged {formatFeet(same.distanceM)} from here. if it’s the same
                            {family === 'tree' || family === 'citrus' || family === 'tropical' || family === 'nuts' ? ' tree' : ' plant'},
                            you could tap it and say “still good” instead.
                        </p>
                    )}

                    <div className="add-find-field">
                        <label className="add-find-label" htmlFor="add-find-notes">notes <span className="add-find-optional">(optional)</span></label>
                        <textarea
                            id="add-find-notes"
                            className="add-find-notes"
                            value={notes}
                            onChange={(e) => this.setState({ notes: e.target.value, error: '' })}
                            placeholder="what’s there, how to reach it, when it’s best"
                            rows={3}
                            maxLength={MAX_NOTES_CHARS}
                            disabled={saving}
                        />
                        {left < 120 && <span className="add-find-count">{left} characters left</span>}
                    </div>

                    {error && <p className="add-find-error" role="alert">{error}</p>}
                </div>
                <div className="add-find-actions add-find-actions--sheet">
                    <button type="button" className="btn add-find-primary" onClick={this.save}
                        disabled={saving || !fruitType || unchanged} aria-busy={saving}>
                        {saving ? 'saving…' : edit ? 'save changes' : 'add this find'}
                    </button>
                    <button type="button" className="add-find-outline" onClick={this.cancel} disabled={saving}>cancel</button>
                </div>
            </div>
        );
    }

    renderKindRow(kind, alias) {
        const on = kind === this.state.fruitType;
        return (
            <li key={kind}>
                <button type="button" className={`add-find-option${on ? ' is-on' : ''}`} aria-pressed={on}
                    onClick={() => this.chooseKind(kind)}>
                    <Mark family={familyOf(kind)} size={20} block={false} />
                    <span className="add-find-option__name">{kind}</span>
                    {alias && <span className="add-find-option__alias">{alias}</span>}
                </button>
            </li>
        );
    }

    renderKinds() {
        const { query } = this.state;
        const results = query.trim() ? searchKinds(query) : null;
        return (
            <div className="add-find-card add-find-card--sheet add-find-card--kinds" role="dialog" aria-modal="false"
                aria-labelledby="add-find-kinds-title" ref={this.sheetRef}>
                <div className="add-find-head add-find-head--kinds">
                    <button type="button" className="add-find-back" onClick={() => this.setState({ step: 'details', query: '' })}
                        aria-label="back to the find">‹</button>
                    <h2 className="add-find-title" id="add-find-kinds-title" tabIndex={-1} ref={this.headRef}>what’s there?</h2>
                </div>
                <div className="add-find-search">
                    <input
                        ref={this.searchRef}
                        type="search"
                        className="add-find-search__input"
                        value={query}
                        onChange={(e) => this.setState({ query: e.target.value })}
                        placeholder="search: fig, nopales, pineapple guava…"
                        aria-label="search the list"
                        autoComplete="off"
                        autoCapitalize="none"
                        spellCheck={false}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && results && results.length) { e.preventDefault(); this.chooseKind(results[0].kind); }
                        }}
                    />
                </div>
                <div className="add-find-list" role="region" aria-label="kinds of find">
                    {results ? (
                        results.length ? (
                            <ul className="add-find-options">{results.map((r) => this.renderKindRow(r.kind, r.alias))}</ul>
                        ) : (
                            <p className="add-find-none">
                                nothing called “{query.trim()}” on the list. pick the closest kind and say what it is in the notes.
                            </p>
                        )
                    ) : (
                        GROUPS.map((g) => (
                            <section key={g.family} className="add-find-group" aria-label={g.label}>
                                <h3 className="add-find-group__head"><Mark family={g.family} size={18} /> {g.label}</h3>
                                <ul className="add-find-options">{g.kinds.map((k) => this.renderKindRow(k, null))}</ul>
                            </section>
                        ))
                    )}
                </div>
            </div>
        );
    }

    render() {
        const { step } = this.state;
        let card;
        if (step === 'locating') card = this.renderLocating();
        else if (step === 'nolocation') card = this.renderNoLocation();
        else if (step === 'placing') card = this.renderPlacing();
        else if (step === 'kinds') card = this.renderKinds();
        else card = this.renderDetails();
        return (
            <div className={`add-find add-find--${step}${this.props.isTiny ? ' add-find--tiny' : ''}`}>
                {card}
            </div>
        );
    }
}
