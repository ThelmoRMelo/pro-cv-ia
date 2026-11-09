import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';
import { registerAppWorker } from './lib/registerSW';

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Elemento raiz #root não encontrado no documento.');
}

registerAppWorker();

createRoot(rootElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
