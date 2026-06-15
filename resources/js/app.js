import '../css/app.css';
import './bootstrap';

import { createInertiaApp } from '@inertiajs/vue3';
import { resolvePageComponent } from 'laravel-vite-plugin/inertia-helpers';
import { createApp, h } from 'vue';
import { ZiggyVue } from '../../vendor/tightenco/ziggy';

const appName = import.meta.env.VITE_APP_NAME || 'Наш дом';

createInertiaApp({
    title: (title) => `${title} - ${appName}`,
    resolve: (name) =>
        resolvePageComponent(
            `./Pages/${name}.vue`,
            import.meta.glob('./Pages/**/*.vue'),
        ),
    setup({ el, App, props, plugin }) {
        return createApp({ render: () => h(App, props) })
            .use(plugin)
            .use(ZiggyVue)
            .mount(el);
    },
    progress: {
        color: '#AFC39E',
    },
});

window.__pwaInstallPrompt = null;
window.__pwaWaitingWorker = null;
window.__pwaRegistration = null;

function dispatchPwaUpdateState(state, detail = {}) {
    window.dispatchEvent(new CustomEvent('pwa-update-state', {
        detail: {
            state,
            ...detail,
        },
    }));
}

window.__applyPwaUpdate = () => {
    if (!window.__pwaWaitingWorker) {
        window.location.reload();
        return;
    }

    sessionStorage.setItem('pwa:update-state', 'done');
    dispatchPwaUpdateState('updating');
    window.__pwaWaitingWorker.postMessage({ type: 'SKIP_WAITING' });
};

window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault();

    window.__pwaInstallPrompt = event;
    window.dispatchEvent(new CustomEvent('pwa-install-available', {
        detail: {
            prompt: event,
        },
    }));
});

window.addEventListener('appinstalled', () => {
    window.__pwaInstallPrompt = null;
    window.__pwaWaitingWorker = null;
    window.__pwaRegistration = null;
    window.dispatchEvent(new CustomEvent('pwa-app-installed'));
});

if ('serviceWorker' in navigator) {
    let refreshing = false;

    navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (refreshing) {
            return;
        }

        refreshing = true;
        dispatchPwaUpdateState('done');

        window.setTimeout(() => {
            window.location.reload();
        }, 600);
    });

    window.addEventListener('load', async () => {
        try {
            const previousUpdateState = sessionStorage.getItem('pwa:update-state');

            if (previousUpdateState === 'done') {
                sessionStorage.removeItem('pwa:update-state');
                dispatchPwaUpdateState('done');
            }

            const registration = await navigator.serviceWorker.register('/sw.js');
            window.__pwaRegistration = registration;

            if ('sync' in registration) {
                await registration.sync.register('sync-offline-tasks').catch(() => null);
            }

            registration.addEventListener('updatefound', () => {
                const newWorker = registration.installing;

                newWorker?.addEventListener('statechange', () => {
                    if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                        window.__pwaWaitingWorker = newWorker;
                        dispatchPwaUpdateState('ready', { registration, worker: newWorker });
                        window.dispatchEvent(new CustomEvent('pwa-update-available', {
                            detail: {
                                state: 'ready',
                                registration,
                                worker: newWorker,
                            },
                        }));
                    }
                });
            });
        } catch (error) {
            console.warn('Service worker registration failed', error);
        }
    });
}
