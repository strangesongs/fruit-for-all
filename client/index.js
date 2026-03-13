
import './stylesheets/sidebar.css';
import './stylesheets/map.css';
import React, { Component } from 'react';
import { createRoot } from 'react-dom/client';
import Sidebar from './sidebar.jsx';
import Map from './map.jsx';
import ResetPassword from './ResetPassword.jsx';

// Main App component to coordinate between Sidebar and Map
class App extends Component {
  constructor(props) {
    super(props);
    this.mapRef     = React.createRef();
    this.sidebarRef = React.createRef();
  }

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
    if (this.sidebarRef.current && window.innerWidth <= 600) {
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
          onToggleMyPins={this.handleToggleMyPins}
          onFilterChange={this.handleFilterChange}
          onSidebarOpen={this.handleSidebarOpen}
        />
        <Map ref={this.mapRef} onPinOpen={this.handlePinOpen} />
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


