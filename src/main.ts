import { mountApp } from './ui/app';
import { startPublicPerformanceDiagnostics } from './performance/public-diagnostics';
import './ui/styles.css';
const root = document.querySelector<HTMLElement>('#app');
if (!root) throw new Error('Application root missing');
startPublicPerformanceDiagnostics();
mountApp(root);
// Patch 56: offline loading after the first visit. Only on HTTPS, so local test servers and automation never get a
// service worker. The worker is network-first and never touches saved games.
if ('serviceWorker' in navigator && location.protocol === 'https:') {
  window.addEventListener('load', () => { navigator.serviceWorker.register('./sw.js').catch(() => undefined); }, { once: true });
}
