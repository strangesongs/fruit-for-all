import React, { Component } from 'react';
import loquatIcon from '../loquat-48.png';
import { getAuthHeader, getUser, clearAuth, saveAuth, isAuthenticated, handleUnauthorized, SESSION_EXPIRED_EVENT } from './utils/auth.js';
import { FRUIT_SEASONS, getSeasonStatus } from './utils/fruitSeasons.js';
import { FRUIT_LIST } from './utils/fruitList.js';
import { API_BASE } from './utils/config.js';
import { containsProfanity } from './utils/profanity.js';
import { getTinyScreenGuestAuthState } from './utils/sidebarState.js';
import { familyLabel, markSvg, familyOf } from './utils/fruitFamilies.js';
import { formatMiles, MONTH_NAMES } from './utils/pinSummary.js';
import { fetchWithRetry } from './utils/network.js';

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
            
            // Pin submission form state
            currentLocation: null,
            fruitType: '',
            notes: '',
            submitting: false,
            showAddFruitPopup: false,
            
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

            // Fruit type autocomplete
            fruitTypeSuggestions: [],
            showFruitSuggestions: false,

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
        }
        this.addFruitPopupRef = React.createRef();
        this.addFruitPopupTitleId = 'add-fruit-popup-title';
        this.lastFocusedElement = null;
        this.previousBodyOverflow = '';
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
        if (isAuthenticated() && this.state.showAddFruitPopup) {
            this.setState({ showAddFruitPopup: false });
        }
        if (!this.state.guestAddAttempted && !isAuthenticated()) {
            sessionStorage.removeItem('ffa_guest_add_attempted');
        }
        window.addEventListener('ffa:pins-summary', this.handlePinSummaryEvent);
        try { localStorage.setItem(GUEST_BAR_SEEN_KEY, '1'); } catch { /* private mode */ }
        window.addEventListener('ffa:add-find', this.handleAddFindRequest);
        window.addEventListener(SESSION_EXPIRED_EVENT, this.handleSessionExpired);
        if (this.state.showAddFruitPopup) {
            this.enableAddFruitPopupA11ySideEffects();
        }
    }

    componentWillUnmount() {
        window.removeEventListener('ffa:add-find', this.handleAddFindRequest);
        window.removeEventListener(SESSION_EXPIRED_EVENT, this.handleSessionExpired);
        this.setBottomBarRef(null);
        window.removeEventListener('ffa:pins-summary', this.handlePinSummaryEvent);
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
        this.disableAddFruitPopupA11ySideEffects();
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

    // "add the first find" on the map's empty-area card
    handleAddFindRequest = () => {
        if (!this.state.showAddFruitPopup) this.toggleAddFruitPopup();
    };

    flyTo = (coords) => {
        if (!coords) return;
        this.setState({ guestBarOpen: false, isMobileBarOpen: false });
        window.dispatchEvent(new CustomEvent('ffa:fly-to', { detail: coords }));
    };

    componentDidUpdate(prevProps, prevState) {
        if (!prevState.showAddFruitPopup && this.state.showAddFruitPopup) {
            this.enableAddFruitPopupA11ySideEffects();
        }
        if (prevState.showAddFruitPopup && !this.state.showAddFruitPopup) {
            this.disableAddFruitPopupA11ySideEffects();
        }
    }

    getFocusableElementsInPopup = () => {
        if (!this.addFruitPopupRef.current) return [];
        return [...this.addFruitPopupRef.current.querySelectorAll(
            'button:not([disabled]), [href], input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )];
    };

    focusFirstPopupElement = () => {
        const focusable = this.getFocusableElementsInPopup();
        if (focusable.length > 0) {
            focusable[0].focus();
            return;
        }
        this.addFruitPopupRef.current?.focus();
    };

    handleAddFruitPopupKeyDown = (e) => {
        if (!this.state.showAddFruitPopup) return;

        if (e.key === 'Escape') {
            e.preventDefault();
            if (!this.state.submitting) {
                this.toggleAddFruitPopup();
            }
            return;
        }

        if (e.key !== 'Tab') return;

        const focusable = this.getFocusableElementsInPopup();
        if (focusable.length === 0) {
            e.preventDefault();
            return;
        }

        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        const active = document.activeElement;

        if (e.shiftKey && active === first) {
            e.preventDefault();
            last.focus();
        } else if (!e.shiftKey && active === last) {
            e.preventDefault();
            first.focus();
        }
    };

    enableAddFruitPopupA11ySideEffects = () => {
        this.lastFocusedElement = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        this.previousBodyOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        document.addEventListener('keydown', this.handleAddFruitPopupKeyDown);
        window.setTimeout(this.focusFirstPopupElement, 0);
    };

    disableAddFruitPopupA11ySideEffects = () => {
        document.removeEventListener('keydown', this.handleAddFruitPopupKeyDown);
        document.body.style.overflow = this.previousBodyOverflow || '';
        if (this.lastFocusedElement && document.contains(this.lastFocusedElement)) {
            this.lastFocusedElement.focus();
        }
        this.lastFocusedElement = null;
    }

    getCurrentLocation = () => {
        if (!navigator.geolocation) {
            this.setState({ locationError: 'geolocation is not supported by this browser.' });
            return;
        }
        this.setState({ locationLoading: true, locationError: '' });
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const loc = { lat: position.coords.latitude, lng: position.coords.longitude };
                try { sessionStorage.setItem('ffa_last_location', JSON.stringify(loc)); } catch (e) {}
                this.setState({ locationLoading: false, currentLocation: loc });
            },
            (error) => {
                console.error('Error getting location:', error);
                const msg = error.code === 1
                    ? 'location permission denied. please allow location access in your browser settings.'
                    : error.code === 2
                    ? 'location unavailable. try moving to a better signal area.'
                    : 'location request timed out. please try again.';
                this.setState({ locationLoading: false, locationError: msg });
            },
            { timeout: 10000, maximumAge: 60000, enableHighAccuracy: false }
        );
    };

    handleInputChange = (field, value) => {
        this.setState({ [field]: value });
    };

    toggleAddFruitPopup = () => {
        if (!isAuthenticated()) {
            sessionStorage.setItem('ffa_guest_add_attempted', '1');
            this.setState({ guestAddAttempted: true });
            return;
        }
        this.setState(prevState => {
            const opening = !prevState.showAddFruitPopup;
            let currentLocation = opening ? null : prevState.currentLocation;
            return {
                showAddFruitPopup: !prevState.showAddFruitPopup,
                currentLocation,
                fruitType: opening ? '' : prevState.fruitType,
                notes: opening ? '' : prevState.notes,
            };
        });
    };

    submitPin = async () => {
        const { currentLocation, fruitType, notes } = this.state;

        if (!currentLocation) {
            alert('please get your current location first');
            return;
        }

        if (!fruitType.trim()) {
            alert('please select a fruit type');
            return;
        }

        if (!FRUIT_LIST.includes(fruitType.trim().toLowerCase())) {
            alert('please select a fruit from the list');
            return;
        }

        if (containsProfanity(notes)) {
            alert('please keep notes family-friendly.');
            return;
        }

        this.setState({ submitting: true });
        const controller = this.startRequest();

        try {
            const response = await fetchWithRetry(`${API_BASE}/api/pins`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...getAuthHeader()
                },
                signal: controller.signal,
                body: JSON.stringify({
                    coordinates: currentLocation,
                    fruitType: fruitType.trim(),
                    notes: notes.trim()
                })
            }, {
                timeoutMs: 12000,
                retries: 0, // POSTs are not idempotent: never auto-retry
            });
            if (handleUnauthorized(response)) return;

            const result = await response.json();

            if (result.success) {
                alert('pin submitted successfully!');
                // Reset form and close popup
                this.setState({
                    currentLocation: null,
                    fruitType: '',
                    notes: '',
                    showAddFruitPopup: false
                });
                // Notify parent component to refresh map if callback provided
                if (this.props.onPinSubmitted) {
                    this.props.onPinSubmitted(result.pin);
                }
            } else {
                alert('error submitting pin: ' + result.message);
            }
        } catch (error) {
            if (controller.signal.aborted) return;
            console.error('Error submitting pin:', error);
            alert('error submitting pin. please try again.');
        } finally {
            this.finishRequest(controller);
            this.setState({ submitting: false });
        }
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

    handleFruitTypeInput = (e) => {
        const val = e.target.value;
        const suggestions = val.trim().length > 0
            ? FRUIT_LIST.filter(f => f.toLowerCase().startsWith(val.toLowerCase())).slice(0, 8)
            : FRUIT_LIST.slice(0, 8);
        this.setState({ fruitType: val, fruitTypeSuggestions: suggestions, showFruitSuggestions: true });
    };

    selectFruitType = (fruit) => {
        this.setState({ fruitType: fruit, showFruitSuggestions: false, fruitTypeSuggestions: [] });
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
                // Always clear guest add flag on login
                sessionStorage.removeItem('ffa_guest_add_attempted');
                saveAuth(result.token, result.user);
                this.setState({ 
                    authenticated: true,
                    guestAddAttempted: false,
                    authUserName: '',
                    authPassword: '',
                    authError: '',
                    isCollapsed: this.state.isTinyScreen,
                    showAddFruitPopup: false,
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
                    showAddFruitPopup: !!wasGuestAddAttempted,
                });
                // Notify parent to refresh pins
                if (this.props.onAuthSuccess) {
                    this.props.onAuthSuccess();
                }
            } else {
                // Always clear guest add flag and modal on failed registration
                sessionStorage.removeItem('ffa_guest_add_attempted');
                this.setState({ showAddFruitPopup: false });
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
        this.setState({ isCollapsed: true, guestBarOpen: false, isMobileBarOpen: false });
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

    renderMark(family, size = 22) {
        return (
            <span
                className="bar-mark"
                aria-hidden="true"
                dangerouslySetInnerHTML={{ __html: markSvg(family, { size, strokeWidth: 1.6 }) }}
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
                <img src={loquatIcon} className="guest-bar-icon" alt="fruit for all" />
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
                                        {this.renderMark(r.family, 18)}<span className="almanac__name">{r.fruitType}</span>
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
                    this.toggleAddFruitPopup();
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
                    {this.renderBarHeader(startSignIn)}
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
                            <img src={loquatIcon} className="guest-bar-icon" alt="" />
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
                        ) : isForgotMode ? (
                            forgotSuccess ? (
                                <div>
                                    <p className="auth-success-msg">if that email is registered, a reset link has been sent.</p>
                                    <p className="toggle-auth">
                                        <button type="button" onClick={() => this.setState({ isForgotMode: false, forgotSuccess: false, forgotEmail: '' })} className="toggle-link">back to sign in</button>
                                        {' · '}
                                        <button type="button" onClick={() => this.setState({ guestAddAttempted: false, authError: '', isForgotMode: false })} className="toggle-link">browse as guest</button>
                                    </p>
                                </div>
                            ) : (
                                <form onSubmit={this.handleForgotPassword} className="guest-bar-form">
                                    <div className="form-group">
                                        <input
                                            type="email"
                                            value={forgotEmail}
                                            onChange={(e) => this.setState({ forgotEmail: e.target.value })}
                                            placeholder="your email address"
                                        autoComplete="email"
                                            disabled={forgotLoading}
                                        />
                                    </div>
                                    {forgotError && <p className="error-message">{forgotError}</p>}
                                    <button type="submit" className="auth-submit-btn" disabled={forgotLoading}>
                                        {forgotLoading ? 'please wait...' : 'send reset link'}
                                    </button>
                                    <p className="toggle-auth">
                                        <button type="button" onClick={() => this.setState({ isForgotMode: false, forgotError: '', forgotEmail: '' })} className="toggle-link">back to sign in</button>
                                        {' · '}
                                        <button type="button" onClick={() => this.setState({ guestAddAttempted: false, authError: '', isForgotMode: false })} className="toggle-link">browse as guest</button>
                                    </p>
                                </form>
                            )
                        ) : (
                            <form onSubmit={isLoginMode ? this.handleLogin : this.handleRegister} className="guest-bar-form">
                                <div className="form-group">
                                    <input
                                        type="text"
                                        value={authUserName}
                                        onChange={(e) => this.handleInputChange('authUserName', e.target.value)}
                                        placeholder="username"
                                        autoComplete="username"
                                        autoCapitalize="none"
                                        autoCorrect="off"
                                        spellCheck={false}
                                        disabled={authLoading}
                                    />
                                </div>
                                {!isLoginMode && (
                                    <div className="form-group">
                                        <input
                                            type="email"
                                            value={authEmail}
                                            onChange={(e) => this.handleInputChange('authEmail', e.target.value)}
                                            placeholder="email"
                                        autoComplete="email"
                                            disabled={authLoading}
                                        />
                                    </div>
                                )}
                                <div className="form-group">
                                    <input
                                        type="password"
                                        value={authPassword}
                                        onChange={(e) => this.handleInputChange('authPassword', e.target.value)}
                                        placeholder="password"
                                        autoComplete={isLoginMode ? 'current-password' : 'new-password'}
                                        disabled={authLoading}
                                    />
                                    {!isLoginMode && <p className="password-hint">min 10 chars, 1 number, 1 symbol</p>}
                                </div>
                                {authError && <p className="error-message">{authError}</p>}
                                <button type="submit" className="auth-submit-btn" disabled={authLoading}>
                                    {authLoading ? 'please wait...' : (isLoginMode ? 'sign in' : 'create account')}
                                </button>
                                {isLoginMode ? (
                                    <>
                                        <p className="toggle-auth toggle-auth-tight">
                                            <button type="button" onClick={this.toggleAuthMode} className="toggle-link">no account? register</button>
                                        </p>
                                        {this.renderForgotPasswordAction('toggle-auth toggle-auth-tight')}
                                        <p className="toggle-auth">
                                            <button type="button" onClick={() => this.setState({ guestAddAttempted: false, authError: '' })} className="toggle-link">browse as guest</button>
                                        </p>
                                    </>
                                ) : (
                                    <>
                                        <p className="toggle-auth toggle-auth-tight">
                                            <button type="button" onClick={this.toggleAuthMode} className="toggle-link">have account? sign in</button>
                                        </p>
                                        <p className="toggle-auth">
                                            <button type="button" onClick={() => this.setState({ guestAddAttempted: false, authError: '' })} className="toggle-link">browse as guest</button>
                                        </p>
                                    </>
                                )}
                            </form>
                        )}
                    </div>
                )}
            </div>
            {this.renderAddFruitPopup()}
            </>
        );
    }

    renderForgotPasswordAction = (className = 'toggle-auth') => (
        <p className={className}>
            <button
                type="button"
                onClick={() => this.setState({ isForgotMode: true, authError: '' })}
                className="toggle-link"
            >
                forgot password?
            </button>
        </p>
    );

    renderAddFruitPopup() {
        if (!this.state.showAddFruitPopup) return null;
        return (
            <div className="add-fruit-popup-overlay">
                <div
                    className="add-fruit-popup"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby={this.addFruitPopupTitleId}
                    ref={this.addFruitPopupRef}
                    tabIndex="-1"
                >
                    <div className="popup-header">
                        <h4 id={this.addFruitPopupTitleId}>add a find</h4>
                    </div>
                    <div className="popup-content">
                        <div className="popup-section">
                            <label>location:</label>
                            <button
                                type="button"
                                onClick={this.getCurrentLocation}
                                className="location-btn"
                                disabled={this.state.submitting || this.state.locationLoading}
                            >
                                {this.state.locationLoading ? 'getting location...' : this.state.currentLocation ? 'update location' : 'get current location'}
                            </button>
                            {this.state.locationError && (
                                <p className="error-message" style={{marginTop: '4px'}}>{this.state.locationError}</p>
                            )}
                            {this.state.currentLocation && (
                                <div className="location-display">
                                    <small>{this.state.currentLocation.lat.toFixed(6)}, {this.state.currentLocation.lng.toFixed(6)}</small>
                                </div>
                            )}
                        </div>
                        <div className="popup-section fruit-autocomplete-wrapper">
                            <label htmlFor="popup-fruit-type">forage type:</label>
                            <input
                                type="text"
                                id="popup-fruit-type"
                                value={this.state.fruitType}
                                onChange={this.handleFruitTypeInput}
                                onFocus={this.handleFruitTypeInput}
                                onBlur={() => setTimeout(() => this.setState({ showFruitSuggestions: false }), 150)}
                                placeholder="type to search..."
                                autoComplete="off"
                                disabled={this.state.submitting}
                            />
                            {this.state.showFruitSuggestions && this.state.fruitTypeSuggestions.length > 0 && (
                                <ul className="fruit-suggestions">
                                    {this.state.fruitTypeSuggestions.map(fruit => (
                                        <li key={fruit}>
                                            <button
                                                type="button"
                                                onClick={() => this.selectFruitType(fruit)}
                                                onMouseDown={(e) => e.preventDefault()}
                                                className={`fruit-suggestion-btn${this.state.fruitType === fruit ? ' fruit-suggestion-active' : ''}`}
                                            >
                                                {fruit}
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            )}
                            {this.state.fruitType && !FRUIT_LIST.includes(this.state.fruitType.toLowerCase()) && (
                                <p className="fruit-not-found">no match &mdash; keep typing or select from the list</p>
                            )}
                        </div>
                        {familyOf((this.state.fruitType || '').trim()) === 'medicinal' && (
                            <p className="add-find-caution">
                                know the plant for certain before you pick it, take only a little from each plant,
                                and check with a clinician before using it as medicine.
                            </p>
                        )}
                        <div className="popup-section">
                            <label htmlFor="popup-notes">notes (optional):</label>
                            <textarea
                                id="popup-notes"
                                value={this.state.notes}
                                onChange={(e) => this.handleInputChange('notes', e.target.value)}
                                placeholder="add details about this location... (up to 500 words)"
                                rows="4"
                                maxLength="3000"
                                disabled={this.state.submitting}
                            />
                        </div>
                    </div>
                    <div className="popup-footer">
                        <button
                            type="submit"
                            onClick={this.submitPin}
                            disabled={this.state.submitting || !this.state.currentLocation || !FRUIT_LIST.includes((this.state.fruitType || '').trim().toLowerCase())}
                            className="submit-btn"
                        >
                            {this.state.submitting ? 'submitting...' : 'submit pin'}
                        </button>
                        <button
                            type="button"
                            onClick={this.toggleAddFruitPopup}
                            disabled={this.state.submitting}
                            className="cancel-btn"
                        >cancel</button>
                    </div>
                </div>
            </div>
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
                    ? <img src={loquatIcon} className="hamburger-icon" alt="open menu" />
                    : <span className="mobile-fab-close" aria-hidden="true">×</span>
                }
            </button>

            {/* Compact panel — anchored just above the FAB */}
            {!isCollapsed && (
                <div className="mobile-panel">
                    <div className="mobile-panel-header">
                        <img src={loquatIcon} className="mobile-panel-logo" alt="fruit for all" />
                        <div>
                            <div className="mobile-panel-title">fruit for all</div>
                            <div className="mobile-panel-subtitle">open source orchard</div>
                        </div>
                    </div>

                    {authenticated && currentUser && (
                        <p className="mobile-panel-welcome">welcome, {currentUser.userName}!</p>
                    )}

                    {!authenticated && !guestAddAttempted && !showAbout && pinCount > 0 && (
                        <p className="mobile-panel-count">
                            {pinCount} {pinCount === 1 ? 'find' : 'finds'} in view
                        </p>
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
                            {isForgotMode ? (
                                forgotSuccess ? (
                                    <div>
                                        <p className="auth-success-msg">if that email is registered, a reset link has been sent.</p>
                                        <p className="toggle-auth">
                                            <button type="button" onClick={() => this.setState({ isForgotMode: false, forgotSuccess: false, forgotEmail: '' })} className="toggle-link">back to sign in</button>
                                        </p>
                                        <p className="toggle-auth">
                                            <button type="button" onClick={() => this.setState({ guestAddAttempted: false, authError: '', isForgotMode: false })} className="toggle-link">browse as guest</button>
                                        </p>
                                    </div>
                                ) : (
                                    <>
                                        <p className="mobile-panel-auth-head">reset password</p>
                                        <form onSubmit={this.handleForgotPassword}>
                                            <div className="form-group">
                                                <input
                                                    type="email"
                                                    value={forgotEmail}
                                                    onChange={(e) => this.setState({ forgotEmail: e.target.value })}
                                                    placeholder="your email address"
                                        autoComplete="email"
                                                    disabled={forgotLoading}
                                                />
                                            </div>
                                            {forgotError && <p className="error-message">{forgotError}</p>}
                                            <button type="submit" className="auth-submit-btn" disabled={forgotLoading}>
                                                {forgotLoading ? 'please wait...' : 'send reset link'}
                                            </button>
                                        </form>
                                        <p className="toggle-auth">
                                            <button type="button" onClick={() => this.setState({ isForgotMode: false, forgotError: '', forgotEmail: '' })} className="toggle-link">back to sign in</button>
                                        </p>
                                    </>
                                )
                            ) : (
                                <>
                                    <p className="mobile-panel-auth-head">
                                        {isLoginMode ? 'sign in to add a find' : 'create account'}
                                    </p>
                                    <form onSubmit={isLoginMode ? this.handleLogin : this.handleRegister}>
                                        <div className="form-group">
                                            <input
                                                type="text"
                                                value={authUserName}
                                                onChange={(e) => this.handleInputChange('authUserName', e.target.value)}
                                                placeholder="username"
                                        autoComplete="username"
                                        autoCapitalize="none"
                                        autoCorrect="off"
                                        spellCheck={false}
                                                disabled={authLoading}
                                            />
                                        </div>
                                        {!isLoginMode && (
                                            <div className="form-group">
                                                <input
                                                    type="email"
                                                    value={authEmail}
                                                    onChange={(e) => this.handleInputChange('authEmail', e.target.value)}
                                                    placeholder="email"
                                        autoComplete="email"
                                                    disabled={authLoading}
                                                />
                                            </div>
                                        )}
                                        <div className="form-group">
                                            <input
                                                type="password"
                                                value={authPassword}
                                                onChange={(e) => this.handleInputChange('authPassword', e.target.value)}
                                                placeholder="password"
                                        autoComplete={isLoginMode ? 'current-password' : 'new-password'}
                                                disabled={authLoading}
                                            />
                                            {!isLoginMode && (
                                                <p className="password-hint">min 10 chars, 1 number, 1 symbol</p>
                                            )}
                                        </div>
                                        {authError && <p className="error-message">{authError}</p>}
                                        <button type="submit" className="auth-submit-btn" disabled={authLoading}>
                                            {authLoading ? 'please wait...' : (isLoginMode ? 'sign in' : 'create account')}
                                        </button>
                                    </form>
                                    <p className="toggle-auth">
                                        {isLoginMode ? 'no account? ' : 'have account? '}
                                        <button type="button" onClick={this.toggleAuthMode} className="toggle-link">
                                            {isLoginMode ? 'register' : 'sign in'}
                                        </button>
                                    </p>
                                    {isLoginMode && this.renderForgotPasswordAction('toggle-auth')}
                                    <p className="toggle-auth">
                                        <button
                                            type="button"
                                            onClick={() => this.setState({ guestAddAttempted: false, authError: '' })}
                                            className="toggle-link"
                                        >← back</button>
                                    </p>
                                </>
                            )}
                        </div>
                    ) : (
                        /* Default panel actions */
                        <div className="mobile-panel-actions">
                            <button type="button" onClick={this.toggleAddFruitPopup} className="mobile-panel-btn">
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

        // Tiny screen (Jelly Star ≤360px): always use the mobile panel layout
        if (isTinyScreen) {
            return this.renderMobileLayout();
        }

        // Standard mobile (361–768px) guest: living bar at bottom
        if (!authenticated && isStandardMobile) {
            return this.renderGuestBar();
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
                    <img src={loquatIcon} alt="open menu" className="hamburger-icon" />
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
                <img className="lil-fruit" src={loquatIcon} alt={"fruit for all"}/>
            </div>

            {/* Guest browsing: map + filter visible, sign-in offered as CTA */}
            {!authenticated && !guestAddAttempted ? (
                <>
                    <div className="action-buttons">
                        <button
                            type="button"
                            onClick={this.toggleAddFruitPopup}
                            className="action-btn add-fruit-btn"
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
                    ) : this.state.isForgotMode ? (
                        <div>
                            {this.state.forgotSuccess ? (
                                <div>
                                    <p className="auth-success-msg">If that email is registered, a reset link has been sent.</p>
                                    <p className="toggle-auth">
                                        <button type="button" onClick={() => this.setState({ isForgotMode: false, forgotSuccess: false, forgotEmail: '' })} className="toggle-link">back to sign in</button>
                                    </p>
                                </div>
                            ) : (
                                <form onSubmit={this.handleForgotPassword}>
                                    <div className="form-group">
                                        <input
                                            type="email"
                                            value={this.state.forgotEmail}
                                            onChange={(e) => this.setState({ forgotEmail: e.target.value })}
                                            placeholder="your email address"
                                        autoComplete="email"
                                            disabled={this.state.forgotLoading}
                                        />
                                    </div>
                                    {this.state.forgotError && <p className="error-message">{this.state.forgotError}</p>}
                                    <button type="submit" className="auth-submit-btn" disabled={this.state.forgotLoading}>
                                        {this.state.forgotLoading ? 'please wait...' : 'send reset link'}
                                    </button>
                                    <p className="toggle-auth">
                                        <button type="button" onClick={() => this.setState({ isForgotMode: false, forgotError: '', forgotEmail: '' })} className="toggle-link">back to sign in</button>
                                    </p>
                                </form>
                            )}
                        </div>
                    ) : (
                        <form onSubmit={isLoginMode ? this.handleLogin : this.handleRegister}>
                            <div className="form-group">
                                <input
                                    type="text"
                                    value={authUserName}
                                    onChange={(e) => this.handleInputChange('authUserName', e.target.value)}
                                    placeholder="username"
                                        autoComplete="username"
                                        autoCapitalize="none"
                                        autoCorrect="off"
                                        spellCheck={false}
                                    disabled={authLoading}
                                />
                            </div>

                            {!isLoginMode && (
                                <div className="form-group">
                                    <input
                                        type="email"
                                        value={authEmail}
                                        onChange={(e) => this.handleInputChange('authEmail', e.target.value)}
                                        placeholder="email"
                                        autoComplete="email"
                                        disabled={authLoading}
                                    />
                                </div>
                            )}

                            <div className="form-group">
                                <input
                                    type="password"
                                    value={authPassword}
                                    onChange={(e) => this.handleInputChange('authPassword', e.target.value)}
                                    placeholder="password"
                                        autoComplete={isLoginMode ? 'current-password' : 'new-password'}
                                    disabled={authLoading}
                                />
                                {!isLoginMode && (
                                    <p className="password-hint">min 10 chars, 1 number, 1 symbol</p>
                                )}
                            </div>

                            {authError && <p className="error-message">{authError}</p>}

                            <button
                                type="submit"
                                className="auth-submit-btn"
                                disabled={authLoading}
                            >
                                {authLoading ? 'please wait...' : (isLoginMode ? 'sign in' : 'create account')}
                            </button>

                            <p className="toggle-auth">
                                {isLoginMode ? 'no account? ' : 'have account? '}
                                <button type="button" onClick={this.toggleAuthMode} className="toggle-link">
                                    {isLoginMode ? 'register' : 'sign in'}
                                </button>
                            </p>
                            {isLoginMode && this.renderForgotPasswordAction('toggle-auth')}
                            <p className="toggle-auth" style={{marginTop: '10px'}}>
                                <button
                                    type="button"
                                    onClick={() => this.setState({ guestAddAttempted: false, authError: '' })}
                                    className="toggle-link"
                                >← back</button>
                            </p>
                        </form>
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
                            onClick={this.toggleAddFruitPopup}
                            className="action-btn add-fruit-btn"
                        >add a find</button>

                        <button
                            type="button"
                            onClick={(e) => {
                                e.preventDefault();
                                const next = !this.state.myPinsActive;
                                this.setState({ myPinsActive: next, isCollapsed: next ? true : this.state.isCollapsed });
                                if (this.props.onToggleMyPins) this.props.onToggleMyPins();
                            }}
                            className={`action-btn${this.state.myPinsActive ? ' btn-active' : ''}`}
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

                    {this.renderAddFruitPopup()}

                    <div className="bottom-section">
                        <button
                            type="button"
                            className="logout-btn"
                            onClick={this.handleLogout}
                        >logout</button>
                    </div>
                </>
            )}
            </>
            )}
        </div>
        </>
        )
    };

};
