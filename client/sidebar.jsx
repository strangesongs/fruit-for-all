import React, { Component } from 'react';
import loquatIcon from '../loquat-48.png';
import { getAuthHeader, getUser, clearAuth, saveAuth, isAuthenticated } from './utils/auth.js';
import { FRUIT_SEASONS } from './utils/fruitSeasons.js';

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
            isCollapsed: false
        }
    };

    componentDidMount() {
        this.fetchAvailableFruitTypes();
    }

    fetchAvailableFruitTypes = async () => {
        try {
            const response = await fetch('http://localhost:8080/api/pins', {
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
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    this.setState({
                        currentLocation: {
                            lat: position.coords.latitude,
                            lng: position.coords.longitude
                        }
                    });
                },
                (error) => {
                    console.error('Error getting location:', error);
                    alert('Unable to get location. Please check your browser settings.');
                }
            );
        } else {
            alert('Geolocation is not supported by this browser.');
        }
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
            alert('Please enter a fruit type');
            return;
        }

        this.setState({ submitting: true });

        try {
            const response = await fetch('http://localhost:8080/api/pins', {
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

    handleLogin = async (e) => {
        e.preventDefault();
        const { authUserName, authPassword } = this.state;

        if (!authUserName.trim() || !authPassword.trim()) {
            this.setState({ authError: 'Please enter username and password' });
            return;
        }

        this.setState({ authLoading: true, authError: '' });
        console.log('[LOGIN] Attempting login for user:', authUserName);

        try {
            const response = await fetch('http://localhost:8080/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    userName: authUserName.trim(), 
                    password: authPassword.trim() 
                })
            });

            console.log('[LOGIN] Response status:', response.status);
            const result = await response.json();
            console.log('[LOGIN] Response body:', result);

            if (result.success) {
                console.log('[LOGIN] Success! Saving auth and setting authenticated=true');
                saveAuth(result.token, result.user);
                this.setState({ 
                    authenticated: true,
                    authUserName: '',
                    authPassword: '',
                    authError: ''
                });
                // Notify parent to refresh pins
                if (this.props.onAuthSuccess) {
                    console.log('[LOGIN] Calling onAuthSuccess callback');
                    this.props.onAuthSuccess();
                }
            } else {
                const errorMsg = result.message || 'Login failed';
                console.log('[LOGIN] Failed:', errorMsg);
                this.setState({ authError: errorMsg });
            }
        } catch (error) {
            console.error('[LOGIN] Exception:', error);
            this.setState({ authError: 'Connection error. Please try again.' });
        } finally {
            this.setState({ authLoading: false });
            console.log('[LOGIN] Loading state cleared');
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
            const response = await fetch('http://localhost:8080/api/auth/register', {
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

        return (
        <div className={`sidebar ${this.state.isCollapsed ? 'collapsed' : ''}`}>
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
                <p>loquat 2.0</p>
                <p>street fruit for all // always open source</p>
                <img className="lil-fruit" src={loquatIcon} alt={"loquat"}/>
            </div>

            {/* Show login/register form if not authenticated */}
            {!authenticated ? (
                <div className="auth-section">
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
                    </form>
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
                            if (this.props.onToggleMyPins) {
                                this.props.onToggleMyPins();
                            }}}
                            className="action-btn"
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
                                            disabled={this.state.submitting}
                                        >
                                            get current location
                                        </button>
                                        {this.state.currentLocation && (
                                            <div className="location-display">
                                                <small>
                                                    {this.state.currentLocation.lat.toFixed(6)}, {this.state.currentLocation.lng.toFixed(6)}
                                                </small>
                                            </div>
                                        )}
                                    </div>

                                    {/* Fruit Type Section */}
                                    <div className="popup-section">
                                        <label htmlFor="popup-fruit-type">Fruit or Tree Type:</label>
                                        <input 
                                            type="text" 
                                            id="popup-fruit-type"
                                            value={this.state.fruitType}
                                            onChange={(e) => this.handleInputChange('fruitType', e.target.value)}
                                            placeholder="e.g., lemon, orange, avocado"
                                            maxLength="50"
                                            disabled={this.state.submitting}
                                        />
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
                                        disabled={this.state.submitting || !this.state.currentLocation || !this.state.fruitType.trim()}
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
        )
    };

};
