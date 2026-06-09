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
    window.dispatchEvent(new CustomEvent('pwa-app-installed'));
});

if ('serviceWorker' in navigator) {
    let refreshing = false;

    navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (refreshing) {
            return;
        }

        refreshing = true;
        window.location.reload();
    });

    window.addEventListener('load', async () => {
        try {
            const registration = await navigator.serviceWorker.register('/sw.js');

            registration.addEventListener('updatefound', () => {
                const newWorker = registration.installing;

                newWorker?.addEventListener('statechange', () => {
                    if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                        window.__pwaWaitingWorker = newWorker;
                        window.dispatchEvent(new CustomEvent('pwa-update-available', {
                            detail: {
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
