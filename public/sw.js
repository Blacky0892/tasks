const CACHE_NAME = 'nash-dom-v3'
const OFFLINE_URL = '/offline'

const STATIC_ASSETS = [
    '/',
    OFFLINE_URL,
    '/manifest.webmanifest',
    '/icons/icon-192.png',
    '/icons/icon-512.png',
    '/icons/icon-maskable-512.png',
    '/icons/apple-touch-icon.png',
]

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => {
            return cache.addAll(STATIC_ASSETS).catch(() => null)
        })
    )
})

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(keys => {
            return Promise.all(
                keys
                    .filter(key => key !== CACHE_NAME)
                    .map(key => caches.delete(key))
            )
        })
    )

    self.clients.claim()
})

self.addEventListener('message', event => {
    if (event.data?.type === 'SKIP_WAITING') {
        self.skipWaiting()
    }
})

self.addEventListener('fetch', event => {
    const request = event.request

    if (shouldSkipRequest(request)) {
        return
    }

    if (request.mode === 'navigate') {
        event.respondWith(networkFirstNavigation(request))
        return
    }

    if (isStaticAsset(request)) {
        event.respondWith(cacheFirst(request))
        return
    }

    event.respondWith(networkFirst(request))
})

function shouldSkipRequest(request) {
    const url = new URL(request.url)

    if (request.method !== 'GET' || url.origin !== self.location.origin) {
        return true
    }

    return [
        '/magic/',
        '/login',
        '/logout',
        '/register',
        '/sanctum',
        '/csrf-cookie',
    ].some(path => url.pathname.startsWith(path))
}

function isStaticAsset(request) {
    const url = new URL(request.url)

    return url.pathname.startsWith('/build/') ||
        url.pathname.startsWith('/icons/') ||
        url.pathname === '/manifest.webmanifest'
}

async function cacheFirst(request) {
    const cachedResponse = await caches.match(request)

    if (cachedResponse) {
        return cachedResponse
    }

    const response = await fetch(request)

    await putIfOk(request, response.clone())

    return response
}

async function networkFirst(request) {
    try {
        const response = await fetch(request)

        await putIfOk(request, response.clone())

        return response
    } catch {
        const cachedResponse = await caches.match(request)

        return cachedResponse || Response.error()
    }
}

async function networkFirstNavigation(request) {
    try {
        const response = await fetch(request)

        await putIfOk(request, response.clone())

        return response
    } catch {
        const cachedResponse = await caches.match(request)
        const offlineResponse = await caches.match(OFFLINE_URL)

        return cachedResponse || offlineResponse || offlineHtmlResponse()
    }
}

async function putIfOk(request, response) {
    if (!response || !response.ok) {
        return
    }

    const cache = await caches.open(CACHE_NAME)

    await cache.put(request, response)
}

function offlineHtmlResponse() {
    return new Response(`<!doctype html>
<html lang="ru">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
    <meta name="theme-color" content="#DDEBCB">
    <title>Нет сети — Наш дом</title>
    <style>
        :root { color-scheme: light; font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
        body { min-height: 100vh; margin: 0; display: grid; place-items: center; background: #F8FAF3; color: #283326; padding: 24px; }
        main { max-width: 420px; border: 1px solid #D9E2D0; border-radius: 28px; background: rgba(255,255,255,.9); box-shadow: 0 16px 40px rgba(221,235,203,.55); padding: 24px; }
        .icon { width: 64px; height: 64px; display: grid; place-items: center; border-radius: 22px; background: #DDEBCB; font-size: 32px; }
        h1 { margin: 18px 0 8px; font-size: 28px; line-height: 1; }
        p { margin: 0; color: #526743; line-height: 1.55; }
        button { margin-top: 20px; min-height: 48px; width: 100%; border: 0; border-radius: 18px; background: #CFE0BB; color: #283326; font: inherit; font-weight: 800; }
    </style>
</head>
<body>
    <main>
        <div class="icon">🏡</div>
        <h1>Вы офлайн</h1>
        <p>Открытые ранее списки могут быть доступны. Новые задачи, добавленные без сети, отправятся после восстановления подключения.</p>
        <button onclick="location.reload()">Попробовать снова</button>
    </main>
</body>
</html>`, {
        headers: {
            'Content-Type': 'text/html; charset=utf-8',
        },
    })
}
