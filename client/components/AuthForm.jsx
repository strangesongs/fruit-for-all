import React from 'react';

// The sign-in / register / forgot-password form, shared by the three layouts
// (see CLAUDE.md → "The three responsive layouts"). Sidebar keeps all the
// state and handlers; this component only renders. Each variant keeps the DOM
// its layout's CSS was written against:
//   bar     — standard-mobile guest bar (361–768px), forms carry .guest-bar-form
//   panel   — Jelly floating panel (≤360px), with a heading, links after the form
//   desktop — the floating .sidebar card (>768px), links inside the form
//
// Callbacks:
//   onFieldChange(field, value)  'authUserName' | 'authEmail' | 'authPassword'
//   onForgotEmailChange(value)
//   onLogin(e), onRegister(e), onForgot(e)  form submits
//   onToggleMode()     switch between sign in and register
//   onShowForgot()     open the forgot-password form
//   onBackToSignIn()   leave the forgot-password form
//   onLeave()          close the form ("browse as guest" / "← back")

function Link({ onClick, children }) {
    return <button type="button" onClick={onClick} className="toggle-link">{children}</button>;
}

function ForgotAction({ className, onShowForgot }) {
    return (
        <p className={className}>
            <Link onClick={onShowForgot}>forgot password?</Link>
        </p>
    );
}

function CredentialFields(props) {
    const { isLoginMode, authUserName, authEmail, authPassword, authLoading, onFieldChange } = props;
    return (
        <>
            <div className="form-group">
                <input
                    type="text"
                    value={authUserName}
                    onChange={(e) => onFieldChange('authUserName', e.target.value)}
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
                        onChange={(e) => onFieldChange('authEmail', e.target.value)}
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
                    onChange={(e) => onFieldChange('authPassword', e.target.value)}
                    placeholder="password"
                    autoComplete={isLoginMode ? 'current-password' : 'new-password'}
                    disabled={authLoading}
                />
                {!isLoginMode && <p className="password-hint">min 10 chars, 1 number, 1 symbol</p>}
            </div>
        </>
    );
}

function ForgotFields({ forgotEmail, forgotLoading, forgotError, onForgotEmailChange }) {
    return (
        <>
            <div className="form-group">
                <input
                    type="email"
                    value={forgotEmail}
                    onChange={(e) => onForgotEmailChange(e.target.value)}
                    placeholder="your email address"
                    autoComplete="email"
                    disabled={forgotLoading}
                />
            </div>
            {forgotError && <p className="error-message">{forgotError}</p>}
            <button type="submit" className="auth-submit-btn" disabled={forgotLoading}>
                {forgotLoading ? 'please wait...' : 'send reset link'}
            </button>
        </>
    );
}

const SENT = 'if that email is registered, a reset link has been sent.';

function SubmitButton({ isLoginMode, authLoading }) {
    return (
        <button type="submit" className="auth-submit-btn" disabled={authLoading}>
            {authLoading ? 'please wait...' : (isLoginMode ? 'sign in' : 'create account')}
        </button>
    );
}

// "no account? register" with only the action inside the button.
function ModeSwitch({ isLoginMode, onToggleMode }) {
    return (
        <p className="toggle-auth">
            {isLoginMode ? 'no account? ' : 'have account? '}
            <Link onClick={onToggleMode}>{isLoginMode ? 'register' : 'sign in'}</Link>
        </p>
    );
}

