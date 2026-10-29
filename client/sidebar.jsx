import React, { Component } from 'react';
import { logoSvg } from './utils/logo.js';
import { getAuthHeader, getUser, clearAuth, saveAuth, isAuthenticated, isAdmin, handleUnauthorized, SESSION_EXPIRED_EVENT } from './utils/auth.js';
import { FRUIT_SEASONS, getSeasonStatus } from './utils/fruitSeasons.js';
import { API_BASE } from './utils/config.js';
import { getTinyScreenGuestAuthState } from './utils/sidebarState.js';
import { familyLabel, markSvg } from './utils/fruitFamilies.js';
import { formatMiles, MONTH_NAMES, lookForHints } from './utils/pinSummary.js';
import { shelfEnabled, shelfHeadText, shelfReachText } from './utils/seasonShelf.js';
import { fetchWithRetry } from './utils/network.js';
import AuthForm from './components/AuthForm.jsx';
import AddFind from './components/AddFind.jsx';
import { ADMIN_PATH, sidebarCountLabel } from './utils/adminView.js';

import './stylesheets/sidebar.css';

import { TINY_SCREEN_QUERY, MOBILE_QUERY } from './utils/breakpoints.js';

const GUEST_BAR_SEEN_KEY = 'ffa_guest_bar_seen';

function readFirstVisit() {
    try { return !localStorage.getItem(GUEST_BAR_SEEN_KEY); } catch { return false; }
}

export default class Sidebar extends React.Component {
    constructor(props) {
        super(props);
        const initialTinyScreen = typeof window !== 'undefined'
            ? window.matchMedia(TINY_SCREEN_QUERY).matches
            : false;
        const initialMobileScreen = typeof window !== 'undefined'
            ? window.matchMedia(MOBILE_QUERY).matches
            : false;
        this.state = {
            // Authentication state
            authenticated: isAuthenticated(),
            isLoginMode: true, // Toggle between login and register
            authUserName: '',
            authPassword: '',
            authEmail: '',
            authLoading: false,
            authError: '',
            
            // Add a find / edit a find (components/AddFind.jsx):
            // null | { mode: 'add' } | { mode: 'edit', pin }
            addFind: null,
            // A short line after a save or delete ("added to the map"), then it fades.
            notice: '',
            
            // Fruit type filter
            selectedFruitFilter: 'all',
            availableFruitTypes: [],
            
            // Sidebar collapse state — collapse on tiny screens by default for all users
            isCollapsed: initialTinyScreen,
            isTinyScreen: initialTinyScreen,
            isStandardMobile: initialMobileScreen && !initialTinyScreen,

            // Guest mode: tracks when an unauthenticated user has tapped "add a find"
            guestAddAttempted: false,

            // My pins filter active state
            myPinsActive: false,

            // Forgot password mode
            isForgotMode: false,
            forgotEmail: '',
            forgotLoading: false,
            forgotError: '',
            forgotSuccess: false,

            // About panel
            showAbout: false,

            // Standard mobile authenticated bar open/closed
            isMobileBarOpen: false,

            // Standard mobile guest bar: expanded "right now nearby" card. Open on a
            // first visit, collapsed to one row after that (and whenever a pin opens).
            guestBarOpen: readFirstVisit(),

            // Guest bar live subtext
            pinCount: 0,
            // What the map says is in view (utils/pinSummary.js buildViewSummary)
            summary: null,
            // Standard-mobile bar tab: 'ripe' | 'almanac' | 'nearest'
            barTab: 'ripe',

            // Season shelf (landing b2, behind ?landing=shelf, signed out only).
            // The map sends it (ffa:shelf): see utils/seasonShelf.js.
            shelf: null,
            shelfAnchor: { kind: 'none', city: null },
            shelfLoading: true,
            shelfIndex: -1,      // the entry you're on (-1: none chosen yet)
            shelfView: 'shelf',  // 'shelf' | 'almanac'
            shelfFolded: false,  // folded to the running head while a pin is open
            shelfIntro: readFirstVisit(),

            // Desktop, admins only: the command center's counts for the sidebar link
            // (GET /api/admin/summary). null until loaded; the link shows regardless.
            adminCounts: null,
        }
        this._shelfOn = shelfEnabled();
        this._requestControllers = new Set();
        this._bottomBarObserver = null;
        this.handlePinSummaryEvent = this.handlePinSummaryEvent.bind(this);
    }

    syncResponsiveMode = () => {
        if (!this._tinyScreenMql || !this._mobileMql) return;
        const isTinyScreen = this._tinyScreenMql.matches;
        const isStandardMobile = this._mobileMql.matches && !isTinyScreen;
        this.setState(prevState => {
            const nextState = {};

            if (prevState.isTinyScreen !== isTinyScreen) {
                nextState.isTinyScreen = isTinyScreen;
                if (isTinyScreen) {
                    // Preserve Jelly Star default: tiny mode is FAB + collapsed panel.
                    nextState.isCollapsed = true;
                }
            }

            if (prevState.isStandardMobile !== isStandardMobile) {
                nextState.isStandardMobile = isStandardMobile;
                if (!isStandardMobile && prevState.isMobileBarOpen) {
                    nextState.isMobileBarOpen = false;
                }
            }

            return Object.keys(nextState).length > 0 ? nextState : null;
        });
    };

    componentDidMount() {
        if (typeof window !== 'undefined') {
            this._tinyScreenMql = window.matchMedia(TINY_SCREEN_QUERY);
            this._mobileMql = window.matchMedia(MOBILE_QUERY);
            if (typeof this._tinyScreenMql.addEventListener === 'function') {
                this._tinyScreenMql.addEventListener('change', this.syncResponsiveMode);
                this._mobileMql.addEventListener('change', this.syncResponsiveMode);
            } else {
                this._tinyScreenMql.addListener(this.syncResponsiveMode);
                this._mobileMql.addListener(this.syncResponsiveMode);
            }
            window.addEventListener('resize', this.syncResponsiveMode);
            this.syncResponsiveMode();
        }
        if (!this.state.guestAddAttempted && !isAuthenticated()) {
            sessionStorage.removeItem('ffa_guest_add_attempted');
        }
        window.addEventListener('ffa:pins-summary', this.handlePinSummaryEvent);
        window.addEventListener('ffa:shelf', this.handleShelfEvent);
        try { localStorage.setItem(GUEST_BAR_SEEN_KEY, '1'); } catch { /* private mode */ }
        window.addEventListener('ffa:add-find', this.handleAddFindRequest);
        window.addEventListener('ffa:edit-find', this.handleEditFindRequest);
        window.addEventListener('ffa:notice', this.handleNoticeEvent);
        window.addEventListener(SESSION_EXPIRED_EVENT, this.handleSessionExpired);
        this.loadAdminSummary();
    }

    componentDidUpdate(prevProps, prevState) {
        // Signed in, or widened to desktop: the admin link needs its count.
        if ((this.state.authenticated && !prevState.authenticated)
            || (this.isDesktop(this.state) && !this.isDesktop(prevState))) {
            this.loadAdminSummary();
        }
    }

    isDesktop(state) {
        return !state.isTinyScreen && !state.isStandardMobile;
    }

    // The sidebar's "command center · N open reports" (desktop, admins only). A
    // failure just leaves the count off: the link itself still works.
    loadAdminSummary = async () => {
        if (!this.state.authenticated || !isAdmin() || !this.isDesktop(this.state)) return;
        const controller = this.startRequest();
        try {
            const response = await fetchWithRetry(`${API_BASE}/api/admin/summary`, {
                headers: getAuthHeader(),
                cache: 'no-store',
                signal: controller.signal,
            });
            if (handleUnauthorized(response) || !response.ok) return;
            const result = await response.json();
            if (result.success) this.setState({ adminCounts: result.counts });
        } catch {
            // offline or aborted: no count
        } finally {
            this.finishRequest(controller);
        }
    };

