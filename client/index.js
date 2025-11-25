
import './stylesheets/sidebar.css';
import './stylesheets/map.css';
import './stylesheets/splash.css';
import React, { Component } from 'react';
import { createRoot } from 'react-dom/client';
import Sidebar from './sidebar.jsx';
import Map from './map.jsx';

// Main App component to coordinate between Sidebar and Map
class App extends Component {
  constructor(props) {
    super(props);
    this.mapRef = React.createRef();
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

  render() {
    return (
      <div className="main-layout">
        <Sidebar 
          onPinSubmitted={this.handlePinSubmitted}
          onAuthSuccess={this.handleAuthSuccess}
          onToggleMyPins={this.handleToggleMyPins}
          onFilterChange={this.handleFilterChange}
        />
        <Map ref={this.mapRef} />
      </div>
    );
  }
}

const root = createRoot(document.getElementById('root'));
root.render(<App />);