function BarForm(props) {
    const { isLoginMode, isForgotMode, forgotSuccess, authError, onLogin, onRegister, onForgot,
        onToggleMode, onShowForgot, onBackToSignIn, onLeave } = props;
    const guest = <Link onClick={onLeave}>browse as guest</Link>;
    if (isForgotMode && forgotSuccess) {
        return (
            <div>
                <p className="auth-success-msg">{SENT}</p>
                <p className="toggle-auth">
                    <Link onClick={onBackToSignIn}>back to sign in</Link>{' · '}{guest}
                </p>
            </div>
        );
    }
    if (isForgotMode) {
        return (
            <form onSubmit={onForgot} className="guest-bar-form">
                <ForgotFields {...props} />
                <p className="toggle-auth">
                    <Link onClick={onBackToSignIn}>back to sign in</Link>{' · '}{guest}
                </p>
            </form>
        );
    }
    return (
        <form onSubmit={isLoginMode ? onLogin : onRegister} className="guest-bar-form">
            <CredentialFields {...props} />
            {authError && <p className="error-message">{authError}</p>}
            <SubmitButton {...props} />
            <p className="toggle-auth toggle-auth-tight">
                <Link onClick={onToggleMode}>{isLoginMode ? 'no account? register' : 'have account? sign in'}</Link>
            </p>
            {isLoginMode && <ForgotAction className="toggle-auth toggle-auth-tight" onShowForgot={onShowForgot} />}
            <p className="toggle-auth">{guest}</p>
        </form>
    );
}

function PanelForm(props) {
    const { isLoginMode, isForgotMode, forgotSuccess, authError, onLogin, onRegister, onForgot,
        onShowForgot, onBackToSignIn, onLeave } = props;
    if (isForgotMode && forgotSuccess) {
        return (
            <div>
                <p className="auth-success-msg">{SENT}</p>
                <p className="toggle-auth"><Link onClick={onBackToSignIn}>back to sign in</Link></p>
                <p className="toggle-auth"><Link onClick={onLeave}>browse as guest</Link></p>
            </div>
        );
    }
    if (isForgotMode) {
        return (
            <>
                <p className="mobile-panel-auth-head">reset password</p>
                <form onSubmit={onForgot}>
                    <ForgotFields {...props} />
                </form>
                <p className="toggle-auth"><Link onClick={onBackToSignIn}>back to sign in</Link></p>
            </>
        );
    }
    return (
        <>
            <p className="mobile-panel-auth-head">{isLoginMode ? 'sign in to add a find' : 'create account'}</p>
            <form onSubmit={isLoginMode ? onLogin : onRegister}>
                <CredentialFields {...props} />
                {authError && <p className="error-message">{authError}</p>}
                <SubmitButton {...props} />
            </form>
            <ModeSwitch {...props} />
            {isLoginMode && <ForgotAction className="toggle-auth" onShowForgot={onShowForgot} />}
            <p className="toggle-auth"><Link onClick={onLeave}>← back</Link></p>
        </>
    );
}

function DesktopForm(props) {
    const { isLoginMode, isForgotMode, forgotSuccess, authError, onLogin, onRegister, onForgot,
        onShowForgot, onBackToSignIn, onLeave } = props;
    if (isForgotMode) {
        return (
            <div>
                {forgotSuccess ? (
                    <div>
                        <p className="auth-success-msg">{SENT}</p>
                        <p className="toggle-auth"><Link onClick={onBackToSignIn}>back to sign in</Link></p>
                    </div>
                ) : (
                    <form onSubmit={onForgot}>
                        <ForgotFields {...props} />
                        <p className="toggle-auth"><Link onClick={onBackToSignIn}>back to sign in</Link></p>
                    </form>
                )}
            </div>
        );
    }
    return (
        <form onSubmit={isLoginMode ? onLogin : onRegister}>
            <CredentialFields {...props} />
            {authError && <p className="error-message">{authError}</p>}
            <SubmitButton {...props} />
            <ModeSwitch {...props} />
            {isLoginMode && <ForgotAction className="toggle-auth" onShowForgot={onShowForgot} />}
            <p className="toggle-auth" style={{ marginTop: '10px' }}><Link onClick={onLeave}>← back</Link></p>
        </form>
    );
}

export default function AuthForm(props) {
    if (props.variant === 'bar') return <BarForm {...props} />;
    if (props.variant === 'panel') return <PanelForm {...props} />;
    return <DesktopForm {...props} />;
}
