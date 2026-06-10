import { onMounted, onUnmounted, ref } from 'vue'
import { router } from '@inertiajs/vue3'

const EVENT_NAME = 'offline-tasks-updated'

// Формирует уникальный ключ localStorage для офлайн-задач конкретного списка.
function storageKey(listId) {
    return `offline-tasks:list:${listId}`
}

// Безопасно читает офлайн-задачи из localStorage и возвращает пустой массив при ошибке парсинга.
function readTasks(listId) {
    try {
        return JSON.parse(localStorage.getItem(storageKey(listId)) || '[]')
    } catch {
        return []
    }
}

// Сохраняет офлайн-задачи в localStorage и уведомляет остальные части интерфейса об изменениях.
function writeTasks(listId, tasks) {
    localStorage.setItem(storageKey(listId), JSON.stringify(tasks))

    window.dispatchEvent(new CustomEvent(EVENT_NAME, {
        detail: {
            listId,
            tasks,
        },
    }))
}

// Создаёт временный id для задачи, добавленной без сети, до получения настоящего id с сервера.
function makeTempId() {
    if (window.crypto?.randomUUID) {
        return `offline-${window.crypto.randomUUID()}`
    }

    return `offline-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

// Управляет очередью офлайн-задач: хранением, отображением и последующей синхронизацией с сервером.
export function useOfflineTaskQueue(listId) {
    const offlineTasks = ref(readTasks(listId))
    const isSyncingOfflineTasks = ref(false)
    const syncError = ref(false)

    // Перечитывает офлайн-задачи из localStorage и обновляет реактивный список.
    function refreshOfflineTasks() {
        offlineTasks.value = readTasks(listId)
    }

    // Добавляет новую задачу в локальную офлайн-очередь и сразу возвращает её для отображения в интерфейсе.
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

    // Удаляет задачу из офлайн-очереди после успешной синхронизации или ручного удаления.
    function removeOfflineTask(taskId) {
        const tasks = readTasks(listId).filter(task => task.id !== taskId)

        writeTasks(listId, tasks)
        offlineTasks.value = tasks
    }

    // Обновляет отдельную офлайн-задачу, например чтобы отметить её как синхронизирующуюся.
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

    // Запускает синхронизацию очереди, если есть задачи, сеть доступна и синхронизация ещё не идёт.
    function syncOfflineTasks() {
        const tasks = readTasks(listId)

        if (isSyncingOfflineTasks.value || tasks.length === 0 || !navigator.onLine) {
            return
        }

        isSyncingOfflineTasks.value = true
        syncError.value = false

        syncNextTask()
    }

    // Последовательно отправляет задачи на сервер по одной, чтобы сохранить порядок и корректно обработать ошибки.
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

    // Обрабатывает изменения localStorage из других вкладок и обновляет локальный список задач.
    function handleStorageEvent(event) {
        if (event.key !== storageKey(listId)) {
            return
        }

        refreshOfflineTasks()
    }

    // Обрабатывает внутреннее событие текущей вкладки, потому что обычный storage event в ней не срабатывает.
    function handleCustomEvent(event) {
        if (event.detail?.listId !== listId) {
            return
        }

        offlineTasks.value = event.detail.tasks
    }

    // При монтировании подписывается на изменения офлайн-очереди в текущей и соседних вкладках.
    onMounted(() => {
        window.addEventListener('storage', handleStorageEvent)
        window.addEventListener(EVENT_NAME, handleCustomEvent)
    })

    // При размонтировании удаляет подписки, чтобы избежать утечек и повторных обработчиков.
    onUnmounted(() => {
        window.removeEventListener('storage', handleStorageEvent)
        window.removeEventListener(EVENT_NAME, handleCustomEvent)
    })

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
