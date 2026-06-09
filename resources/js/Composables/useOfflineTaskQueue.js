import { ref } from 'vue'
import { router } from '@inertiajs/vue3'

const EVENT_NAME = 'offline-tasks-updated'

function storageKey(listId) {
    return `offline-tasks:list:${listId}`
}

function readTasks(listId) {
    try {
        return JSON.parse(localStorage.getItem(storageKey(listId)) || '[]')
    } catch {
        return []
    }
}

function writeTasks(listId, tasks) {
    localStorage.setItem(storageKey(listId), JSON.stringify(tasks))

    window.dispatchEvent(new CustomEvent(EVENT_NAME, {
        detail: {
            listId,
            tasks,
        },
    }))
}

function makeTempId() {
    if (window.crypto?.randomUUID) {
        return `offline-${window.crypto.randomUUID()}`
    }

    return `offline-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

export function useOfflineTaskQueue(listId) {
    const offlineTasks = ref(readTasks(listId))
    const isSyncingOfflineTasks = ref(false)
    const syncError = ref(false)

    function refreshOfflineTasks() {
        offlineTasks.value = readTasks(listId)
    }

    function addOfflineTask(title, user = null) {
        const task = {
            id: makeTempId(),
            title: title.trim(),
            is_done: false,
            creator: user
                ? {
                    id: user.id,
                    name: user.name,
                    avatar_color: user.avatar_color,
                }
                : null,
            created_at: new Date().toISOString(),
            _offline: true,
            _syncing: false,
        }

        const tasks = [
            task,
            ...readTasks(listId),
        ]

        writeTasks(listId, tasks)
        offlineTasks.value = tasks

        return task
    }

    function removeOfflineTask(taskId) {
        const tasks = readTasks(listId).filter(task => task.id !== taskId)

        writeTasks(listId, tasks)
        offlineTasks.value = tasks
    }

    function updateOfflineTask(taskId, payload) {
        const tasks = readTasks(listId).map(task => {
            if (task.id !== taskId) {
                return task
            }

            return {
                ...task,
                ...payload,
            }
        })

        writeTasks(listId, tasks)
        offlineTasks.value = tasks
    }

    function syncOfflineTasks() {
        const tasks = readTasks(listId)

        if (isSyncingOfflineTasks.value || tasks.length === 0 || !navigator.onLine) {
            return
        }

        isSyncingOfflineTasks.value = true
        syncError.value = false

        syncNextTask()
    }

    function syncNextTask() {
        const [task] = readTasks(listId)

        if (!task) {
            isSyncingOfflineTasks.value = false
            syncError.value = false
            refreshOfflineTasks()
            return
        }

        updateOfflineTask(task.id, {
            _syncing: true,
        })

        router.post(route('tasks.store', listId), {
            title: task.title,
        }, {
            preserveScroll: true,
            preserveState: true,

            onSuccess: () => {
                removeOfflineTask(task.id)
                syncNextTask()
            },

            onError: () => {
                updateOfflineTask(task.id, {
                    _syncing: false,
                })

                isSyncingOfflineTasks.value = false
                syncError.value = true
            },

            onCancel: () => {
                updateOfflineTask(task.id, {
                    _syncing: false,
                })

                isSyncingOfflineTasks.value = false
            },
        })
    }

    function handleStorageEvent(event) {
        if (event.key !== storageKey(listId)) {
            return
        }

        refreshOfflineTasks()
    }

    function handleCustomEvent(event) {
        if (event.detail?.listId !== listId) {
            return
        }

        offlineTasks.value = event.detail.tasks
    }

    window.addEventListener('storage', handleStorageEvent)
    window.addEventListener(EVENT_NAME, handleCustomEvent)

    return {
        offlineTasks,
        isSyncingOfflineTasks,
        syncError,
        addOfflineTask,
        removeOfflineTask,
        refreshOfflineTasks,
        syncOfflineTasks,
    }
}
