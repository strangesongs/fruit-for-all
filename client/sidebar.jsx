import React, { Component } from 'react';
import loquatIcon from '../loquat-48.png';
import { getAuthHeader, getUser, clearAuth, saveAuth, isAuthenticated } from './utils/auth.js';
import { FRUIT_SEASONS } from './utils/fruitSeasons.js';
import { FRUIT_LIST } from './utils/fruitList.js';
import { API_BASE } from './utils/config.js';

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
            
            // Sidebar collapse state (for mobile)
            isCollapsed: false,

            // My pins filter active state
            myPinsActive: false,

            // Forgot password mode
            isForgotMode: false,
            forgotEmail: '',
            forgotLoading: false,
            forgotError: '',
            forgotSuccess: false,

            // Fruit type autocomplete
            fruitTypeSuggestions: [],
            showFruitSuggestions: false
        }
    };

    componentDidMount() {
        if (isAuthenticated()) {
            this.fetchAvailableFruitTypes();
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

    getCurrentLocation = () => {
        if (!navigator.geolocation) {
            this.setState({ locationError: 'geolocation is not supported by this browser.' });
            return;
        }
        this.setState({ locationLoading: true, locationError: '' });
        navigator.geolocation.getCurrentPosition(
            (position) => {
                this.setState({
                    locationLoading: false,
                    currentLocation: {
                        lat: position.coords.latitude,
                        lng: position.coords.longitude
                    }
                });
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
        this.setState(prevState => ({
            showAddFruitPopup: !prevState.showAddFruitPopup,
            // Reset form when opening popup
            currentLocation: !prevState.showAddFruitPopup ? null : prevState.currentLocation,
            fruitType: !prevState.showAddFruitPopup ? '' : prevState.fruitType,
            notes: !prevState.showAddFruitPopup ? '' : prevState.notes
        }));
    };

    submitPin = async () => {
        const { currentLocation, fruitType, notes } = this.state;

        if (!currentLocation) {
            alert('Please get your current location first');
            return;
        }

        if (!fruitType.trim()) {
            alert('Please select a fruit type');
            return;
        }

        if (!FRUIT_LIST.includes(fruitType.trim().toLowerCase())) {
            alert('Please select a fruit from the list');
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
                alert('Pin submitted successfully!');
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
                alert('Error submitting pin: ' + result.message);
            }
        } catch (error) {
            console.error('Error submitting pin:', error);
            alert('Error submitting pin. Please try again.');
        } finally {
            this.setState({ submitting: false });
        }
    };

    handleLogout = () => {
        clearAuth();
        this.setState({ 
            authenticated: false,
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
            this.setState({ forgotError: 'Please enter your email address' });
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
            this.setState({ forgotError: 'Connection error. Please try again.', forgotLoading: false });
        }
    };

    handleLogin = async (e) => {
        e.preventDefault();
        const { authUserName, authPassword } = this.state;

        if (!authUserName.trim() || !authPassword.trim()) {
            this.setState({ authError: 'Please enter username and password' });
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
                saveAuth(result.token, result.user);
                this.setState({ 
                    authenticated: true,
                    authUserName: '',
                    authPassword: '',
                    authError: ''
                });
                // Load fruit types now that we're authenticated
                this.fetchAvailableFruitTypes();
                // Notify parent to refresh pins
                if (this.props.onAuthSuccess) {
                    this.props.onAuthSuccess();
                }
            } else {
                this.setState({ authError: result.message || 'Login failed' });
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
            this.setState({ authError: 'All fields are required' });
            return;
        }

        // Username validation
        if (authUserName.trim().length < 3) {
            this.setState({ authError: 'Username must be at least 3 characters' });
            return;
        }

        // Email validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(authEmail)) {
            this.setState({ authError: 'Please enter a valid email address' });
            return;
        }

        // Password validation - match backend requirements
        if (authPassword.length < 10) {
            this.setState({ authError: 'Password must be at least 10 characters' });
            return;
        }

        if (!/\d/.test(authPassword)) {
            this.setState({ authError: 'Password must contain at least one number' });
            return;
        }

        if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(authPassword)) {
            this.setState({ authError: 'Password must contain at least one symbol' });
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
                saveAuth(result.token, result.user);
                this.setState({ 
                    authenticated: true,
                    authUserName: '',
                    authPassword: '',
                    authEmail: '',
                    authError: ''
                });
                // Notify parent to refresh pins
                if (this.props.onAuthSuccess) {
                    this.props.onAuthSuccess();
                }
            } else {
                this.setState({ authError: result.message || 'Registration failed' });
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
        this.setState(prevState => ({
            isCollapsed: !prevState.isCollapsed
        }));
    };

   

    render () {
        const { authenticated, isLoginMode, authUserName, authPassword, authEmail, authLoading, authError } = this.state;
        const currentUser = getUser();

        const isAuthModal = !authenticated;

        return (
        <>
        {isAuthModal && <div className="auth-modal-backdrop" />}
        <div className={`sidebar ${this.state.isCollapsed ? 'collapsed' : ''} ${isAuthModal ? 'sidebar-auth-modal' : ''}`}>
            {/* Hamburger menu button */}
            <button className="hamburger-btn" onClick={this.toggleSidebar} aria-label="Toggle menu">
                <span></span>
                <span></span>
                <span></span>
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

            {/* Show login/register form if not authenticated */}
            {!authenticated ? (
                <div className="auth-section">
                    {this.state.isForgotMode ? (
                        <div>
                            {this.state.forgotSuccess ? (
                                <div>
                                    <p className="auth-success-msg">If that email is registered, a reset link has been sent.</p>
                                    <p className="toggle-auth">
                                        <span onClick={() => this.setState({ isForgotMode: false, forgotSuccess: false, forgotEmail: '' })} className="toggle-link">back to login</span>
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
                                        <span onClick={() => this.setState({ isForgotMode: false, forgotError: '', forgotEmail: '' })} className="toggle-link">back to login</span>
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
                            {authLoading ? 'please wait...' : (isLoginMode ? 'login' : 'create account')}
                        </button>

                        <p className="toggle-auth">
                            {isLoginMode ? "no account? " : "have account? "}
                            <span onClick={this.toggleAuthMode} className="toggle-link">
                                {isLoginMode ? 'register' : 'login'}
                            </span>
                        </p>
                        {isLoginMode && (
                            <p className="toggle-auth">
                                <span onClick={() => this.setState({ isForgotMode: true, authError: '' })} className="toggle-link forgot-link">forgot password?</span>
                            </p>
                        )}
                    </form>
                    )}
                </div>
            ) : (
                <>
                    {/* User info section */}
                    {currentUser && (
                        <div className="user-info">
                            <p className="welcome-text">welcome, {currentUser.userName}!</p>
                        </div>
                    )}

                    {/* Main action buttons */}
                    <div className="action-buttons">
                        <button
                            type="button"
                            onClick={(e) => {
                            e.preventDefault();
                            window.location.href='index.html';}}
                            className="action-btn"
                            >home</button>

                        <button
                            type="button"
                            onClick={this.toggleAddFruitPopup}
                            className="action-btn add-fruit-btn"
                            >add fruit</button>

                        <button
                            type="button"
                            onClick={(e) => {
                            e.preventDefault();
                            const next = !this.state.myPinsActive;
                            this.setState({ myPinsActive: next });
                            if (this.props.onToggleMyPins) {
                                this.props.onToggleMyPins();
                            }}}
                            className={`action-btn${this.state.myPinsActive ? ' btn-active' : ''}`}
                            >my pins</button>
                    </div>

                    {/* Fruit Type Filter */}
                    <div className="filter-section">
                        <label htmlFor="fruit-filter">filter by fruit:</label>
                        <select 
                            id="fruit-filter"
                            value={this.state.selectedFruitFilter}
                            onChange={(e) => {
                                this.setState({ selectedFruitFilter: e.target.value });
                                if (this.props.onFilterChange) {
                                    this.props.onFilterChange(e.target.value);
                                }
                            }}
                            className="fruit-filter-select"
                        >
                            <option value="all">all fruits</option>
                            {this.state.availableFruitTypes.map(fruit => (
                                <option key={fruit} value={fruit}>
                                    {fruit}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Add Fruit Popup */}
                    {this.state.showAddFruitPopup && (
                        <div className="add-fruit-popup-overlay">
                            <div className="add-fruit-popup">
                                <div className="popup-header">
                                    <h4>Add Fruit Tree</h4>
                                    <button 
                                        className="close-btn"
                                        onClick={this.toggleAddFruitPopup}
                                        disabled={this.state.submitting}
                                    >
                                        ×
                                    </button>
                                </div>

                                <div className="popup-content">
                                    {/* Location Section */}
                                    <div className="popup-section">
                                        <label>Location:</label>
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
                                                <small>
                                                    {this.state.currentLocation.lat.toFixed(6)}, {this.state.currentLocation.lng.toFixed(6)}
                                                </small>
                                            </div>
                                        )}
                                    </div>

                                    {/* Fruit Type Section */}
                                    <div className="popup-section fruit-autocomplete-wrapper">
                                        <label htmlFor="popup-fruit-type">Fruit or Tree Type:</label>
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
                                                    >
                                                        {fruit}
                                                    </li>
                                                ))}
                                            </ul>
                                        )}
                                        {this.state.fruitType && !FRUIT_LIST.includes(this.state.fruitType.toLowerCase()) && (
                                            <p className="fruit-not-found">no match &mdash; keep typing or select from the list</p>
                                        )}
                                    </div>

                                    {/* Notes Section */}
                                    <div className="popup-section">
                                        <label htmlFor="popup-notes">Notes (optional):</label>
                                        <textarea
                                            id="popup-notes"
                                            value={this.state.notes}
                                            onChange={(e) => this.handleInputChange('notes', e.target.value)}
                                            placeholder="Add details about this fruit tree location... (up to 500 words)"
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
                                    >
                                        Cancel
                                    </button>
                                    <button 
                                        type="submit" 
                                        onClick={this.submitPin}
                                        disabled={this.state.submitting || !this.state.currentLocation || !FRUIT_LIST.includes((this.state.fruitType || '').trim().toLowerCase())}
                                        className="submit-btn"
                                    >
                                        {this.state.submitting ? 'Submitting...' : 'Submit Pin'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Logout button at bottom */}
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
