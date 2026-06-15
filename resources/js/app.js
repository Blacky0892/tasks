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


async function requestNotificationPermission(registration) {
    const vapidPublicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;

    if (!vapidPublicKey || !('Notification' in window) || !('PushManager' in window)) {
        return;
    }

    const permission = await Notification.requestPermission();

    if (permission !== 'granted') {
        return;
    }

    const existingSubscription = await registration.pushManager.getSubscription();
    const subscription = existingSubscription || await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
    });

    await fetch('/push-subscriptions', {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.content || '',
            'X-Requested-With': 'XMLHttpRequest',
        },
        body: JSON.stringify(subscription.toJSON()),
    }).catch(() => null);
}

function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }

    return outputArray;
}

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

            await requestNotificationPermission(registration);

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
