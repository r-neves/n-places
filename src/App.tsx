import React from 'react';
import logo from './logo.svg';
import './App.css';
import {Map as MapComponent} from 'react-map-gl/maplibre';
import { NotionIntegration } from './services/places/notion-integration';


function App() {
  const service = new NotionIntegration();
  service.getDBLastUpdatedDate("ae713d53768640058a236c4bd1691198").then((date) => {
    console.log(date);
  });

  return (
    <div className="App">
      <header className="App-header">
        <img src={logo} className="App-logo" alt="logo" />
        <p>
          Edit <code>src/App.tsx</code> and save to reload.
        </p>
        <a
          className="App-link"
          href="https://reactjs.org"
          target="_blank"
          rel="noopener noreferrer"
        >
          Learn React
        </a>
      </header>
      <MapComponent
      initialViewState={{
        longitude: -9.10595458097556, 
        latitude: 38.77395075041862,
        zoom: 10
      }}
      style={{width: 600, height: 400}}
      mapStyle="./assets/map-style.json"
    />
    </div>
  );
}

export default App;
