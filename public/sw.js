const CACHE_PREFIX = 'nash-dom'
const OFFLINE_URL = '/offline'
const MANIFEST_URL = '/build/manifest.json'
const OFFLINE_TASKS_DB = 'nash-dom-offline-tasks'
const OFFLINE_TASKS_STORE = 'tasks'
const OFFLINE_TASKS_SYNC = 'sync-offline-tasks'

const STATIC_ASSETS = [
    '/',
    OFFLINE_URL,
    '/manifest.webmanifest',
    '/icons/icon-192.png',
    '/icons/icon-512.png',
    '/icons/apple-touch-icon.png',
]

self.addEventListener('install', event => {
    event.waitUntil((async () => {
        const cache = await caches.open(await currentCacheName())
        const shellAssets = await appShellAssets()

        await cache.addAll([...new Set([...STATIC_ASSETS, ...shellAssets])]).catch(() => null)
    })())
})

self.addEventListener('activate', event => {
    event.waitUntil((async () => {
        const cacheName = await currentCacheName()
        const keys = await caches.keys()

        await Promise.all(
            keys
                .filter(key => key.startsWith(`${CACHE_PREFIX}-`) && key !== cacheName)
                .map(key => caches.delete(key))
        )

        await self.clients.claim()
    })())
})

self.addEventListener('message', event => {
    if (event.data?.type === 'SKIP_WAITING') {
        self.skipWaiting()
        return
    }

    if (event.data?.type === 'QUEUE_OFFLINE_TASK') {
        event.waitUntil(queueOfflineTask(event.data.task))
        return
    }

    if (event.data?.type === 'REMOVE_OFFLINE_TASK') {
        event.waitUntil(removeOfflineTask(event.data.taskId))
    }
})

self.addEventListener('sync', event => {
    if (event.tag !== OFFLINE_TASKS_SYNC) {
        return
    }

    event.waitUntil(syncOfflineTasks())
})

self.addEventListener('push', event => {
    const data = parsePushPayload(event)

    event.waitUntil(self.registration.showNotification(data.title || 'Наш дом', {
        body: data.body || 'У вас новое напоминание.',
        icon: '/icons/icon-192.png',
        badge: '/icons/icon-192.png',
        tag: data.tag || 'task-reminder',
        data: {
            url: data.url || '/',
        },
    }))
})

self.addEventListener('notificationclick', event => {
    event.notification.close()

    const url = event.notification.data?.url || '/'

    event.waitUntil((async () => {
        const clientList = await self.clients.matchAll({type: 'window', includeUncontrolled: true})
        const client = clientList.find(item => new URL(item.url).pathname === url)

        if (client) {
            await client.focus()
            return
        }

        await self.clients.openWindow(url)
    })())
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

async function currentCacheName() {
    const version = await appVersion()

    return `${CACHE_PREFIX}-${version}`
}

async function appVersion() {
    try {
        const response = await fetch(`${MANIFEST_URL}?v=${Date.now()}`, {cache: 'no-store'})
        const text = await response.text()
        const hash = await sha256(text)

        return hash.slice(0, 16)
    } catch {
        return 'runtime'
    }
}

async function sha256(text) {
    const buffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))

    return [...new Uint8Array(buffer)]
        .map(byte => byte.toString(16).padStart(2, '0'))
        .join('')
}

async function appShellAssets() {
    try {
        const response = await fetch(`${MANIFEST_URL}?v=${Date.now()}`, {cache: 'no-store'})

        if (!response.ok) {
            return []
        }

        const manifest = await response.json()
        const assets = new Set([MANIFEST_URL])

        Object.values(manifest).forEach(entry => {
            collectManifestEntryAssets(entry, assets)
        })

        return [...assets]
    } catch {
        return [MANIFEST_URL]
    }
}

function collectManifestEntryAssets(entry, assets) {
    if (!entry || typeof entry !== 'object') {
        return
    }

    if (entry.file) {
        assets.add(`/${entry.file}`)
    }

    ;['css', 'assets'].forEach(key => {
        ;(entry[key] || []).forEach(asset => assets.add(`/${asset}`))
    })
}

function parsePushPayload(event) {
    if (!event.data) {
        return {}
    }

    try {
        return event.data.json()
    } catch {
        return {body: event.data.text()}
    }
}

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

    const cache = await caches.open(await currentCacheName())

    await cache.put(request, response)
}

async function queueOfflineTask(task) {
    if (!task?.id || !task?.listId || !task?.title) {
        return
    }

    const db = await openOfflineTasksDb()

    await transactionPromise(db, OFFLINE_TASKS_STORE, 'readwrite', store => {
        store.put(task)
    })

    await registerOfflineTasksSync()
}

async function removeOfflineTask(taskId) {
    if (!taskId) {
        return
    }

    const db = await openOfflineTasksDb()

    await transactionPromise(db, OFFLINE_TASKS_STORE, 'readwrite', store => {
        store.delete(taskId)
    })
}

async function registerOfflineTasksSync() {
    if (!self.registration.sync) {
        return
    }

    await self.registration.sync.register(OFFLINE_TASKS_SYNC).catch(() => null)
}

async function syncOfflineTasks() {
    const db = await openOfflineTasksDb()
    const tasks = await transactionPromise(db, OFFLINE_TASKS_STORE, 'readonly', store => requestPromise(store.getAll()))

    for (const task of tasks) {
        const response = await fetch(`/lists/${task.listId}/tasks`, {
            method: 'POST',
            credentials: 'same-origin',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
                'X-CSRF-TOKEN': task.csrfToken || '',
                'X-Requested-With': 'XMLHttpRequest',
            },
            body: JSON.stringify({
                title: task.title,
                note: task.note || '',
            }),
        })

        if (!response.ok) {
            throw new Error('Offline task sync failed')
        }

        await removeOfflineTask(task.id)
    }
}

function openOfflineTasksDb() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(OFFLINE_TASKS_DB, 1)

        request.onupgradeneeded = () => {
            const db = request.result

            if (!db.objectStoreNames.contains(OFFLINE_TASKS_STORE)) {
                db.createObjectStore(OFFLINE_TASKS_STORE, {keyPath: 'id'})
            }
        }

        request.onsuccess = () => resolve(request.result)
        request.onerror = () => reject(request.error)
    })
}

function transactionPromise(db, storeName, mode, callback) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(storeName, mode)
        const result = callback(transaction.objectStore(storeName))

        transaction.oncomplete = () => resolve(result)
        transaction.onerror = () => reject(transaction.error)
        transaction.onabort = () => reject(transaction.error)
    })
}

function requestPromise(request) {
    return new Promise((resolve, reject) => {
        request.onsuccess = () => resolve(request.result)
        request.onerror = () => reject(request.error)
    })
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
