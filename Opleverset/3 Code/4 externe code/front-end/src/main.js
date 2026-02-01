import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import React from 'react';
import './index.css';
import Home from './components/home.tsx';
createRoot(document.getElementById('root')).render(React.createElement(StrictMode, null,
    React.createElement(Home, null)));
