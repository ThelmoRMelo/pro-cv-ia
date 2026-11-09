import { registerSW } from 'virtual:pwa-register';

const blocked = import.meta.env.DEV || window.self !== window.top || /(^|\.)lovable\.(app|dev)$|(^|\.)lovableproject\.com$/.test(location.hostname) || new URLSearchParams(location.search).get('sw') === 'off';

export function registerAppWorker() {
  if (blocked) {
    navigator.serviceWorker?.getRegistrations().then(registrations => registrations.forEach(registration => registration.unregister()));
    return;
  }
  registerSW({ immediate: true });
}
