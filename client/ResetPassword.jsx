import React, { Component } from 'react';
import { API_BASE } from './utils/config.js';
import { forgetResetToken } from './utils/resetToken.js';

const sessionStore = () => (typeof window !== 'undefined' ? window.sessionStorage : undefined);

export default class ResetPassword extends Component {
  constructor(props) {
    super(props);
    this.state = {
      password: '',
      confirmPassword: '',
      loading: false,
      error: '',
      success: false
    };
  }

  handleSubmit = async (e) => {
    e.preventDefault();
    const { password, confirmPassword } = this.state;
    const { token } = this.props;

    if (!password || !confirmPassword) {
      this.setState({ error: 'please fill in both fields' });
      return;
    }
    if (password !== confirmPassword) {
      this.setState({ error: 'passwords do not match' });
      return;
    }

    this.setState({ loading: true, error: '' });

    try {
      const res = await fetch(`${API_BASE}/api/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password })
      });
      const result = await res.json();

      if (result.success) {
        forgetResetToken(sessionStore());
        this.setState({ success: true, loading: false });
      } else {
        this.setState({ error: result.message || 'reset failed', loading: false });
      }
    } catch (err) {
      this.setState({ error: 'connection error. please try again.', loading: false });
    }
  };

  renderBody() {
    const { password, confirmPassword, loading, error, success } = this.state;

    if (!this.props.token) {
      return (
        <>
          <p className="reset-message">
            this reset link is missing its code, or it has already been used.
            ask for a new one from “forgot password?” on the sign-in form.
          </p>
          <a className="auth-submit-btn reset-link-btn" href="/">return to map</a>
        </>
      );
    }

    if (success) {
      return (
        <>
          <p className="auth-success-msg reset-message">password updated. you can sign in with it now.</p>
          <a className="auth-submit-btn reset-link-btn" href="/">return to map</a>
        </>
      );
    }

    return (
      <form onSubmit={this.handleSubmit} className="reset-form">
        <div className="form-group">
          <input
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => this.setState({ password: e.target.value })}
            placeholder="new password"
            aria-label="new password"
            disabled={loading}
          />
          <p className="password-hint">min 10 chars, 1 number, 1 symbol</p>
        </div>
        <div className="form-group">
          <input
            type="password"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => this.setState({ confirmPassword: e.target.value })}
            placeholder="confirm new password"
            aria-label="confirm new password"
            disabled={loading}
          />
        </div>
        {error && <p className="error-message" role="alert">{error}</p>}
        <button type="submit" className="auth-submit-btn" disabled={loading}>
          {loading ? 'please wait…' : 'set password'}
        </button>
        <a className="reset-back" href="/">back to map</a>
      </form>
    );
  }

  render() {
    return (
      <div className="reset-page">
        <div className="reset-card auth-section">
          <p className="reset-title">fruit for all</p>
          <p className="reset-subtitle">set a new password</p>
          {this.renderBody()}
        </div>
      </div>
    );
  }
}
