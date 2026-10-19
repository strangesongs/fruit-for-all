

import './stylesheets/sidebar.css';
import React, { Component, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import Sidebar from './sidebar.jsx';
import ResetPassword from './ResetPassword.jsx';
import { registerServiceWorker } from './registerServiceWorker.js';
import { MOBILE_QUERY } from './utils/breakpoints.js';

const Map = React.lazy(() => import('./map.jsx'));

// Main App component to coordinate between Sidebar and Map
class App extends Component {
  constructor(props) {
    super(props);
    this.mapRef     = React.createRef();
    this.sidebarRef = React.createRef();
    this.state = {
      isPopupCollapseScreen: typeof window !== 'undefined'
        ? window.matchMedia(MOBILE_QUERY).matches
        : false
    };
  }

  componentDidMount() {
    if (typeof window === 'undefined') return;
    this.popupCollapseMql = window.matchMedia(MOBILE_QUERY);
    this.syncPopupCollapseScreen();
    if (typeof this.popupCollapseMql.addEventListener === 'function') {
      this.popupCollapseMql.addEventListener('change', this.syncPopupCollapseScreen);
    } else {
      this.popupCollapseMql.addListener(this.syncPopupCollapseScreen);
    }
    window.addEventListener('resize', this.syncPopupCollapseScreen);
  }

  componentWillUnmount() {
    if (typeof window !== 'undefined') {
      window.removeEventListener('resize', this.syncPopupCollapseScreen);
    }
    if (!this.popupCollapseMql) return;
    if (typeof this.popupCollapseMql.removeEventListener === 'function') {
      this.popupCollapseMql.removeEventListener('change', this.syncPopupCollapseScreen);
    } else {
      this.popupCollapseMql.removeListener(this.syncPopupCollapseScreen);
    }
  }

  syncPopupCollapseScreen = () => {
    if (!this.popupCollapseMql) return;
    const matches = this.popupCollapseMql.matches;
    this.setState(prevState => (
      prevState.isPopupCollapseScreen === matches
        ? null
        : { isPopupCollapseScreen: matches }
    ));
  };

  // Called when a new pin is successfully submitted
  handlePinSubmitted = () => {
    if (this.mapRef.current) {
      this.mapRef.current.refreshPins();
    }
  };

  // Called when user logs in successfully
  handleAuthSuccess = () => {
    if (this.mapRef.current) {
      this.mapRef.current.refreshPins();
    }
  };

  // Called after sign-out: drop usernames/"my pins" state and reload public pins
  handleLogout = () => {
    if (this.mapRef.current) {
      this.mapRef.current.resetAfterLogout();
    }
  };

  // Called when user clicks "my pins" button
  handleToggleMyPins = () => {
    if (this.mapRef.current) {
      this.mapRef.current.toggleMyPins();
    }
  };

  // Called when user changes fruit filter
  handleFilterChange = (fruitType) => {
    if (this.mapRef.current) {
      this.mapRef.current.setState({ fruitFilter: fruitType });
    }
  };

  // Called when user opens the sidebar — close any open pin popups
  handleSidebarOpen = () => {
    if (this.mapRef.current) {
      this.mapRef.current.closePopups();
    }
  };

  // Called when a pin popup is opened — collapse sidebar on narrow screens only
  handlePinOpen = () => {
    if (this.sidebarRef.current && this.state.isPopupCollapseScreen) {
      this.sidebarRef.current.collapse();
    }
  };

  render() {
    return (
      <div className="main-layout">
        <Sidebar 
          ref={this.sidebarRef}
          onPinSubmitted={this.handlePinSubmitted}
          onAuthSuccess={this.handleAuthSuccess}
          onLogout={this.handleLogout}
          onToggleMyPins={this.handleToggleMyPins}
          onFilterChange={this.handleFilterChange}
          onSidebarOpen={this.handleSidebarOpen}
        />
        <Suspense fallback={<div className="map-area" aria-busy="true" />}>
          <Map ref={this.mapRef} onPinOpen={this.handlePinOpen} />
        </Suspense>
      </div>
    );
  }
}

const root = createRoot(document.getElementById('root'));

const params = new URLSearchParams(window.location.search);
const resetToken = params.get('token');

if (window.location.pathname === '/reset-password' && resetToken) {
  root.render(<ResetPassword token={resetToken} />);
} else {
  root.render(<App />);
}

registerServiceWorker();


