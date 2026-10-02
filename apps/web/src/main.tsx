import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/inter-tight/wght.css';
import './styles.css';
import { App } from './App.tsx';

const root = document.getElementById('root');
if (!root) throw new Error('Aletheia: #root element missing from index.html');

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
