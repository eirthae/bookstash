import React from 'react';
import { createRoot } from 'react-dom/client';
import { addCollection, setCustomIconsLoader } from '@iconify/react';
import solar from '@iconify-json/solar/icons.json';
import App from './App.jsx';
import './styles.css';

// Bundle the Solar icon set so icons render fully offline (no network/API call).
// Without this, on-device icons silently fail to load — e.g. the missing nav
// icons. (FicStash does the same.)
addCollection(solar);

// Hard-disable Iconify's online API. addCollection() above registers every Solar
// icon locally, but if a name is ever missing/mistyped, @iconify/react would
// otherwise fall back to fetching it from api.iconify.design (+ simplesvg.com /
// unisvg.com mirrors). Installing a no-op loader for the only prefix we use means
// a missing icon renders nothing instead of phoning home — guaranteeing the app
// makes ZERO icon network calls, which an offline-first reader must not.
setCustomIconsLoader(() => null, 'solar');

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
