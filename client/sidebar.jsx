import React, { Component } from 'react';
import loquatIcon from '../loquat-48.png';
import { getAuthHeader, getUser, clearAuth, saveAuth, isAuthenticated } from './utils/auth.js';
import { FRUIT_SEASONS } from './utils/fruitSeasons.js';
import { FRUIT_LIST } from './utils/fruitList.js';
import { API_BASE } from './utils/config.js';
import { containsProfanity } from './utils/profanity.js';

import './stylesheets/sidebar.css';

export default class Sidebar extends React.Component {
    constructor(props) {
        super(props);
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
            isCollapsed: typeof window !== 'undefined' && window.innerWidth <= 360,
            isTinyScreen: typeof window !== 'undefined' && window.innerWidth <= 360,

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
            showFruitSuggestions: false
        }
    };

    componentDidMount() {
        if (isAuthenticated()) {
            this.fetchAvailableFruitTypes();
        } else {
            this.fetchAvailableFruitTypesPublic();
        }
    }

    fetchAvailableFruitTypes = async () => {
        try {
            const response = await fetch(`${API_BASE}/api/pins`, {
                headers: getAuthHeader()
            });
            const data = await response.json();
            
            if (data.success && data.pins) {
                // Filter words to exclude from fruit types
                const excludeWords = ['test', 'tests', 'demo', 'testing', 'user'];
                
                // Extract unique fruit types from pins
                const fruitTypes = [...new Set(data.pins.map(pin => pin.fruitType))]
                    .filter(type => type) // Remove any null/undefined
                    .filter(type => {
                        const lowerType = type.toLowerCase();
                        return !excludeWords.some(word => lowerType.includes(word));
                    })
                    .sort();
                this.setState({ availableFruitTypes: fruitTypes });
            }
        } catch (error) {
            console.error('Error fetching fruit types:', error);
        }
    };

    fetchAvailableFruitTypesPublic = async () => {
        try {
            const response = await fetch(`${API_BASE}/api/pins/public`);
            const data = await response.json();
            if (data.success && data.pins) {
                const excludeWords = ['test', 'tests', 'demo', 'testing', 'user'];
                const fruitTypes = [...new Set(data.pins.map(pin => pin.fruitType))]
                    .filter(type => type)
                    .filter(type => {
                        const lowerType = type.toLowerCase();
                        return !excludeWords.some(word => lowerType.includes(word));
                    })
                    .sort();
                this.setState({ availableFruitTypes: fruitTypes });
            }
        } catch (error) {
            console.error('Error fetching public fruit types:', error);
        }
    };

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

        try {
            const response = await fetch(`${API_BASE}/api/pins`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...getAuthHeader()
                },
                body: JSON.stringify({
                    coordinates: currentLocation,
                    fruitType: fruitType.trim(),
                    notes: notes.trim()
                })
            });

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
                // Refresh available fruit types
                this.fetchAvailableFruitTypes();
                // Notify parent component to refresh map if callback provided
                if (this.props.onPinSubmitted) {
                    this.props.onPinSubmitted(result.pin);
                }
            } else {
                alert('error submitting pin: ' + result.message);
            }
        } catch (error) {
            console.error('Error submitting pin:', error);
            alert('error submitting pin. please try again.');
        } finally {
            this.setState({ submitting: false });
        }
    };

    handleLogout = () => {
        clearAuth();
        this.fetchAvailableFruitTypesPublic();
        this.setState({ 
            authenticated: false,
            guestAddAttempted: false,
            authUserName: '',
            authPassword: '',
            authEmail: '',
            authError: ''
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
        try {
            const res = await fetch(`${API_BASE}/api/auth/forgot-password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: forgotEmail })
            });
            await res.json();
            // Always show success (don't reveal if email exists)
            this.setState({ forgotSuccess: true, forgotLoading: false });
        } catch (err) {
            this.setState({ forgotError: 'connection error. please try again.', forgotLoading: false });
        }
    };

    handleLogin = async (e) => {
        e.preventDefault();
        const { authUserName, authPassword } = this.state;

        if (!authUserName.trim() || !authPassword.trim()) {
            this.setState({ authError: 'please enter username and password' });
            return;
        }

        this.setState({ authLoading: true, authError: '' });

        try {
            const response = await fetch(`${API_BASE}/api/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    userName: authUserName.trim(), 
                    password: authPassword.trim() 
                })
            });

            const result = await response.json();

            if (result.success) {
                const wasGuestAddAttempted = this.state.guestAddAttempted;
                saveAuth(result.token, result.user);
                this.setState({ 
                    authenticated: true,
                    guestAddAttempted: false,
                    authUserName: '',
                    authPassword: '',
                    authError: '',
                    isCollapsed: window.innerWidth <= 360,
                    showAddFruitPopup: wasGuestAddAttempted,
                });
                // Load fruit types now that we're authenticated
                this.fetchAvailableFruitTypes();
                // Notify parent to refresh pins
                if (this.props.onAuthSuccess) {
                    this.props.onAuthSuccess();
                }
            } else {
                this.setState({ authError: result.message || 'login failed' });
            }
        } catch (error) {
            console.error('[LOGIN] Exception:', error);
            this.setState({ authError: 'Connection error. Please try again.' });
        } finally {
            this.setState({ authLoading: false });
        }
    };

    handleRegister = async (e) => {
        e.preventDefault();
        const { authUserName, authPassword, authEmail } = this.state;

        if (!authUserName.trim() || !authPassword.trim() || !authEmail.trim()) {
            this.setState({ authError: 'all fields are required' });
            return;
        }

        // Username validation
        if (authUserName.trim().length < 3) {
            this.setState({ authError: 'username must be at least 3 characters' });
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

        try {
            const response = await fetch(`${API_BASE}/api/auth/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    userName: authUserName.trim(), 
                    password: authPassword.trim(),
                    email: authEmail.trim()
                })
            });

            const result = await response.json();

            if (result.success) {
                const wasGuestAddAttempted = this.state.guestAddAttempted;
                saveAuth(result.token, result.user);
                this.setState({ 
                    authenticated: true,
                    guestAddAttempted: false,
                    authUserName: '',
                    authPassword: '',
                    authEmail: '',
                    authError: '',
                    isCollapsed: window.innerWidth <= 360,
                    showAddFruitPopup: wasGuestAddAttempted,
                });
                // Notify parent to refresh pins
                if (this.props.onAuthSuccess) {
                    this.props.onAuthSuccess();
                }
            } else {
                this.setState({ authError: result.message || 'registration failed' });
            }
        } catch (error) {
            console.error('Registration error:', error);
            this.setState({ authError: 'Connection error. Please try again.' });
        } finally {
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
        this.setState({ isCollapsed: true });
    };

    renderAddFruitPopup() {
        if (!this.state.showAddFruitPopup) return null;
        return (
            <div className="add-fruit-popup-overlay">
                <div className="add-fruit-popup">
                    <div className="popup-header">
                        <h4>add a find</h4>
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
                            <label htmlFor="popup-fruit-type">fruit or tree type:</label>
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
                                        <li
                                            key={fruit}
                                            onMouseDown={() => this.selectFruitType(fruit)}
                                            className={this.state.fruitType === fruit ? 'fruit-suggestion-active' : ''}
                                        >{fruit}</li>
                                    ))}
                                </ul>
                            )}
                            {this.state.fruitType && !FRUIT_LIST.includes(this.state.fruitType.toLowerCase()) && (
                                <p className="fruit-not-found">no match &mdash; keep typing or select from the list</p>
                            )}
                        </div>
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
                            type="button"
                            onClick={this.toggleAddFruitPopup}
                            disabled={this.state.submitting}
                            className="cancel-btn"
                        >cancel</button>
                        <button
                            type="submit"
                            onClick={this.submitPin}
                            disabled={this.state.submitting || !this.state.currentLocation || !FRUIT_LIST.includes((this.state.fruitType || '').trim().toLowerCase())}
                            className="submit-btn"
                        >
                            {this.state.submitting ? 'submitting...' : 'submit pin'}
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    renderMobileLayout() {
        const { isCollapsed, myPinsActive, authenticated, guestAddAttempted,
                isLoginMode, authUserName, authPassword, authEmail, authLoading, authError } = this.state;
        const currentUser = getUser();

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

                    {/* Guest: inline auth form when "add a find" was tapped */}
                    {!authenticated && guestAddAttempted ? (
                        <div className="mobile-panel-auth">
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
                                <span onClick={this.toggleAuthMode} className="toggle-link">
                                    {isLoginMode ? 'register' : 'sign in'}
                                </span>
                            </p>
                            <p className="toggle-auth">
                                <span
                                    onClick={() => this.setState({ guestAddAttempted: false, authError: '' })}
                                    className="toggle-link"
                                >← back</span>
                            </p>
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

                    {authenticated ? (
                        <button type="button" className="mobile-panel-btn mobile-panel-logout-btn" onClick={this.handleLogout}>
                            logout
                        </button>
                    ) : !guestAddAttempted && (
                        <p className="toggle-auth" style={{marginTop: '8px', marginBottom: '2px'}}>
                            <span
                                onClick={() => this.setState({ guestAddAttempted: true })}
                                className="toggle-link"
                            >sign in / register</span>
                        </p>
                    )}
                </div>
            )}

            {/* Add fruit popup — fixed overlay, renders above panel */}
            {this.renderAddFruitPopup()}
            </>
        );
    }

    render () {
        const { authenticated, guestAddAttempted, isLoginMode, authUserName, authPassword, authEmail, authLoading, authError, isTinyScreen } = this.state;
        const currentUser = getUser();

        // Tiny screen (Jelly Star ≤360px): always use the mobile panel layout
        if (isTinyScreen) {
            return this.renderMobileLayout();
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
                            <span onClick={() => this.setState({ guestAddAttempted: true, isLoginMode: true, showAbout: false })} className="toggle-link">sign in</span>
                            {' / '}
                            <span onClick={() => this.setState({ guestAddAttempted: true, isLoginMode: false, showAbout: false })} className="toggle-link">create account</span>
                        </p>
                        <p className="toggle-auth">
                            <span onClick={() => this.setState({ guestAddAttempted: true, showAbout: true })} className="secondary-link">what is fruit for all?</span>
                        </p>
                    </div>
                </>

            ) : !authenticated && guestAddAttempted ? (
                /* Guest has tapped "add a find" or sign-in: show inline auth */
                <div className="auth-section">
                    {this.state.showAbout ? (
                        <div className="about-panel">
                            <h3 className="about-title">what is fruit for all?</h3>
                            <p>fruit for all is a community map of street fruit you can actually pick — figs, loquats, citrus, passionfruit, and whatever else is growing near you.</p>
                            <p>spot some fruit, mushrooms, or wild greens? log it so others can find it. you need to be on-location to add a pin.</p>
                            <p>only share fruit that's genuinely accessible to anyone — nothing behind fences or on private property.</p>
                            <p className="about-oss">open source &mdash; <a href="https://github.com/strangesongs/fruit-for-all" className="about-link-ext" target="_blank" rel="noreferrer">view on github</a></p>
                            <p className="about-oss">say hello &mdash; <a href="mailto:admin@fruitforall.app" className="about-link-ext">admin@fruitforall.app</a></p>
                            <p className="toggle-auth">
                                <span onClick={() => this.setState({ showAbout: false })} className="toggle-link about-back">← back</span>
                            </p>
                        </div>
                    ) : this.state.isForgotMode ? (
                        <div>
                            {this.state.forgotSuccess ? (
                                <div>
                                    <p className="auth-success-msg">If that email is registered, a reset link has been sent.</p>
                                    <p className="toggle-auth">
                                        <span onClick={() => this.setState({ isForgotMode: false, forgotSuccess: false, forgotEmail: '' })} className="toggle-link">back to sign in</span>
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
                                            disabled={this.state.forgotLoading}
                                        />
                                    </div>
                                    {this.state.forgotError && <p className="error-message">{this.state.forgotError}</p>}
                                    <button type="submit" className="auth-submit-btn" disabled={this.state.forgotLoading}>
                                        {this.state.forgotLoading ? 'please wait...' : 'send reset link'}
                                    </button>
                                    <p className="toggle-auth">
                                        <span onClick={() => this.setState({ isForgotMode: false, forgotError: '', forgotEmail: '' })} className="toggle-link">back to sign in</span>
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
                                <span onClick={this.toggleAuthMode} className="toggle-link">
                                    {isLoginMode ? 'register' : 'sign in'}
                                </span>
                            </p>
                            {isLoginMode && (
                                <p className="toggle-auth">
                                    <span onClick={() => this.setState({ isForgotMode: true, authError: '' })} className="toggle-link">forgot password?</span>
                                </p>
                            )}
                            <p className="toggle-auth" style={{marginTop: '10px'}}>
                                <span
                                    onClick={() => this.setState({ guestAddAttempted: false, authError: '' })}
                                    className="toggle-link"
                                >← back</span>
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
