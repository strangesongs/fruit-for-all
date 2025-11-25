import React, { Component } from 'react';
import { saveAuth } from './utils/auth.js';
import './stylesheets/splash.css';

export default class Splash extends Component {
  constructor(props) {
    super(props);
    this.state = {
      isLogin: true, // Toggle between login and registration
      userName: '',
      password: '',
      email: '',
      loading: false,
      error: ''
    };
  }

  handleInputChange = (field, value) => {
    this.setState({ [field]: value, error: '' });
  };

  toggleMode = () => {
    this.setState(prevState => ({
      isLogin: !prevState.isLogin,
      error: '',
      userName: '',
      password: '',
      email: ''
    }));
  };

  handleLogin = async (e) => {
    e.preventDefault();
    const { userName, password } = this.state;

    if (!userName.trim() || !password.trim()) {
      this.setState({ error: 'Please enter username and password' });
      return;
    }

    this.setState({ loading: true, error: '' });

    try {
      const response = await fetch('http://localhost:8080/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          userName: userName.trim(), 
          password: password.trim() 
        })
      });

      const result = await response.json();

      if (result.success) {
        saveAuth(result.token, result.user);
        // Notify parent component to re-check auth status
        if (this.props.onAuthSuccess) {
          this.props.onAuthSuccess();
        }
      } else {
        this.setState({ error: result.message || 'Login failed' });
      }
    } catch (error) {
      console.error('Login error:', error);
      this.setState({ error: 'Connection error. Please try again.' });
    } finally {
      this.setState({ loading: false });
    }
  };

  handleRegister = async (e) => {
    e.preventDefault();
    const { userName, password, email } = this.state;

    if (!userName.trim() || !password.trim() || !email.trim()) {
      this.setState({ error: 'All fields are required' });
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      this.setState({ error: 'Please enter a valid email address' });
      return;
    }

    // Password strength check
    if (password.length < 6) {
      this.setState({ error: 'Password must be at least 6 characters' });
      return;
    }

    this.setState({ loading: true, error: '' });

    try {
      const response = await fetch('http://localhost:8080/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          userName: userName.trim(), 
          password: password.trim(),
          email: email.trim()
        })
      });

      const result = await response.json();

      if (result.success) {
        saveAuth(result.token, result.user);
        // Notify parent component to re-check auth status
        if (this.props.onAuthSuccess) {
          this.props.onAuthSuccess();
        }
      } else {
        this.setState({ error: result.message || 'Registration failed' });
      }
    } catch (error) {
      console.error('Registration error:', error);
      this.setState({ error: 'Connection error. Please try again.' });
    } finally {
      this.setState({ loading: false });
    }
  };

  render() {
    const { isLogin, userName, password, email, loading, error } = this.state;

    return (
      <div className="splash-container">
        <div id="top-bar">
          <h1>🍋 loquat 2.0</h1>
          <p className="version">street fruit for all // always open source</p>
        </div>

        <form onSubmit={isLogin ? this.handleLogin : this.handleRegister}>
          <div className="form-group">
            <label htmlFor="userName">username:</label>
            <input
              id="userName"
              type="text"
              value={userName}
              onChange={(e) => this.handleInputChange('userName', e.target.value)}
              placeholder="enter username"
              disabled={loading}
            />
          </div>

          {!isLogin && (
            <div className="form-group">
              <label htmlFor="email">email:</label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => this.handleInputChange('email', e.target.value)}
                placeholder="enter email"
                disabled={loading}
              />
            </div>
          )}

          <div className="form-group">
            <label htmlFor="password">password:</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => this.handleInputChange('password', e.target.value)}
              placeholder="enter password"
              disabled={loading}
            />
          </div>

          {error && <p className="error-message">{error}</p>}

          <div className="button-group">
            <button 
              type="submit" 
              id={isLogin ? 'login' : 'create'}
              disabled={loading}
            >
              {loading ? 'please wait...' : (isLogin ? 'login' : 'create account')}
            </button>
          </div>

          <p className="toggle-mode">
            {isLogin ? "don't have an account? " : "already have an account? "}
            <span 
              className="toggle-link" 
              onClick={this.toggleMode}
            >
              {isLogin ? 'register here' : 'login here'}
            </span>
          </p>
        </form>
      </div>
    );
  }
}
