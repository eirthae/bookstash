import React from 'react';
import { createRoot } from 'react-dom/client';
import { addCollection } from '@iconify/react';
import solar from '@iconify-json/solar/icons.json';
import App from './App.jsx';
import './styles.css';

// Bundle the Solar icon set so icons render fully offline (no network/API call).
// Without this, on-device icons silently fail to load — e.g. the missing nav
// icons. (FicStash does the same.)
addCollection(solar);

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