    componentWillUnmount() {
        window.removeEventListener('ffa:add-find', this.handleAddFindRequest);
        window.removeEventListener('ffa:edit-find', this.handleEditFindRequest);
        window.removeEventListener('ffa:notice', this.handleNoticeEvent);
        clearTimeout(this._noticeTimer);
        window.removeEventListener(SESSION_EXPIRED_EVENT, this.handleSessionExpired);
        this.setBottomBarRef(null);
        window.removeEventListener('ffa:pins-summary', this.handlePinSummaryEvent);
        window.removeEventListener('ffa:shelf', this.handleShelfEvent);
        this.abortAllRequests();
        if (typeof window !== 'undefined') {
            window.removeEventListener('resize', this.syncResponsiveMode);
        }
        if (this._tinyScreenMql && this._mobileMql) {
            if (typeof this._tinyScreenMql.removeEventListener === 'function') {
                this._tinyScreenMql.removeEventListener('change', this.syncResponsiveMode);
                this._mobileMql.removeEventListener('change', this.syncResponsiveMode);
            } else {
                this._tinyScreenMql.removeListener(this.syncResponsiveMode);
                this._mobileMql.removeListener(this.syncResponsiveMode);
            }
        }
    }

    // Publishes the fixed bottom bar's height as --bottom-chrome so map controls,
    // attribution and popup panning can stay clear of it (standard phones only).
    setBottomBarRef = (el) => {
        if (this._bottomBarObserver) {
            this._bottomBarObserver.disconnect();
            this._bottomBarObserver = null;
        }
        const root = typeof document !== 'undefined' ? document.documentElement : null;
        if (!root) return;
        if (!el) {
            root.style.setProperty('--bottom-chrome', '0px');
            return;
        }
        const publish = () => {
            root.style.setProperty('--bottom-chrome', `${Math.round(el.getBoundingClientRect().height)}px`);
        };
        publish();
        if (typeof ResizeObserver === 'function') {
            this._bottomBarObserver = new ResizeObserver(publish);
            this._bottomBarObserver.observe(el);
        }
    };

    startRequest = () => {
        const controller = new AbortController();
        this._requestControllers.add(controller);
        return controller;
    };

    finishRequest = (controller) => {
        this._requestControllers.delete(controller);
    };

    abortAllRequests = () => {
        this._requestControllers.forEach((controller) => controller.abort());
        this._requestControllers.clear();
    };

    handlePinSummaryEvent = (event) => {
        const detail = event?.detail || {};
        this.setState({
            availableFruitTypes: Array.isArray(detail.fruitTypes) ? detail.fruitTypes : [],
            pinCount: Number.isFinite(detail.pinCount) ? detail.pinCount : 0,
            summary: detail.summary || null,
        });
    };

    handleShelfEvent = (event) => {
        const detail = event?.detail || {};
        const shelf = detail.shelf || null;
        this.setState(prev => {
            // Keep the chosen entry if the same kind is still on the shelf (the shelf is
            // anchored, so it only changes when finds load or the anchor moves).
            const prevKind = prev.shelf && prev.shelf.entries[prev.shelfIndex];
            const idx = prevKind && shelf ? shelf.entries.findIndex(e => e.fruitType === prevKind.fruitType) : -1;
            return {
                shelf,
                shelfAnchor: detail.anchor || { kind: 'none', city: null },
                shelfLoading: !!detail.loading,
                shelfIndex: idx,
            };
        });
    };

    // A shelf entry: the first tap brings its find into view and numbers its pin;
    // tapping the entry you're already on opens the find.
    chooseShelfEntry = (index) => {
        const { shelf, shelfIndex } = this.state;
        const entry = shelf && shelf.entries[index];
        if (!entry || !entry.nearest) return;
        if (index === shelfIndex) {
            this.setState({ shelfFolded: true });
            window.dispatchEvent(new CustomEvent('ffa:fly-to', { detail: entry.nearest }));
            return;
        }
        this.setState({ shelfIndex: index, shelfFolded: false });
        window.dispatchEvent(new CustomEvent('ffa:shelf-select', { detail: entry.nearest }));
    };

    // Jelly: ‹ › step through the same five.
    stepShelf = (delta) => {
        const { shelf, shelfIndex } = this.state;
        const n = shelf ? shelf.entries.length : 0;
        if (!n) return;
        // Nothing chosen yet: the strip is showing entry 1, so step from there.
        const from = shelfIndex < 0 ? 0 : shelfIndex;
        this.chooseShelfEntry((from + delta + n) % n);
    };

    // "add the first find" on the map's empty-area card
    handleAddFindRequest = () => {
        if (!this.state.addFind) this.startAddFind();
    };

    // "edit" in a find's popup (map.jsx → PinPopup)
    handleEditFindRequest = (e) => {
        const pin = e && e.detail && e.detail.pin;
        if (!pin || !this.state.authenticated) return;
        this.setState({ addFind: { mode: 'edit', pin }, guestBarOpen: false, isMobileBarOpen: false, isCollapsed: this.state.isTinyScreen || this.state.isCollapsed });
    };

    // Add a find: signed out, it opens sign-in first (and resumes after); signed in,
    // AddFind takes over the screen (locate → place the pin → details).
    startAddFind = () => {
        if (!isAuthenticated()) {
            sessionStorage.setItem('ffa_guest_add_attempted', '1');
            this.setState({ guestAddAttempted: true, isLoginMode: true, showAbout: false, isForgotMode: false, isCollapsed: false, isMobileBarOpen: true });
            return;
        }
        if (this.state.addFind) return;
        if (this.props.onSidebarOpen) this.props.onSidebarOpen(); // closes any open popup
        this.setState({ addFind: { mode: 'add' }, guestBarOpen: false, isMobileBarOpen: false, isCollapsed: this.state.isTinyScreen || this.state.isCollapsed });
    };

    handleInputChange = (field, value) => {
        this.setState({ [field]: value });
    };

    closeAddFind = (notice) => {
        this.setState({ addFind: null });
        if (notice) this.showNotice(notice);
    };

    handleNoticeEvent = (e) => {
        const text = e && e.detail && e.detail.text;
        if (text) this.showNotice(text);
    };

    showNotice = (text) => {
        clearTimeout(this._noticeTimer);
        this.setState({ notice: text });
        this._noticeTimer = setTimeout(() => this.setState({ notice: '' }), 4000);
    };

    flyTo = (coords) => {
        if (!coords) return;
        this.setState({ guestBarOpen: false, isMobileBarOpen: false });
        window.dispatchEvent(new CustomEvent('ffa:fly-to', { detail: coords }));
    };

    // The server rejected the stored token (handleUnauthorized already cleared it).
    // Sign out the same way the button does, then say why.
    handleSessionExpired = () => {
        if (!this.state.authenticated) return;
        this.handleLogout();
        // Open the sign-in form (in every layout) so the reason is visible
        this.setState({
            guestAddAttempted: true,
            isLoginMode: true,
            isForgotMode: false,
            showAbout: false,
            isCollapsed: false,
            isMobileBarOpen: true,
            authError: 'your session expired. please sign in again.',
        });
    };

    handleLogout = () => {
        clearAuth();
        if (this.props.onFilterChange) this.props.onFilterChange('all');
        if (this.props.onLogout) this.props.onLogout();
        this.setState({ 
            authenticated: false,
            adminCounts: null,
            addFind: null,
            isMobileBarOpen: false,
            myPinsActive: false,
            selectedFruitFilter: 'all',
            guestAddAttempted: false,
            authUserName: '',
            authPassword: '',
            authEmail: '',
            authError: '',
            availableFruitTypes: [],
            pinCount: 0
        });
    };

