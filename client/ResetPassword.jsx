import React, { Component } from 'react';
import { API_BASE } from './utils/config.js';

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
      this.setState({ error: 'Please fill in both fields' });
      return;
    }
    if (password !== confirmPassword) {
      this.setState({ error: 'Passwords do not match' });
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
        this.setState({ success: true, loading: false });
      } else {
        this.setState({ error: result.message || 'Reset failed', loading: false });
      }
    } catch (err) {
      this.setState({ error: 'Connection error. Please try again.', loading: false });
    }
  };

  render() {
    const { password, confirmPassword, loading, error, success } = this.state;

    return (
      <div style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: '#fafafa', fontFamily: "'EB Garamond', serif"
      }}>
        <div style={{
          background: '#d3d3d3', border: '2px solid #e0e0e0', borderRadius: '8px',
          padding: '24px', width: '300px', boxShadow: '4px 4px 12px rgba(0,0,0,0.2)',
          textAlign: 'center'
        }}>
<p style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#C23939', margin: '0 0 8px 0' }}>fruit for all</p>
          <p style={{ fontSize: '0.9rem', margin: '0 0 20px 0' }}>set a new password</p>

          {success ? (
            <div>
              <p style={{ color: '#2e7d32', marginBottom: '16px' }}>Password updated successfully!</p>
              <button onClick={() => window.location.href = '/'} style={{
                background: '#D84747', color: 'white', border: '2px outset #D84747',
                padding: '8px 16px', fontFamily: "'EB Garamond', serif", cursor: 'pointer',
                borderRadius: '4px', width: '90%'
              }}>
                return to map
              </button>
            </div>
          ) : (
            <form onSubmit={this.handleSubmit}>
              <div style={{ marginBottom: '8px' }}>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => this.setState({ password: e.target.value })}
                  placeholder="new password"
                  disabled={loading}
                  style={{
                    width: '100%', padding: '8px 10px', boxSizing: 'border-box',
                    background: '#fafafa', border: '2px solid #e0e0e0', borderRadius: '4px',
                    fontFamily: "'EB Garamond', serif", fontSize: '0.9rem', textAlign: 'center'
                  }}
                />
                <p style={{ fontSize: '0.7rem', color: '#666', margin: '4px 0 0 0', fontStyle: 'italic' }}>
                  min 10 chars, 1 number, 1 symbol
                </p>
              </div>
              <div style={{ marginBottom: '12px' }}>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => this.setState({ confirmPassword: e.target.value })}
                  placeholder="confirm new password"
                  disabled={loading}
                  style={{
                    width: '100%', padding: '8px 10px', boxSizing: 'border-box',
                    background: '#fafafa', border: '2px solid #e0e0e0', borderRadius: '4px',
                    fontFamily: "'EB Garamond', serif", fontSize: '0.9rem', textAlign: 'center'
                  }}
                />
              </div>
              {error && <p style={{ color: '#d32f2f', fontSize: '0.8rem', margin: '0 0 8px 0' }}>{error}</p>}
              <button
                type="submit"
                disabled={loading}
                style={{
                  background: '#D84747', color: 'white', border: '2px outset #D84747',
                  padding: '8px 16px', fontFamily: "'EB Garamond', serif", cursor: 'pointer',
                  borderRadius: '4px', width: '90%', opacity: loading ? 0.6 : 1,
                  fontSize: '0.9rem', fontWeight: 'bold'
                }}
              >
                {loading ? 'please wait...' : 'set password'}
              </button>
              <p style={{ marginTop: '12px', fontSize: '0.85rem' }}>
                <span
                  onClick={() => window.location.href = '/'}
                  style={{ color: '#D84747', textDecoration: 'underline', cursor: 'pointer' }}
                >
                  back to map
                </span>
              </p>
            </form>
          )}
        </div>
      </div>
    );
  }
}