    toggleAuthMode = () => {
        this.setState(prevState => ({
            isLoginMode: !prevState.isLoginMode,
            authError: '',
            authUserName: '',
            authPassword: '',
            authEmail: ''
        }));
    };

    handleForgotPassword = async (e) => {
        e.preventDefault();
        const { forgotEmail } = this.state;
        if (!forgotEmail) {
            this.setState({ forgotError: 'please enter your email address' });
            return;
        }
        this.setState({ forgotLoading: true, forgotError: '' });
        const controller = this.startRequest();
        try {
            const res = await fetchWithRetry(`${API_BASE}/api/auth/forgot-password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                signal: controller.signal,
                body: JSON.stringify({ email: forgotEmail })
            }, {
                timeoutMs: 12000,
                retries: 0, // POSTs are not idempotent: never auto-retry
            });
            const result = await res.json();
            if (res.status === 429) {
                this.setState({ forgotError: result.message || 'too many requests. please try again later.', forgotLoading: false });
                return;
            }
            // Always show success (don't reveal if email exists)
            this.setState({ forgotSuccess: true, forgotLoading: false });
        } catch (err) {
            if (controller.signal.aborted) return;
            this.setState({ forgotError: 'connection error. please try again.', forgotLoading: false });
        } finally {
            this.finishRequest(controller);
        }
    };

    handleLogin = async (e) => {
        e.preventDefault();
        const { authUserName, authPassword } = this.state;

        if (!authUserName.trim() || !authPassword) {
            this.setState({ authError: 'please enter username and password' });
            return;
        }

        this.setState({ authLoading: true, authError: '' });
        const controller = this.startRequest();

        try {
            const response = await fetchWithRetry(`${API_BASE}/api/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                signal: controller.signal,
                body: JSON.stringify({ 
                    userName: authUserName.trim(), 
                    password: authPassword
                })
            }, {
                timeoutMs: 12000,
                retries: 0, // POSTs are not idempotent: never auto-retry
            });

            const result = await response.json();

            if (result.success) {
                const wasGuestAddAttempted = sessionStorage.getItem('ffa_guest_add_attempted') === '1';
                sessionStorage.removeItem('ffa_guest_add_attempted');
                saveAuth(result.token, result.user);
                this.setState({ 
                    authenticated: true,
                    guestAddAttempted: false,
                    authUserName: '',
                    authPassword: '',
                    authError: '',
                    isCollapsed: this.state.isTinyScreen,
                    // Tapped "add a find" while signed out: carry on with it now.
                    addFind: wasGuestAddAttempted ? { mode: 'add' } : null,
                });
                // Notify parent to refresh pins
                if (this.props.onAuthSuccess) {
                    this.props.onAuthSuccess();
                }
            } else {
                this.setState({ authError: result.message || 'login failed' });
            }
        } catch (error) {
            if (controller.signal.aborted) return;
            console.error('[LOGIN] Exception:', error);
            this.setState({ authError: 'Connection error. Please try again.' });
        } finally {
            this.finishRequest(controller);
            this.setState({ authLoading: false });
        }
    };

    handleRegister = async (e) => {
        e.preventDefault();
        const { authUserName, authPassword, authEmail } = this.state;

        if (!authUserName.trim() || !authPassword || !authEmail.trim()) {
            this.setState({ authError: 'all fields are required' });
            return;
        }

        // Username validation
        if (!/^[A-Za-z0-9_.-]{3,24}$/.test(authUserName.trim())) {
            this.setState({ authError: 'username: 3–24 letters, numbers, dot, dash or underscore' });
            return;
        }

        // Email validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(authEmail)) {
            this.setState({ authError: 'please enter a valid email address' });
            return;
        }

        // Password validation - match backend requirements
        if (authPassword.length < 10) {
            this.setState({ authError: 'password must be at least 10 characters' });
            return;
        }

        if (!/\d/.test(authPassword)) {
            this.setState({ authError: 'password must contain at least one number' });
            return;
        }

        if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(authPassword)) {
            this.setState({ authError: 'password must contain at least one symbol' });
            return;
        }

        this.setState({ authLoading: true, authError: '' });
        const controller = this.startRequest();

        try {
            const response = await fetchWithRetry(`${API_BASE}/api/auth/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                signal: controller.signal,
                body: JSON.stringify({ 
                    userName: authUserName.trim(), 
                    password: authPassword,
                    email: authEmail.trim()
                })
            }, {
                timeoutMs: 12000,
                retries: 0, // POSTs are not idempotent: never auto-retry
            });

            const result = await response.json();

            if (result.success) {
                const wasGuestAddAttempted = sessionStorage.getItem('ffa_guest_add_attempted') === '1';
                sessionStorage.removeItem('ffa_guest_add_attempted');
                saveAuth(result.token, result.user);
                this.setState({ 
                    authenticated: true,
                    guestAddAttempted: false,
                    authUserName: '',
                    authPassword: '',
                    authEmail: '',
                    authError: '',
                    isCollapsed: this.state.isTinyScreen,
                    addFind: wasGuestAddAttempted ? { mode: 'add' } : null,
                });
                // Notify parent to refresh pins
                if (this.props.onAuthSuccess) {
                    this.props.onAuthSuccess();
                }
            } else {
                // Always clear guest add flag and modal on failed registration
                sessionStorage.removeItem('ffa_guest_add_attempted');
                this.setState({ authError: result.message || 'registration failed' });
            }
        } catch (error) {
            if (controller.signal.aborted) return;
            console.error('Registration error:', error);
            this.setState({ authError: 'Connection error. Please try again.' });
        } finally {
            this.finishRequest(controller);
            this.setState({ authLoading: false });
        }
    };

    handleFilterChange = (e) => {
        const fruitType = e.target.value;
        this.setState({ selectedFruitFilter: fruitType });
        if (this.props.onFilterChange) {
            this.props.onFilterChange(fruitType);
        }
    };

    toggleSidebar = () => {
        this.setState(prevState => {
            const opening = prevState.isCollapsed;
            if (opening && this.props.onSidebarOpen) this.props.onSidebarOpen();
            return { isCollapsed: !prevState.isCollapsed };
        });
    };

    collapse = () => {
        this.setState({ isCollapsed: true, guestBarOpen: false, isMobileBarOpen: false, shelfFolded: true });
    };

    getSeasonLabel = () => {
        const month = new Date().getMonth() + 1;
        const inSeason = new Set();
        for (const [fruit, data] of Object.entries(FRUIT_SEASONS)) {
            const inAnyZone = Object.values(data.zones || {}).some(months => months.includes(month));
            if (inAnyZone) inSeason.add(fruit);
        }
        if (inSeason.has('loquat')) return 'loquat season';
        if (inSeason.has('cherry') || inSeason.has('apricot')) return 'stone fruit season';
        if (inSeason.has('peach') || inSeason.has('plum')) return 'summer harvest';
        if (inSeason.has('fig') || inSeason.has('blackberry') || inSeason.has('mulberry')) return 'fig & berry season';
        if (inSeason.has('apple') || inSeason.has('pear')) return 'fall harvest';
        if (inSeason.has('orange') || inSeason.has('grapefruit') || inSeason.has('tangerine')) return 'citrus season';
        return 'something is always in season';
    };

    getInSeasonFruits = () => {
        const month = new Date().getMonth() + 1;
        return (this.state.availableFruitTypes || [])
            .filter(fruit => {
                const data = FRUIT_SEASONS[fruit.toLowerCase()];
                if (!data) return false;
                return Object.values(data.zones || {}).some(months => months.includes(month));
            })
            .slice(0, 3)
            .map(fruit => ({ name: fruit, status: getSeasonStatus(fruit, month) }));
    };

    handleNearestGoodBet = () => {
        window.dispatchEvent(new CustomEvent('ffa:nearest-good-bet'));
    };

    renderBarHandle(isOpen, onToggle, label) {
        return (
            <button
                type="button"
                className="bar-handle"
                onClick={onToggle}
                aria-expanded={isOpen}
                aria-label={isOpen ? `hide ${label}` : `show ${label}`}
            >
                <span className="bar-handle-grip" aria-hidden="true" />
                <svg className={`bar-handle-chevron${isOpen ? ' bar-handle-chevron--open' : ''}`} width="14" height="8" viewBox="0 0 14 8" aria-hidden="true">
                    <path d="M1 7 L7 1 L13 7" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
            </button>
        );
    }

    renderFruitFilter(id) {
        return (
            <select
                id={id}
                value={this.state.selectedFruitFilter}
                onChange={this.handleFilterChange}
                className="fruit-filter-select"
                aria-label="filter by fruit"
            >
                <option value="all">all fruits</option>
                {this.state.availableFruitTypes.map(fruit => (
                    <option key={fruit} value={fruit}>{fruit}</option>
                ))}
            </select>
        );
    }

    toggleMobileBar = () => {
        this.setState(prev => ({ isMobileBarOpen: !prev.isMobileBarOpen }));
    };

    toggleGuestBar = () => {
        this.setState(prev => ({ guestBarOpen: !prev.guestBarOpen }));
    };

    // ── Standard-mobile bar: month header + "in season / almanac / nearest" tabs ──

    // The block-print loquat (utils/logo.js): a cluster when size >= 40, one fruit when smaller.
    // CSS on `className` sets the box; the svg fills it.
    renderLogo(size, className, label) {
        return (
            <span
                className={`ffa-logo ${className}`}
                {...(label ? {} : { 'aria-hidden': 'true' })}
                dangerouslySetInnerHTML={{ __html: logoSvg({ size, label }) }}
            />
        );
    }

    // The way into the admin command center (desktop sidebar, admins only).
    renderAdminEntry() {
        const open = this.state.adminCounts?.openReports;
        return (
            <a className="admin-entry" href={ADMIN_PATH}>
                <span className="admin-entry__text">
                    <span className="admin-entry__title">command center</span>
                    <span className={`admin-entry__count${open > 0 ? ' admin-entry__count--open' : ''}`}>
                        {this.state.adminCounts ? sidebarCountLabel(open) : 'reports, activity, finds to review'}
                    </span>
                </span>
                <span className="admin-entry__arrow" aria-hidden="true">→</span>
            </a>
        );
    }

    renderMark(family, size = 22, block = true) {
        return (
            <span
                className="bar-mark"
                aria-hidden="true"
                dangerouslySetInnerHTML={{ __html: markSvg(family, { size, strokeWidth: 1.6, block }) }}
            />
        );
    }

    renderBarHeader(addFind) {
        const { summary, pinCount } = this.state;
        const month = MONTH_NAMES[new Date().getMonth()];
        const ripe = summary ? summary.ripeCount : 0;
        const sub = pinCount > 0
            ? `${ripe} in season · ${pinCount} ${pinCount === 1 ? 'find' : 'finds'} in view`
            : 'nothing logged in view yet';
        return (
            <div className="guest-bar-body">
                {this.renderLogo(32, 'guest-bar-icon', 'fruit for all')}
                <div className="guest-bar-text">
                    <p className="bar-month">{month}</p>
                    <p className="bar-sub">{sub}</p>
                </div>
                <button className="auth-submit-btn guest-bar-btn" onClick={addFind}>add a find</button>
            </div>
        );
    }

    renderRipeTab() {
        const { summary, pinCount, authenticated } = this.state;
        const ripe = summary ? summary.ripe : [];
        return (
            <div className="bar-tabpanel" role="tabpanel" id="bar-panel-ripe" aria-labelledby="bar-tab-ripe">
                {ripe.length > 0 ? (
                    <ul className="ripe-list">
                        {ripe.slice(0, 3).map(g => (
                            <li key={g.fruitType}>
                                <button type="button" className="ripe-entry" onClick={() => this.flyTo(g.nearest)}>
                                    {this.renderMark(g.family, 26)}
                                    <span className="ripe-entry__body">
                                        <span className="ripe-entry__top">
                                            <span className="ripe-entry__name">{g.fruitType}</span>
                                            <span className="ripe-entry__meta">
                                                {g.count} {g.count === 1 ? 'find' : 'finds'} · {formatMiles(g.distanceMi)}
                                            </span>
                                        </span>
                                        {g.note && (
                                            <span className="ripe-entry__note">
                                                {g.note}{authenticated && g.noteBy ? ` —${g.noteBy}` : ''}
                                            </span>
                                        )}
                                    </span>
                                </button>
                            </li>
                        ))}
                    </ul>
                ) : (
                    <p className="bar-empty">nothing in season in this view right now. try the almanac tab for what's coming.</p>
                )}
                {pinCount > 0 && (
                    <p className="bar-note">
                        {pinCount} {pinCount === 1 ? 'find' : 'finds'} in this view, {summary ? summary.ripeCount : 0} in season.{' '}
                        <button type="button" className="secondary-link bar-note__link" onClick={this.handleNearestGoodBet}>
                            nearest good bet →
                        </button>
                    </p>
                )}
            </div>
        );
    }

    renderAlmanacTab() {
        const { summary } = this.state;
        const rows = summary ? summary.almanac : [];
        const monthIdx = new Date().getMonth();
        const letters = ['j', 'f', 'm', 'a', 'm', 'j', 'j', 'a', 's', 'o', 'n', 'd'];
        return (
            <div className="bar-tabpanel" role="tabpanel" id="bar-panel-almanac" aria-labelledby="bar-tab-almanac">
                {rows.length > 0 ? (
                    <div className="almanac" role="table" aria-label="when finds in view are in season">
                        <div className="almanac__row almanac__row--head" role="row">
                            <span role="columnheader" className="almanac__label">
                                {summary.zone ? `zone ${summary.zone}` : ''}
                            </span>
                            {letters.map((l, i) => (
                                <span key={i} role="columnheader" className={`almanac__month${i === monthIdx ? ' is-now' : ''}`}>{l}</span>
                            ))}
                        </div>
                        {rows.map(r => {
                            const on = new Set(r.months);
                            return (
                                <div className="almanac__row" role="row" key={r.fruitType}>
                                    <span role="rowheader" className="almanac__label" title={r.fruitType}>
                                        {this.renderMark(r.family, 18, false)}<span className="almanac__name">{r.fruitType}</span>
                                    </span>
                                    {letters.map((_, i) => (
                                        <span key={i} role="cell" className={`almanac__cell${on.has(i + 1) ? ' is-on' : ''}${i === monthIdx ? ' is-now' : ''}`} />
                                    ))}
                                </div>
                            );
                        })}
                        <p className="almanac__legend"><i aria-hidden="true" /> in season · from finds in this view</p>
                    </div>
                ) : (
                    <p className="bar-empty">pan to an area with finds to see its almanac.</p>
                )}
            </div>
        );
    }

    renderNearestTab() {
        const { summary, authenticated } = this.state;
        const n = summary ? summary.nearest : null;
        return (
            <div className="bar-tabpanel" role="tabpanel" id="bar-panel-nearest" aria-labelledby="bar-tab-nearest">
                {n ? (
                    <div className="nearest">
                        <div className="nearest__head">
                            {this.renderMark(n.family, 56)}
                            <div className="nearest__text">
                                <span className="nearest__name">{n.fruitType}</span>
                                <span className="nearest__meta">
                                    {familyLabel(n.family)} · {n.count} {n.count === 1 ? 'find' : 'finds'}, {formatMiles(n.distanceMi)} from the map center
                                </span>
                            </div>
                        </div>
                        {n.note && (
                            <p className="nearest__note">{n.note}{authenticated && n.noteBy ? ` —${n.noteBy}` : ''}</p>
                        )}
                        <button type="button" className="guest-bar-bet-btn" onClick={() => this.flyTo(n.nearest)}>
                            take me there →
                        </button>
                    </div>
                ) : (
                    <p className="bar-empty">nothing in season in this view yet. zoom out, or add the first find.</p>
                )}
            </div>
        );
    }

    renderBarPanel() {
        const { barTab } = this.state;
        const tabs = [['ripe', 'in season'], ['almanac', 'almanac'], ['nearest', 'nearest']];
        return (
            <div className="bar-panel">
                <div className="bar-tabs" role="tablist" aria-label="nearby finds">
                    {tabs.map(([id, label]) => (
                        <button
                            key={id}
                            type="button"
                            role="tab"
                            id={`bar-tab-${id}`}
                            aria-selected={barTab === id}
                            aria-controls={`bar-panel-${id}`}
                            className="bar-tab"
                            onClick={() => this.setState({ barTab: id })}
                        >{label}</button>
                    ))}
                </div>
                {barTab === 'ripe' && this.renderRipeTab()}
                {barTab === 'almanac' && this.renderAlmanacTab()}
                {barTab === 'nearest' && this.renderNearestTab()}
            </div>
        );
    }

    renderAuthenticatedBar() {
        const { isMobileBarOpen, myPinsActive } = this.state;
        const currentUser = getUser();

        return (
            <>
            <div
                ref={this.setBottomBarRef}
                className={`guest-bar auth-bar${isMobileBarOpen ? ' guest-bar--expanded' : ''}`}
            >
                {this.renderBarHandle(isMobileBarOpen, this.toggleMobileBar, 'nearby finds and menu')}
                {this.renderBarHeader(() => {
                    this.setState({ isMobileBarOpen: false });
                    this.startAddFind();
                })}

                {isMobileBarOpen && (
                    <div className="auth-bar-expanded-content">
                        {this.renderBarPanel()}
                        <div className="guest-bar-actions-row">
                            <button
                                type="button"
                                className={`auth-bar-action-btn${myPinsActive ? ' btn-active' : ''}`}
                                aria-pressed={myPinsActive}
                                onClick={() => {
                                    const next = !myPinsActive;
                                    this.setState({ myPinsActive: next, isMobileBarOpen: false });
                                    if (this.props.onToggleMyPins) this.props.onToggleMyPins();
                                }}
                            >{myPinsActive ? 'showing my pins' : 'my pins'}</button>
                            {this.renderFruitFilter('fruit-filter-mobile')}
                        </div>
                        <p className="guest-bar-links-row">
                            {currentUser && <span className="bar-signed-in">signed in as {currentUser.userName}</span>}
                            <span aria-hidden="true"> · </span>
                            <button type="button" className="secondary-link" onClick={this.handleLogout}>sign out</button>
                        </p>
                    </div>
                )}
            </div>
            {this.renderAddFruitPopup()}
            </>
        );
    }

    // ── Season shelf (landing b2) ────────────────────────────────────────────
    // One strip of paper: a running head (name, where the shelf is measured from,
    // add a find), then up to five kinds in season nearest first, divided by rules.

    renderShelfHeadSub() {
        const { shelfAnchor } = this.state;
        const month = MONTH_NAMES[new Date().getMonth()];
        const text = shelfHeadText(shelfAnchor, month);
        const link = (label, event) => (
            <>
                <span aria-hidden="true"> · </span>
                <button type="button" className="shelf-head__link"
                    onClick={() => window.dispatchEvent(new CustomEvent(event))}>{label}</button>
            </>
        );
        return (
            <span className="shelf-head__sub">
                {text}
                {shelfAnchor.kind === 'approx' && link('use my location', 'ffa:locate-me')}
                {shelfAnchor.kind === 'area' && link('back to near me', 'ffa:shelf-near-me')}
            </span>
        );
    }

    // What the shelf says when it has no entries to show.
    renderShelfEmpty(addFind) {
        const { shelf, shelfLoading, summary } = this.state;
        const month = new Date().getMonth() + 1;
        if (!shelf || shelf.tier === 'nowhere' || (shelfLoading && (!shelf.entries || !shelf.entries.length))) {
            return <p className="shelf-empty">looking for what's in season near you…</p>;
        }
        const zone = summary && summary.zone;
        const hints = zone ? lookForHints(zone, month) : [];
        return (
            <p className="shelf-empty">
                nothing in season logged nearby yet.
                {hints.length > 0 && ` look up at parkway trees and alley fences: ${hints.join(' and ')} ${hints.length > 1 ? 'are' : 'is'} in season around here.`}
                {' '}<button type="button" className="shelf-head__link" onClick={addFind}>add the first one here</button>
            </p>
        );
    }

    renderShelfEntry(e, i) {
        const on = i === this.state.shelfIndex;
        const meta = `${formatMiles(e.distanceMi)} · ${e.count} ${e.count === 1 ? 'find' : 'finds'}`;
        return (
            <li key={e.fruitType} className={`shelf-entry${on ? ' is-current' : ''}`}>
                <button type="button" className="shelf-entry__btn" onClick={() => this.chooseShelfEntry(i)}
                    aria-current={on ? 'true' : undefined}
                    aria-label={`${e.fruitType}, ${meta}${on ? ', open this find' : ''}`}>
                    <span className="shelf-entry__top">
                        {this.renderMark(e.family, 30)}
                        <span className="shelf-entry__n">{i + 1}</span>
                    </span>
                    <span className="shelf-entry__name">{e.fruitType}</span>
                    <span className="shelf-entry__meta">{meta}</span>
                    {e.note && <span className="shelf-entry__note">{e.note}</span>}
                    {on && <span className="shelf-entry__open">open this find →</span>}
                </button>
            </li>
        );
    }

    renderShelfBar() {
        const { shelf, shelfView, shelfFolded, shelfIntro, shelfAnchor, shelfIndex } = this.state;
        const startSignIn = () => this.setState({ guestAddAttempted: true, isLoginMode: true, showAbout: false, authError: '' });
        const showAbout = () => this.setState({ guestAddAttempted: true, showAbout: true });
        const entries = shelf ? shelf.entries : [];
        const reach = shelfReachText(shelf);
        const open = !shelfFolded;

        return (
            <>
            <div ref={this.setBottomBarRef} className={`guest-bar shelf${open ? '' : ' shelf--folded'}`}>
                {this.renderBarHandle(open, () => this.setState(prev => ({ shelfFolded: !prev.shelfFolded })), 'what is in season nearby')}
                <div className="shelf-head">
                    {this.renderLogo(32, 'shelf-head__logo')}
                    <div className="shelf-head__text">
                        <button type="button" className="shelf-head__name" onClick={showAbout}>fruit for all</button>
                        {this.renderShelfHeadSub()}
                    </div>
                    <button type="button" className="btn shelf-head__add" onClick={this.startAddFind}>add a find</button>
                </div>

                {open && shelfView === 'almanac' && (
                    <div className="shelf-almanac">
                        {this.renderAlmanacTab()}
                        <button type="button" className="shelf-head__link" onClick={() => this.setState({ shelfView: 'shelf' })}>← back to the shelf</button>
                    </div>
                )}

                {open && shelfView === 'shelf' && (
                    <>
                    {reach && shelf.tier !== 'walk' && (
                        <p className="shelf-reach">
                            {reach}
                            {shelf.tier === 'anywhere' && (
                                <>
                                    <span aria-hidden="true"> · </span>
                                    <button type="button" className="shelf-head__link" onClick={startSignIn}>add the first one here</button>
                                </>
                            )}
                        </p>
                    )}
                    <ol className="shelf-entries" aria-label="in season nearby, nearest first">
                        {shelfIntro && (
                            <li className="shelf-entry shelf-entry--intro">
                                <span className="shelf-intro__title">free fruit, growing in public.</span>
                                <span className="shelf-intro__body">mapped by neighbours. what's ready near you →</span>
                                {shelfAnchor.kind === 'none' && (
                                    <button type="button" className="shelf-head__link"
                                        onClick={() => window.dispatchEvent(new CustomEvent('ffa:locate-me'))}>use my location</button>
                                )}
                            </li>
                        )}
                        {entries.length > 0
                            ? entries.map((e, i) => this.renderShelfEntry(e, i))
                            : <li className="shelf-entry shelf-entry--empty">{this.renderShelfEmpty(startSignIn)}</li>}
                        {entries.length > 0 && (
                            <li className="shelf-entry shelf-entry--more">
                                <button type="button" className="shelf-head__link" onClick={() => this.setState({ shelfView: 'almanac' })}>
                                    see everything in season →
                                </button>
                            </li>
                        )}
                    </ol>
                    </>
                )}

                {open && (
                    <div className="shelf-foot">
                        <button type="button" className="shelf-head__link" onClick={() => this.setState({ shelfView: 'almanac' })}>the almanac</button>
                        <span aria-hidden="true">·</span>
                        <button type="button" className="shelf-head__link" onClick={showAbout}>what is this?</button>
                        <span aria-hidden="true">·</span>
                        <button type="button" className="shelf-head__link" onClick={startSignIn}>sign in</button>
                        {entries.length > 1 && (
                            <span className="shelf-dots" aria-hidden="true">
                                {entries.map((e, i) => <i key={e.fruitType} className={i === shelfIndex ? 'is-on' : ''} />)}
                            </span>
                        )}
                    </div>
                )}
            </div>
            {this.renderAddFruitPopup()}
            </>
        );
    }

    // Jelly (≤360px): the same five, one at a time with ‹ ›. "fruit for all" opens the
    // panel (sign in, about, filter); the strip comes back when it closes.
    renderShelfStrip() {
        const { shelf, shelfIndex, shelfFolded } = this.state;
        const entries = shelf ? shelf.entries : [];
        const i = shelfIndex >= 0 ? shelfIndex : 0;
        const e = entries[i];
        const openPanel = () => this.setState({ isCollapsed: false });
        const addFind = () => {
            sessionStorage.setItem('ffa_guest_add_attempted', '1');
            this.setState({ isCollapsed: false, ...getTinyScreenGuestAuthState('login') });
        };
        return (
            <>
            <div ref={this.setBottomBarRef} className={`shelf-strip${shelfFolded ? ' shelf--folded' : ''}`}>
                <div className="shelf-head shelf-head--strip">
                    <button type="button" className="shelf-head__name" onClick={openPanel} aria-label="fruit for all: menu">fruit for all</button>
                    {shelfFolded && (
                        <button type="button" className="shelf-head__link shelf-strip__show" onClick={() => this.setState({ shelfFolded: false })}>
                            in season ›
                        </button>
                    )}
                    <button type="button" className="btn shelf-head__add" onClick={addFind}>add a find</button>
                </div>
                {!shelfFolded && (e ? (
                    <div className="shelf-strip__row">
                        <button type="button" className="shelf-strip__step" aria-label="previous" onClick={() => this.stepShelf(-1)} disabled={entries.length < 2}>‹</button>
                        <button type="button" className="shelf-strip__entry" onClick={() => this.chooseShelfEntry(i)}>
                            <span className="shelf-strip__name">
                                <span className="shelf-entry__n">{i + 1}</span> {e.fruitType}
                            </span>
                            <span className="shelf-strip__meta">
                                {formatMiles(e.distanceMi)} · {i + 1} of {entries.length} in season
                                {shelf.tier === 'anywhere' ? ' · nearest' : ''}
                            </span>
                        </button>
                        <button type="button" className="shelf-strip__step" aria-label="next" onClick={() => this.stepShelf(1)} disabled={entries.length < 2}>›</button>
                    </div>
                ) : (
                    <div className="shelf-strip__row shelf-strip__row--empty">{this.renderShelfEmpty(addFind)}</div>
                ))}
            </div>
            {this.renderAddFruitPopup()}
            </>
        );
    }

    renderGuestBar() {

        const { guestAddAttempted, isLoginMode, authUserName, authPassword, authEmail,
            authLoading, authError, isForgotMode, forgotEmail, forgotLoading, forgotError, forgotSuccess,
            showAbout, guestBarOpen } = this.state;
        const startSignIn = () => this.setState({ guestAddAttempted: true, isLoginMode: true, showAbout: false, authError: '' });

        return (
            <>
            <div
                ref={this.setBottomBarRef}
                className={`guest-bar${guestAddAttempted || guestBarOpen ? ' guest-bar--expanded' : ''}`}
            >

                {!guestAddAttempted ? (
                    <>
                    {this.renderBarHandle(guestBarOpen, this.toggleGuestBar, 'nearby finds')}
                    {this.renderBarHeader(this.startAddFind)}
                    {guestBarOpen && (
                        <div className="guest-bar-landing">
                            {this.renderBarPanel()}
                            <div className="guest-bar-actions-row guest-bar-actions-row--filter">
                                {this.renderFruitFilter('fruit-filter-guest')}
                            </div>
                            <p className="guest-bar-about-link guest-bar-links-row">
                                <button type="button" onClick={startSignIn} className="secondary-link">sign in</button>
                                <span aria-hidden="true"> · </span>
                                <button
                                    type="button"
                                    onClick={() => this.setState({ guestAddAttempted: true, showAbout: true })}
                                    className="secondary-link"
                                >what is fruit for all?</button>
                            </p>
                        </div>
                    )}
                    </>
                ) : (
                    <div className="guest-bar-expanded-content">
                        <div className="guest-bar-expanded-header">
                            {this.renderLogo(28, 'guest-bar-icon')}
                            <div>
                                <p className="guest-bar-title">fruit for all</p>
                                <p className="guest-bar-expanded-kicker">open source orchard</p>
                            </div>
                        </div>

                        {showAbout ? (
                            <div className="about-copy about-copy--mobile">
                                <p className="about-copy-title">what is fruit for all?</p>
                                <p className="about-copy-body">free food is growing all around you — figs on sidewalks, citrus heavy with fruit, blackberries along the trail.</p>
                                <p className="about-copy-body">fruit for all maps it all so anyone can find it. spot something? add a pin.</p>
                                <p className="about-copy-body">only add finds genuinely accessible to anyone — nothing behind fences or on private property.</p>
                                <p className="about-copy-meta">open source — <a href="https://github.com/strangesongs/fruit-for-all" className="about-link-ext" target="_blank" rel="noreferrer">view on github</a></p>
                                <p className="about-copy-meta">say hello — <a href="mailto:admin@fruitforall.app" className="about-link-ext">admin@fruitforall.app</a></p>
                                <p className="toggle-auth">
                                    <button type="button" onClick={() => this.setState({ showAbout: false, guestAddAttempted: false })} className="toggle-link">← back</button>
                                </p>
                            </div>
                        ) : (
                            <AuthForm variant="bar" {...this.authFormProps()} />
                        )}
                    </div>
                )}
            </div>
            {this.renderAddFruitPopup()}
            </>
        );
    }

    // Props for <AuthForm>: the state it shows and the callbacks it fires.
    authFormProps() {
        const {
            isLoginMode, isForgotMode, authUserName, authEmail, authPassword, authLoading, authError,
            forgotEmail, forgotLoading, forgotError, forgotSuccess,
        } = this.state;
        return {
            isLoginMode, isForgotMode, authUserName, authEmail, authPassword, authLoading, authError,
            forgotEmail, forgotLoading, forgotError, forgotSuccess,
            onFieldChange: this.handleInputChange,
            onForgotEmailChange: (value) => this.setState({ forgotEmail: value }),
            onLogin: this.handleLogin,
            onRegister: this.handleRegister,
            onForgot: this.handleForgotPassword,
            onToggleMode: this.toggleAuthMode,
            onShowForgot: () => this.setState({ isForgotMode: true, authError: '' }),
            onBackToSignIn: () => this.setState({ isForgotMode: false, forgotSuccess: false, forgotError: '', forgotEmail: '' }),
            onLeave: () => {
                try { sessionStorage.removeItem('ffa_guest_add_attempted'); } catch (e) { /* private mode */ }
                this.setState({ guestAddAttempted: false, authError: '', isForgotMode: false });
            },
            // Came from "add a find": the form says why an account (AuthForm's Why)
            forAdd: (() => { try { return sessionStorage.getItem('ffa_guest_add_attempted') === '1'; } catch (e) { return false; } })(),
        };
    }

    // Rendered by every layout: the add/edit flow (while it's open) and the notice line.
    renderAddFruitPopup() {
        const { addFind, notice } = this.state;
        return (
            <>
                {addFind && (
                    <AddFind
                        key={addFind.mode === 'edit' ? `edit-${addFind.pin.pinId}` : 'add'}
                        mode={addFind.mode}
                        pin={addFind.pin || null}
                        isAdmin={isAdmin()}
                        isTiny={this.state.isTinyScreen}
                        onClose={this.closeAddFind}
                    />
                )}
                {notice && <p className="ffa-notice" role="status">{notice}</p>}
            </>
        );
    }

    renderMobileLayout() {
        const { isCollapsed, myPinsActive, authenticated, guestAddAttempted,
                isLoginMode, authUserName, authPassword, authEmail, authLoading, authError,
                showAbout, isForgotMode, forgotEmail, forgotLoading, forgotError, forgotSuccess,
                pinCount } = this.state;
        const currentUser = getUser();
        const inSeasonFruits = this.getInSeasonFruits();

        return (
            <>
            {/* Persistent circular FAB — always visible at bottom-left */}
            <button
                className="mobile-fab"
                onClick={this.toggleSidebar}
                aria-label={isCollapsed ? 'open menu' : 'close menu'}
            >
                {isCollapsed
                    ? this.renderLogo(42, 'hamburger-icon')
                    : <span className="mobile-fab-close" aria-hidden="true">×</span>
                }
            </button>

            {/* Compact panel — anchored just above the FAB */}
            {!isCollapsed && (
                <div className="mobile-panel">
                    <div className="mobile-panel-header">
                        {this.renderLogo(36, 'mobile-panel-logo', 'fruit for all')}
                        <div>
                            <div className="mobile-panel-title">fruit for all</div>
                            <div className="mobile-panel-subtitle">open source orchard</div>
                        </div>
                    </div>

                    {authenticated && currentUser && (
                        <p className="mobile-panel-welcome">welcome, {currentUser.userName}!</p>
                    )}

                    {!guestAddAttempted && !showAbout && (
                        <div className="mobile-panel-season">
                            <p className="mobile-panel-month">{MONTH_NAMES[new Date().getMonth()]}</p>
                            <p className="mobile-panel-count">
                                {pinCount > 0
                                    ? `${this.state.summary ? this.state.summary.ripeCount : 0} in season · ${pinCount} ${pinCount === 1 ? 'find' : 'finds'} in view`
                                    : 'nothing logged in view yet'}
                            </p>
                        </div>
                    )}

                    {/* Guest: about panel */}
                    {!authenticated && showAbout ? (
                        <div className="mobile-panel-auth">
                            <p className="mobile-panel-auth-head">what is fruit for all?</p>
                            <div className="about-copy">
                                <p className="about-copy-body">free food is growing all around you — figs on sidewalks, citrus heavy with fruit, blackberries along the trail.</p>
                                <p className="about-copy-body">fruit for all maps it all so anyone can find it. spot something? add a pin.</p>
                                <p className="about-copy-body">only add finds genuinely accessible to anyone — nothing behind fences or on private property.</p>
                                <p className="about-copy-meta">open source — <a href="https://github.com/strangesongs/fruit-for-all" className="about-link-ext" target="_blank" rel="noreferrer">view on github</a></p>
                                <p className="about-copy-meta">say hello — <a href="mailto:admin@fruitforall.app" className="about-link-ext">admin@fruitforall.app</a></p>
                            </div>
                            <p className="toggle-auth">
                                <button type="button" onClick={() => this.setState({ showAbout: false })} className="toggle-link">← back</button>
                            </p>
                        </div>
                    ) : !authenticated && guestAddAttempted ? (
                        <div className="mobile-panel-auth">
                            <AuthForm variant="panel" {...this.authFormProps()} />
                        </div>
                    ) : (
                        /* Default panel actions */
                        <div className="mobile-panel-actions">
                            <button type="button" onClick={this.startAddFind} className="mobile-panel-btn">
                                add a find
                            </button>
                            {authenticated && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        const next = !myPinsActive;
                                        this.setState({ myPinsActive: next, isCollapsed: next ? true : isCollapsed });
                                        if (this.props.onToggleMyPins) this.props.onToggleMyPins();
                                    }}
                                    className={`mobile-panel-btn${myPinsActive ? ' btn-active' : ''}`}
                                >
                                    my pins
                                </button>
                            )}
                        </div>
                    )}

                    {(!guestAddAttempted || authenticated) && !showAbout && (
                    <div className="mobile-panel-filter">
                        <select
                            value={this.state.selectedFruitFilter}
                            onChange={(e) => {
                                this.setState({ selectedFruitFilter: e.target.value });
                                if (this.props.onFilterChange) this.props.onFilterChange(e.target.value);
                            }}
                            className="fruit-filter-select"
                        >
                            <option value="all">all fruits</option>
                            {this.state.availableFruitTypes.map(fruit => (
                                <option key={fruit} value={fruit}>{fruit}</option>
                            ))}
                        </select>
                    </div>
                    )}

                    {authenticated ? (
                        <button type="button" className="mobile-panel-btn mobile-panel-logout-btn" onClick={this.handleLogout}>
                            logout
                        </button>
                    ) : !guestAddAttempted && (
                        <>
                        <p className="toggle-auth" style={{marginTop: '8px', marginBottom: '2px'}}>
                            <button
                                type="button"
                                onClick={() => {
                                    sessionStorage.removeItem('ffa_guest_add_attempted');
                                    this.setState(getTinyScreenGuestAuthState('login'));
                                }}
                                className="toggle-link"
                            >sign in</button>
                            {' / '}
                            <button
                                type="button"
                                onClick={() => {
                                    sessionStorage.removeItem('ffa_guest_add_attempted');
                                    this.setState(getTinyScreenGuestAuthState('register'));
                                }}
                                className="toggle-link"
                            >register</button>
                        </p>
                        <p className="toggle-auth" style={{marginBottom: '2px'}}>
                            <button
                                type="button"
                                onClick={() => this.setState({ showAbout: true })}
                                className="secondary-link"
                            >what is fruit for all?</button>
                        </p>
                        </>
                    )}
                </div>
            )}

            {/* Add fruit popup — fixed overlay, renders above panel */}
            {this.renderAddFruitPopup()}
            </>
        );
    }

    render () {
        const { authenticated, guestAddAttempted, isLoginMode, authUserName, authPassword, authEmail, authLoading, authError, isTinyScreen, isStandardMobile } = this.state;
        const currentUser = getUser();

        // Season shelf (?landing=shelf): the signed-out landing on phones and the Jelly.
        const shelf = this._shelfOn && !authenticated;

        // Tiny screen (Jelly Star ≤360px): always use the mobile panel layout
        // (with the shelf on, the strip stands in for the FAB while the panel is closed)
        if (isTinyScreen) {
            return shelf && this.state.isCollapsed ? this.renderShelfStrip() : this.renderMobileLayout();
        }

        // Standard mobile (361–768px) guest: living bar at bottom
        if (!authenticated && isStandardMobile) {
            return shelf && !guestAddAttempted ? this.renderShelfBar() : this.renderGuestBar();
        }

        // Standard mobile (361–768px) authenticated: action bar at bottom
        if (authenticated && isStandardMobile) {
            return this.renderAuthenticatedBar();
        }

        return (
        <>
        <div className={`sidebar ${this.state.isCollapsed ? 'collapsed' : ''} ${authenticated ? 'sidebar--authenticated' : ''}`}>
            {/* Hamburger menu button */}
            <button className="hamburger-btn" onClick={this.toggleSidebar} aria-label="Toggle menu">
                {this.state.isCollapsed ? (
                    this.renderLogo(58, 'hamburger-icon')
                ) : (
                    <>
                        <span></span>
                        <span></span>
                        <span></span>
                    </>
                )}
            </button>
            
            {/* Only show content when not collapsed */}
            {!this.state.isCollapsed && (
            <>
            {/* Logo and branding at top */}
            <div className="header-section">
                <p>fruit for all</p>
                <p>open source orchard</p>
                {this.renderLogo(24, 'lil-fruit')}
            </div>

            {/* Guest browsing: map + filter visible, sign-in offered as CTA */}
            {!authenticated && !guestAddAttempted ? (
                <>
                    <div className="action-buttons">
                        <button
                            type="button"
                            onClick={this.startAddFind}
                            className="btn action-btn add-fruit-btn"
                        >add a find</button>
                    </div>

                    <div className="filter-section">
                        <label htmlFor="fruit-filter">filter by type:</label>
                        <select
                            id="fruit-filter"
                            value={this.state.selectedFruitFilter}
                            onChange={(e) => {
                                this.setState({ selectedFruitFilter: e.target.value });
                                if (this.props.onFilterChange) this.props.onFilterChange(e.target.value);
                            }}
                            className="fruit-filter-select"
                        >
                            <option value="all">all fruits</option>
                            {this.state.availableFruitTypes.map(fruit => (
                                <option key={fruit} value={fruit}>{fruit}</option>
                            ))}
                        </select>
                    </div>

                    <div className="bottom-section">
                        <p className="toggle-auth">
                            <button
                                type="button"
                                onClick={(e) => {
                                    e.preventDefault();
                                    sessionStorage.removeItem('ffa_guest_add_attempted');
                                    this.setState({
                                        guestAddAttempted: true,
                                        isLoginMode: true,
                                        showAbout: false,
                                        authError: '',
                                        authUserName: '',
                                        authPassword: '',
                                        authEmail: '',
                                        isForgotMode: false,
                                        forgotEmail: '',
                                        forgotError: '',
                                        forgotSuccess: false
                                    }, () => this.forceUpdate());
                                }}
                                className="toggle-link"
                            >sign in</button>
                            {' / '}
                            <button
                                type="button"
                                onClick={(e) => {
                                    e.preventDefault();
                                    sessionStorage.removeItem('ffa_guest_add_attempted');
                                    this.setState({
                                        guestAddAttempted: true,
                                        isLoginMode: false,
                                        showAbout: false,
                                        authError: '',
                                        authUserName: '',
                                        authPassword: '',
                                        authEmail: '',
                                        isForgotMode: false,
                                        forgotEmail: '',
                                        forgotError: '',
                                        forgotSuccess: false
                                    }, () => this.forceUpdate());
                                }}
                                className="toggle-link"
                            >create account</button>
                        </p>
                        <p className="toggle-auth">
                            <button type="button" onClick={() => {
                                sessionStorage.removeItem('ffa_guest_add_attempted');
                                this.setState({ showAbout: true, guestAddAttempted: false });
                            }} className="secondary-link">what is fruit for all?</button>
                        </p>
                    </div>
                </>

            ) : !authenticated && guestAddAttempted ? (
                /* Guest has tapped "add a find" or sign-in: show inline auth */
                <div className="auth-section">
                    {this.state.showAbout ? (
                        <div className="about-panel">
                            <h3 className="about-title">what is fruit for all?</h3>
                            <p>free food is growing all around you — figs dropping on sidewalks, citrus trees heavy with fruit, blackberries along the trail, herbs perfuming the street corner.</p>
                            <p>fruit for all maps it all so anyone can find it.</p>
                            <p>spot something? add a pin and some notes. the map gets richer every time someone shares a find — a living record of a world blossoming with abundance.</p>
                            <p>only add finds that are genuinely accessible to anyone — nothing behind fences or on private property.</p>
                            <p className="about-oss">open source &mdash; <a href="https://github.com/strangesongs/fruit-for-all" className="about-link-ext" target="_blank" rel="noreferrer">view on github</a></p>
                            <p className="about-oss">say hello &mdash; <a href="mailto:admin@fruitforall.app" className="about-link-ext">admin@fruitforall.app</a></p>
                            <p className="toggle-auth">
                                <button type="button" onClick={() => this.setState({ showAbout: false })} className="toggle-link about-back">← back</button>
                            </p>
                        </div>
                    ) : (
                        <AuthForm variant="desktop" {...this.authFormProps()} />
                    )}
                </div>

            ) : (
                /* Authenticated UI */
                <>
                    {currentUser && (
                        <div className="user-info">
                            <p className="welcome-text">welcome, {currentUser.userName}!</p>
                        </div>
                    )}

                    <div className="action-buttons">
                        <button
                            type="button"
                            onClick={this.startAddFind}
                            className="btn action-btn add-fruit-btn"
                        >add a find</button>

                        <button
                            type="button"
                            onClick={(e) => {
                                e.preventDefault();
                                const next = !this.state.myPinsActive;
                                this.setState({ myPinsActive: next, isCollapsed: next ? true : this.state.isCollapsed });
                                if (this.props.onToggleMyPins) this.props.onToggleMyPins();
                            }}
                            className={`btn action-btn${this.state.myPinsActive ? ' btn-active' : ''}`}
                        >my pins</button>
                    </div>

                    <div className="filter-section">
                        <label htmlFor="fruit-filter">filter by type:</label>
                        <select
                            id="fruit-filter"
                            value={this.state.selectedFruitFilter}
                            onChange={(e) => {
                                this.setState({ selectedFruitFilter: e.target.value });
                                if (this.props.onFilterChange) this.props.onFilterChange(e.target.value);
                            }}
                            className="fruit-filter-select"
                        >
                            <option value="all">all fruits</option>
                            {this.state.availableFruitTypes.map(fruit => (
                                <option key={fruit} value={fruit}>{fruit}</option>
                            ))}
                        </select>
                    </div>

                    {isAdmin() && this.renderAdminEntry()}

                    <div className="bottom-section">
                        <button
                            type="button"
                            className="btn logout-btn"
                            onClick={this.handleLogout}
                        >logout</button>
                    </div>
                </>
            )}
            </>
            )}
        </div>
        {this.renderAddFruitPopup()}
        </>
        )
    };

};
