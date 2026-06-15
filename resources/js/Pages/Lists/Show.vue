<script setup>
import {Head, Link, router, useForm, usePage} from '@inertiajs/vue3'
import {computed, nextTick, onMounted, onUnmounted, ref, watch} from 'vue'
import draggable from 'vuedraggable'
import NetworkStatus from '@/Components/NetworkStatus.vue'
import MobileCommandBar from '@/Components/MobileCommandBar.vue'
import {useNetworkStatus} from '@/Composables/useNetworkStatus'
import {useOfflineTaskQueue} from '@/Composables/useOfflineTaskQueue'
import {listIconOptions} from '@/Support/listIcons'
import TaskCard from '@/Components/TaskCard.vue'
import OfflineTaskCard from '@/Components/OfflineTaskCard.vue'
import HomeToast from '@/Components/HomeToast.vue'
import TaskComposer from '@/Components/TaskComposer.vue'
import DoneTasksSection from '@/Components/DoneTasksSection.vue'

const props = defineProps({
    list: {
        type: Object,
        required: true,
    },
})

const page = usePage()
// Возвращает текущего авторизованного пользователя из Inertia props.
const user = computed(() => page.props.auth?.user ?? null)

const {
    isOnline,
} = useNetworkStatus()

const {
    offlineTasks,
    isSyncingOfflineTasks,
    syncError,
    addOfflineTask,
    removeOfflineTask,
    syncOfflineTasks,
} = useOfflineTaskQueue(props.list.id)

const updateAvailable = ref(false)
const pwaUpdateState = ref('idle')
const pwaUpdateTitle = computed(() => {
    if (pwaUpdateState.value === 'updating') {
        return 'Обновляем…'
    }

    if (pwaUpdateState.value === 'done') {
        return 'Готово'
    }

    return 'Обновление готово'
})
const pwaUpdateDescription = computed(() => {
    if (pwaUpdateState.value === 'updating') {
        return 'Сохраняем состояние и применяем новую версию.'
    }

    if (pwaUpdateState.value === 'done') {
        return 'Перезапускаем приложение.'
    }

    return 'Новая версия уже загружена.'
})
const localActiveTasks = ref([])
const localDoneTasks = ref([])
const showDoneTasks = ref(false)
const showTaskComposer = ref(false)
const showListSettings = ref(false)
const showClearDoneConfirm = ref(false)
const taskComposer = ref(null)
const isIconPickerOpen = ref(false)
const editingTaskId = ref(null)
const editingTitle = ref('')
const editingNote = ref('')
const editingAttachments = ref([])
const editingNewAttachments = ref([])
const openedTaskMenuId = ref(null)
const taskReorderMode = ref(false)
const pendingDeleteIds = ref([])
const pendingDeleteTasks = ref([])
const deleteTimers = new Map()
const editingInput = ref(null)
const longPressTimer = ref(null)
const longPressTriggered = ref(false)
const remoteVersion = ref(null)
const isCheckingRemoteChanges = ref(false)
const isClearingDoneTasks = ref(false)
const pendingClearDoneTasks = ref([])
const clearDoneTimer = ref(null)
let remoteSyncTimer = null
let visualViewportCleanup = null

const form = useForm({
    title: '',
    note: '',
    attachments: [],
})

const listForm = useForm({
    title: props.list.title,
    emoji: props.list.emoji,
})

// Формирует список активных задач, исключая задачи, ожидающие подтверждённого удаления.
const activeTasks = computed(() => {
    return localActiveTasks.value.filter(task => !pendingDeleteIds.value.includes(task.id))
})

// Формирует список выполненных задач, исключая задачи, ожидающие подтверждённого удаления или очистки истории.
const pendingClearDoneIds = computed(() => pendingClearDoneTasks.value.map(task => task.id))

const doneTasks = computed(() => {
    return localDoneTasks.value.filter(task => {
        return !pendingDeleteIds.value.includes(task.id) && !pendingClearDoneIds.value.includes(task.id)
    })
})

const doneTasksLimit = ref(3)

// Возвращает видимую часть выполненных задач с учётом раскрытия блока и текущего лимита.
const visibleDoneTasks = computed(() => {
    if (!showDoneTasks.value) {
        return []
    }

    return doneTasks.value.slice(0, doneTasksLimit.value)
})

// Считает количество выполненных задач, которые скрыты за кнопкой «Показать ещё».
const hiddenDoneTasksCount = computed(() => {
    return Math.max(doneTasks.value.length - visibleDoneTasks.value.length, 0)
})

// Считает общее количество задач в списке, включая локальные офлайн-задачи.
const tasksTotal = computed(() => activeTasks.value.length + doneTasks.value.length + offlineTasks.value.length)

// Рассчитывает процент выполнения списка на основе общего числа задач.
const progressPercent = computed(() => {
    if (tasksTotal.value === 0) {
        return 0
    }

    return Math.round((doneTasks.value.length / tasksTotal.value) * 100)
})

// Находит задачу, для которой сейчас открыто меню действий.
const openedTask = computed(() => {
    return [...activeTasks.value, ...doneTasks.value].find(task => task.id === openedTaskMenuId.value) ?? null
})

// Возвращает короткое текстовое состояние списка для шапки страницы.
const listMood = computed(() => {
    if (tasksTotal.value === 0) {
        return 'Список пустой — самое время добавить первый пункт.'
    }

    if (activeTasks.value.length === 0) {
        return 'Все задачи выполнены. Красиво.'
    }

    return `${activeTasks.value.length} осталось · ${progressPercent.value}% готово`
})

// При открытии страницы синхронизирует офлайн-задачи, запускает проверку изменений и подписывает обработчики событий.
onMounted(() => {
    if (navigator.onLine) {
        syncOfflineTasks()
    }

    checkRemoteChanges()

    remoteSyncTimer = window.setInterval(() => {
        if (document.visibilityState === 'visible') {
            checkRemoteChanges()
        }
    }, 5000)

    window.addEventListener('online', handleOnline)
    window.addEventListener('pwa-update-available', handlePwaUpdateAvailable)
    window.addEventListener('pwa-update-state', handlePwaUpdateState)
    document.addEventListener('visibilitychange', handleVisibilityChange)
    visualViewportCleanup = bindKeyboardViewport()
})

// При уходе со страницы очищает таймеры и снимает глобальные обработчики событий.
onUnmounted(() => {
    if (remoteSyncTimer) {
        window.clearInterval(remoteSyncTimer)
        remoteSyncTimer = null
    }

    if (clearDoneTimer.value) {
        window.clearTimeout(clearDoneTimer.value)
        clearDoneTimer.value = null
    }

    window.removeEventListener('online', handleOnline)
    window.removeEventListener('pwa-update-available', handlePwaUpdateAvailable)
    window.removeEventListener('pwa-update-state', handlePwaUpdateState)
    document.removeEventListener('visibilitychange', handleVisibilityChange)

    if (visualViewportCleanup) {
        visualViewportCleanup()
        visualViewportCleanup = null
    }
})

// Следит за восстановлением сети и запускает синхронизацию офлайн-задач.
watch(
    () => isOnline.value,
    value => {
        if (value) {
            syncOfflineTasks()
        }
    },
)

// Следит за обновлением задач, пришедших с сервера, и пересобирает локальные списки.
watch(
    () => props.list.tasks,
    value => {
        syncLocalTasks(value)
    },
)

// Helpers

// Помечает главную страницу как требующую обновления после изменения задач или списка.
function markHomeNeedsRefresh() {
    sessionStorage.setItem('home:needs-refresh', '1')
}

// Даёт короткую вибрацию на устройствах, где поддерживается Vibration API.
function vibrateLight() {
    if ('vibrate' in navigator) {
        navigator.vibrate(8)
    }
}

// Разделяет серверный список задач на активные и выполненные локальные коллекции.
function syncLocalTasks(tasks) {
    localActiveTasks.value = tasks.filter(task => !task.is_done)
    localDoneTasks.value = tasks.filter(task => task.is_done)
}

// Применяет ожидающее обновление service worker с промежуточными состояниями UI.
function reloadApp() {
    pwaUpdateState.value = 'updating'

    if (window.__applyPwaUpdate) {
        window.__applyPwaUpdate()
        return
    }

    window.location.reload()
}

// Прокручивает список к активным задачам: временное действие для кнопки поиска в мобильной панели.
function handleMobileSearch() {
    document.querySelector('[data-task-list]')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

// Task composer

// Открывает форму добавления задачи.
function focusAddTaskInput() {
    showTaskComposer.value = true

    nextTick(() => {
        taskComposer.value?.focus()
    })
}

// Закрывает форму добавления задачи, если сейчас не идёт отправка данных.
function closeTaskComposer() {
    if (form.processing) {
        return
    }

    form.reset()
    form.clearErrors()
    showTaskComposer.value = false
}

// Создаёт новую задачу: онлайн отправляет на сервер, офлайн кладёт в локальную очередь.
function updateComposerAttachments(files) {
    form.attachments = files
}

function createTask() {
    const title = form.title.trim()
    const shouldCloseAfterCreate = title.split(/\r?\n/).filter(line => line.trim()).length > 1

    if (!title || form.processing) {
        return
    }

    if (!isOnline.value) {
        markHomeNeedsRefresh()
        addOfflineTask(title, user.value, form.note.trim())
        vibrateLight()

        form.reset()
        form.clearErrors()

        if (shouldCloseAfterCreate) {
            showTaskComposer.value = false
            return
        }

        taskComposer.value?.focus()

        return
    }

    markHomeNeedsRefresh()

    form.post(route('tasks.store', props.list.id), {
        preserveScroll: true,
        onSuccess: () => {
            vibrateLight()
            form.reset()
            form.clearErrors()

            if (shouldCloseAfterCreate) {
                showTaskComposer.value = false
                return
            }

            taskComposer.value?.focus()
        },
    })
}

// Task actions

// Переключает состояние задачи между активной и выполненной.
function toggleTask(task) {
    if (task._offline) {
        return
    }

    if (!isOnline.value) {
        return
    }

    openedTaskMenuId.value = null
    markHomeNeedsRefresh()
    vibrateLight()

    router.post(route('tasks.toggle', task.id), {}, {
        preserveScroll: true,
    })
}

// Запускает удаление задачи с задержкой, чтобы пользователь успел отменить действие.
function deleteTask(task) {
    openedTaskMenuId.value = null

    if (task._offline) {
        markHomeNeedsRefresh()
        removeOfflineTask(task.id)
        return
    }

    if (!isOnline.value) {
        return
    }

    if (pendingDeleteIds.value.includes(task.id)) {
        return
    }

    markHomeNeedsRefresh()

    pendingDeleteIds.value = [
        ...pendingDeleteIds.value,
        task.id,
    ]

    pendingDeleteTasks.value = [
        ...pendingDeleteTasks.value,
        task,
    ]

    vibrateLight()

    const timer = window.setTimeout(() => {
        router.delete(route('tasks.destroy', task.id), {
            preserveScroll: true,
            onFinish: () => {
                removePendingDelete(task.id)
            },
        })
    }, 4500)

    deleteTimers.set(task.id, timer)
}

// Отменяет отложенное удаление задачи и возвращает её в список.
function undoDeleteTask(task) {
    const timer = deleteTimers.get(task.id)

    if (timer) {
        window.clearTimeout(timer)
        deleteTimers.delete(task.id)
    }

    removePendingDelete(task.id)
}

// Убирает задачу из локального списка ожидающих удаления и очищает связанный таймер.
function removePendingDelete(taskId) {
    pendingDeleteIds.value = pendingDeleteIds.value.filter(id => id !== taskId)
    pendingDeleteTasks.value = pendingDeleteTasks.value.filter(task => task.id !== taskId)
    deleteTimers.delete(taskId)
}

// Открывает меню действий для блока выполненных задач.
function openDoneTasksActions() {
    if (!isOnline.value || isClearingDoneTasks.value || doneTasks.value.length === 0) {
        return
    }

    openedTaskMenuId.value = null
    showClearDoneConfirm.value = true
}

// Планирует очистку выполненных задач и показывает undo-тост до фактического удаления на сервере.
function clearDoneTasks() {
    if (!isOnline.value || isClearingDoneTasks.value || doneTasks.value.length === 0 || clearDoneTimer.value) {
        return
    }

    pendingClearDoneTasks.value = [...doneTasks.value]
    showClearDoneConfirm.value = false
    doneTasksLimit.value = 3
    vibrateLight()

    clearDoneTimer.value = window.setTimeout(() => {
        confirmClearDoneTasks()
    }, 4500)
}

// Отменяет запланированную очистку истории выполненных задач.
function undoClearDoneTasks() {
    if (clearDoneTimer.value) {
        window.clearTimeout(clearDoneTimer.value)
        clearDoneTimer.value = null
    }

    pendingClearDoneTasks.value = []
}

// Выполняет отложенную очистку выполненных задач на сервере.
function confirmClearDoneTasks() {
    clearDoneTimer.value = null

    if (!isOnline.value || pendingClearDoneTasks.value.length === 0) {
        pendingClearDoneTasks.value = []
        return
    }

    markHomeNeedsRefresh()
    isClearingDoneTasks.value = true

    router.delete(route('tasks.clear-done', props.list.id), {
        preserveScroll: true,
        onFinish: () => {
            isClearingDoneTasks.value = false
            showClearDoneConfirm.value = false
            pendingClearDoneTasks.value = []
        },
    })
}

// Task editing

// Включает режим редактирования выбранной задачи и переводит фокус в поле ввода.
function startEditTask(task) {
    if (task._offline) {
        return
    }

    openedTaskMenuId.value = null
    editingTaskId.value = task.id
    editingTitle.value = task.title
    editingNote.value = task.note ?? ''
    editingAttachments.value = [...(task.attachments ?? [])]
    editingNewAttachments.value = []

    nextTick(() => {
        editingInput.value?.focus()
    })
}

// Сбрасывает режим редактирования задачи без сохранения изменений.
function cancelEditTask() {
    editingTaskId.value = null
    editingTitle.value = ''
    editingNote.value = ''
    editingAttachments.value = []
    editingNewAttachments.value = []
}

// Сохраняет новое название и заметку задачи, если они изменились и доступна сеть.
function saveEditTask(task) {
    const title = editingTitle.value.trim()
    const note = editingNote.value.trim()
    const currentNote = task.note ?? ''
    const currentAttachmentPaths = (task.attachments ?? []).map(attachment => attachment.path).join('|')
    const editingAttachmentPaths = editingAttachments.value.map(attachment => attachment.path).join('|')

    if (!title) {
        cancelEditTask()
        return
    }

    if (
        title === task.title
        && note === currentNote
        && editingAttachmentPaths === currentAttachmentPaths
        && editingNewAttachments.value.length === 0
    ) {
        cancelEditTask()
        return
    }

    if (!isOnline.value) {
        cancelEditTask()
        return
    }

    markHomeNeedsRefresh()

    router.patch(route('tasks.update', task.id), {
        title,
        note,
        kept_attachments: editingAttachments.value,
        attachments: editingNewAttachments.value,
    }, {
        preserveScroll: true,
        forceFormData: true,
        onSuccess: () => {
            cancelEditTask()
        },
    })
}

// Увеличивает лимит отображаемых выполненных задач.
function showMoreDoneTasks() {
    doneTasksLimit.value += 5
}

// Task menu

// Открывает или закрывает меню действий для выбранной задачи.
function toggleTaskMenu(task) {
    openedTaskMenuId.value = openedTaskMenuId.value === task.id ? null : task.id
}

// Закрывает меню действий задачи.
function closeTaskMenu() {
    openedTaskMenuId.value = null
}

// Reorder

// Выключает режим ручной сортировки задач.
function disableTaskReorderMode() {
    taskReorderMode.value = false
}

// Переключает режим ручной сортировки задач.
function toggleTaskReorderMode() {
    taskReorderMode.value = !taskReorderMode.value
}

// Сохраняет новый порядок активных задач на сервере или откатывает порядок без сети.
function saveTasksOrder() {
    if (!isOnline.value) {
        syncLocalTasks(props.list.tasks)
        return
    }

    markHomeNeedsRefresh()

    router.patch(route('tasks.reorder', props.list.id), {
        ids: localActiveTasks.value
            .filter(task => !pendingDeleteIds.value.includes(task.id))
            .map(task => task.id),
    }, {
        preserveScroll: true,
        preserveState: true,
    })
}

// Long press

// Обрабатывает обычный клик по задаче: учитывает долгий тап и режим сортировки.
function handleTaskTitleClick(task) {
    if (longPressTriggered.value) {
        longPressTriggered.value = false
        return
    }

    if (taskReorderMode.value) {
        return
    }

    toggleTask(task)
}

// Запускает таймер долгого нажатия, чтобы открыть редактирование задачи.
function startTaskTitleLongPress(task) {
    clearLongPress()
    longPressTriggered.value = false

    longPressTimer.value = window.setTimeout(() => {
        longPressTriggered.value = true
        startEditTask(task)
        vibrateLight()
    }, 500)
}

// Очищает таймер долгого нажатия, если пользователь отпустил кнопку или отменил действие.
function clearLongPress() {
    if (!longPressTimer.value) {
        return
    }

    window.clearTimeout(longPressTimer.value)
    longPressTimer.value = null
}

// List settings

// Открывает настройки списка и заполняет форму актуальными данными.
function openListSettings() {
    openedTaskMenuId.value = null
    listForm.title = props.list.title
    listForm.emoji = props.list.emoji
    listForm.clearErrors()
    showListSettings.value = true
}

// Закрывает настройки списка, если сохранение сейчас не выполняется.
function closeListSettings() {
    if (listForm.processing) {
        return
    }

    listForm.title = props.list.title
    listForm.emoji = props.list.emoji
    listForm.clearErrors()
    showListSettings.value = false
    isIconPickerOpen.value = false
}

// Открывает или закрывает выбор иконки списка.
function toggleIconPicker() {
    isIconPickerOpen.value = !isIconPickerOpen.value
}

// Устанавливает выбранную иконку списка и закрывает пикер.
function selectListIcon(icon) {
    listForm.emoji = icon
    isIconPickerOpen.value = false
}

// Сохраняет изменённые название и иконку списка на сервере.
function updateList() {
    if (!isOnline.value) {
        return
    }

    markHomeNeedsRefresh()

    listForm.patch(route('lists.update', props.list.id), {
        preserveScroll: true,
        onSuccess: () => {
            showListSettings.value = false
            isIconPickerOpen.value = false
        },
    })
}

// Архивирует текущий список после подтверждения пользователя.
function archiveList() {
    if (!isOnline.value) {
        return
    }

    if (!confirm('Архивировать этот список? Он пропадёт с главной страницы.')) {
        return
    }

    markHomeNeedsRefresh()

    router.delete(route('lists.destroy', props.list.id))
}

// Поддерживает правильный отступ fixed-композера над iOS keyboard viewport.
function bindKeyboardViewport() {
    if (!window.visualViewport) {
        return null
    }

    const updateKeyboardInset = () => {
        const inset = Math.max(0, window.innerHeight - window.visualViewport.height - window.visualViewport.offsetTop)
        document.documentElement.style.setProperty('--keyboard-inset', `${inset}px`)
    }

    updateKeyboardInset()
    window.visualViewport.addEventListener('resize', updateKeyboardInset)
    window.visualViewport.addEventListener('scroll', updateKeyboardInset)

    return () => {
        window.visualViewport.removeEventListener('resize', updateKeyboardInset)
        window.visualViewport.removeEventListener('scroll', updateKeyboardInset)
        document.documentElement.style.removeProperty('--keyboard-inset')
    }
}

// PWA

// Обрабатывает восстановление сети: синхронизирует очередь и проверяет свежие изменения.
function handleOnline() {
    syncOfflineTasks()
    checkRemoteChanges()
}

// Показывает уведомление о доступной новой версии PWA.
function handlePwaUpdateAvailable(event) {
    updateAvailable.value = true
    pwaUpdateState.value = event.detail?.state ?? 'ready'
}

// Синхронизирует более подробные состояния обновления service worker с toast в UI.
function handlePwaUpdateState(event) {
    updateAvailable.value = true
    pwaUpdateState.value = event.detail?.state ?? 'ready'
}

// Обрабатывает нижнюю плавающую кнопку добавления задачи.
function handleBottomAddClick() {
    focusAddTaskInput()
}

// Проверяет, менялся ли список на сервере, и мягко перезагружает данные при новой версии.
async function checkRemoteChanges() {
    if (!isOnline.value) {
        return
    }

    if (isCheckingRemoteChanges.value) {
        return
    }

    if (form.processing || listForm.processing || isSyncingOfflineTasks.value || clearDoneTimer.value) {
        return
    }

    if (editingTaskId.value || showListSettings.value || taskReorderMode.value) {
        return
    }

    isCheckingRemoteChanges.value = true

    try {
        const response = await fetch(route('lists.sync-state', props.list.id), {
            headers: {
                'Accept': 'application/json',
                'X-Requested-With': 'XMLHttpRequest',
            },
        })

        if (!response.ok) {
            return
        }

        const data = await response.json()

        if (!remoteVersion.value) {
            remoteVersion.value = data.version
            return
        }

        if (remoteVersion.value === data.version) {
            return
        }

        remoteVersion.value = data.version
        markHomeNeedsRefresh()

        router.reload({
            only: ['list'],
            preserveScroll: true,
            preserveState: true,
        })
    } catch {
        // Молча пропускаем: PWA не должна пугать пользователя временными сетевыми ошибками.
    } finally {
        isCheckingRemoteChanges.value = false
    }
}

// Проверяет удалённые изменения, когда вкладка снова становится видимой.
function handleVisibilityChange() {
    if (document.visibilityState === 'visible') {
        checkRemoteChanges()
    }
}

syncLocalTasks(props.list.tasks)
</script>

<template>
    <Head :title="list.title"/>

    <NetworkStatus/>

    <main class="home-page home-mobile-page" @click.self="closeTaskMenu">
        <div class="home-container pb-[calc(11.25rem+env(safe-area-inset-bottom))] sm:pb-32">
            <header class="home-list-header sticky top-0 z-20 -mx-3 mb-5 px-3 pt-3 sm:static sm:mx-0 sm:px-0 sm:pt-0">
                <div
                    class="home-list-hero relative overflow-hidden rounded-b-[2.2rem] px-1 pb-4 pt-2 sm:rounded-[2rem] sm:px-4">
                    <div class="home-list-hero-orb home-list-hero-orb-left"/>
                    <div class="home-list-hero-orb home-list-hero-orb-right"/>

                    <div class="relative z-10 flex items-center justify-between gap-3">
                        <Link
                            :href="route('home')"
                            class="home-back-button inline-flex min-h-11 items-center gap-2 rounded-full px-3.5 text-sm font-bold transition active:scale-[0.98]"
                        >
                            <span class="home-back-icon inline-flex h-7 w-7 items-center justify-center rounded-full">
                                ←
                            </span>

                            <span>Все списки</span>
                        </Link>

                        <button
                            type="button"
                            class="home-icon-button flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-xl sm:hidden"
                            @click="openListSettings"
                            aria-label="Настройки списка"
                        >
                            ⋯
                        </button>
                    </div>

                    <div class="relative z-10 mt-4 flex items-center gap-3">
                        <div
                            class="home-avatar-card home-list-avatar flex h-16 w-16 shrink-0 items-center justify-center rounded-[1.6rem] text-3xl"
                            :class="taskReorderMode ? 'ring-4 ring-white/70' : ''">
                            <button
                                type="button"
                                class="home-avatar-card home-list-avatar flex h-16 w-16 shrink-0 items-center justify-center rounded-[1.6rem] text-3xl"

                                :aria-label="taskReorderMode ? 'Выключить сортировку задач' : 'Включить сортировку задач'"
                                @click="toggleTaskReorderMode"
                            >
                                {{ list.emoji }}
                            </button>
                        </div>

                        <div class="min-w-0 flex-1">
                            <h1 class="home-title truncate text-[28px] font-black leading-none tracking-tight sm:text-3xl">
                                {{ list.title }}
                            </h1>

                            <div class="home-muted mt-2 text-sm font-semibold">
                                {{ listMood }}
                            </div>
                        </div>

                        <button
                            type="button"
                            class="home-icon-button hidden h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-xl sm:flex"
                            @click="openListSettings"
                            aria-label="Настройки списка"
                        >
                            ⋯
                        </button>
                    </div>

                    <div class="relative z-10 mt-4 grid grid-cols-3 gap-2">
                        <div class="home-stat-pill rounded-[1.2rem] px-3 py-2">
                            <div class="home-stat-label">Всего</div>
                            <div class="home-stat-value">{{ tasksTotal }}</div>
                        </div>

                        <div class="home-stat-pill rounded-[1.2rem] px-3 py-2">
                            <div class="home-stat-label">Осталось</div>
                            <div class="home-stat-value">{{ activeTasks.length }}</div>
                        </div>

                        <div class="home-stat-pill rounded-[1.2rem] px-3 py-2">
                            <div class="home-stat-label">Готово</div>
                            <div class="home-stat-value">{{ progressPercent }}%</div>
                        </div>
                    </div>

                    <div
                        class="relative z-10 mt-3 rounded-[1.35rem] bg-white/45 p-2.5 ring-1 ring-[var(--home-border)]">
                        <div class="home-progress-track h-2.5 overflow-hidden rounded-full">
                            <div
                                class="home-progress-bar h-full rounded-full transition-all duration-500"
                                :style="{ width: `${progressPercent}%` }"
                            />
                        </div>
                    </div>
                </div>
            </header>

            <TaskComposer
                ref="taskComposer"
                v-model="form.title"
                v-model:note="form.note"
                :show="showTaskComposer"
                :processing="form.processing"
                :error="form.errors.title"
                :offline-tasks-count="offlineTasks.length"
                :is-syncing-offline-tasks="isSyncingOfflineTasks"
                :sync-error="syncError"
                @submit="createTask"
                @attachments-change="updateComposerAttachments"
                @close="closeTaskComposer"
            />

            <section class="space-y-3" data-task-list>
                <div
                    v-if="activeTasks.length === 0 && doneTasks.length === 0"
                    class="home-card rounded-[2rem] p-5"
                >
                    <div class="home-title text-lg font-semibold">
                        Пока задач нет
                    </div>

                    <div class="home-muted mt-2 text-sm leading-relaxed">
                        Добавьте первый пункт или вставьте список строк — каждая строка станет отдельной задачей.
                    </div>

                    <button
                        type="button"
                        class="home-template-button mt-4 min-h-11 rounded-full px-4 py-2 text-sm font-semibold"
                        @click="focusAddTaskInput"
                    >
                        + Добавить первый пункт
                    </button>
                </div>

                <TransitionGroup
                    v-if="offlineTasks.length > 0"
                    name="task-list"
                    tag="div"
                    class="mb-3 space-y-3"
                >
                    <OfflineTaskCard
                        v-for="task in offlineTasks"
                        :key="task.id"
                        :task="task"
                        @remove="removeOfflineTask(task.id)"
                    />
                </TransitionGroup>

                <div
                    v-if="taskReorderMode"
                    class="home-soft-card mb-3 rounded-[1.75rem] p-3"
                >
                    <div class="flex items-center justify-between gap-3">
                        <div>
                            <div class="home-title text-sm font-bold">
                                Режим сортировки задач
                            </div>
                            <div class="home-muted mt-1 text-xs font-semibold">
                                Тяните задачи за кнопку слева.
                            </div>
                        </div>

                        <button
                            type="button"
                            class="home-soft-button shrink-0 rounded-full px-4 py-2 text-sm font-semibold"
                            @click="disableTaskReorderMode"
                        >
                            Готово
                        </button>
                    </div>
                </div>

                <draggable
                    v-model="localActiveTasks"
                    item-key="id"
                    handle=".task-drag-handle"
                    tag="div"
                    class="space-y-3"
                    :class="taskReorderMode ? 'rounded-[2rem] ring-2 ring-[var(--home-focus)] ring-offset-2 ring-offset-[var(--home-bg)]' : ''"
                    :disabled="!taskReorderMode"
                    ghost-class="home-drag-ghost"
                    chosen-class="home-drag-chosen"
                    drag-class="home-drag-active"
                    animation="180"
                    @end="saveTasksOrder"
                >
                    <template #item="{ element: task }">
                        <TaskCard
                            v-if="!pendingDeleteIds.includes(task.id)"
                            :task="task"
                            variant="active"
                            :reorder-mode="taskReorderMode"
                            :is-editing="editingTaskId === task.id"
                            :editing-title="editingTitle"
                            :is-menu-open="openedTaskMenuId === task.id"
                            :editing-note="editingNote"
                            :editing-attachments="editingAttachments"
                            :editing-new-attachments="editingNewAttachments"
                            @update:editing-title="editingTitle = $event"
                            @update:editing-note="editingNote = $event"
                            @update:editing-attachments="editingAttachments = $event"
                            @update:editing-new-attachments="editingNewAttachments = $event"
                            @toggle="handleTaskTitleClick"
                            @edit="startEditTask"
                            @save-edit="saveEditTask"
                            @cancel-edit="cancelEditTask"
                            @delete="deleteTask"
                            @toggle-menu="toggleTaskMenu"
                            @start-long-press="startTaskTitleLongPress"
                            @clear-long-press="clearLongPress"
                        />
                    </template>
                </draggable>
            </section>

            <DoneTasksSection
                :tasks="doneTasks"
                :visible-tasks="visibleDoneTasks"
                :hidden-count="hiddenDoneTasksCount"
                :show="showDoneTasks"
                :editing-task-id="editingTaskId"
                :editing-title="editingTitle"
                :editing-note="editingNote"
                :opened-task-menu-id="openedTaskMenuId"
                :editing-attachments="editingAttachments"
                :editing-new-attachments="editingNewAttachments"
                :can-clear-done="isOnline && doneTasks.length > 0"
                :is-clearing-done="isClearingDoneTasks"
                @toggle-show="showDoneTasks = !showDoneTasks"
                @show-more="showMoreDoneTasks"
                @update:editing-title="editingTitle = $event"
                @update:editing-note="editingNote = $event"
                @toggle-task="handleTaskTitleClick"
                @update:editing-attachments="editingAttachments = $event"
                @update:editing-new-attachments="editingNewAttachments = $event"
                @edit="startEditTask"
                @save-edit="saveEditTask"
                @cancel-edit="cancelEditTask"
                @delete="deleteTask"
                @toggle-menu="toggleTaskMenu"
                @start-long-press="startTaskTitleLongPress"
                @clear-long-press="clearLongPress"
                @open-actions="openDoneTasksActions"
            />
        </div>

        <MobileCommandBar
            add-label="Добавить задачу"
            profile-label="Профиль"
            profile-icon="👤"
            @add="handleBottomAddClick"
            @search="handleMobileSearch"
        />

        <button
            type="button"
            class="home-bottom-add-button fixed bottom-6 right-6 z-30 hidden h-[58px] w-[58px] items-center justify-center rounded-full text-2xl font-bold leading-none sm:flex"
            @click="handleBottomAddClick"
            aria-label="Добавить задачу"
        >
            ➕
        </button>


        <Transition
            enter-active-class="transition duration-200 ease-out"
            enter-from-class="translate-y-5 opacity-0"
            enter-to-class="translate-y-0 opacity-100"
            leave-active-class="transition duration-150 ease-in"
            leave-from-class="translate-y-0 opacity-100"
            leave-to-class="translate-y-5 opacity-0"
        >
            <div
                v-if="showClearDoneConfirm"
                class="fixed inset-0 z-50 flex bg-black/10 px-3 pb-[max(env(safe-area-inset-bottom),12px)] pt-10 backdrop-blur-[2px] sm:items-center sm:justify-center sm:p-4"
                @click="showClearDoneConfirm = false"
            >
                <div
                    class="home-action-sheet mt-auto w-full max-w-xl rounded-[2rem] p-2 sm:mt-0 sm:p-3"
                    @click.stop
                >
                    <div class="px-3 pb-3 pt-3">
                        <div class="home-subtle text-xs font-bold uppercase tracking-wide">
                            Очистка истории
                        </div>

                        <div class="home-title mt-1 text-lg font-black">
                            Очистить {{ doneTasks.length }} выполненных задач?
                        </div>

                        <div class="home-muted mt-2 text-sm font-semibold leading-relaxed">
                            Это действие уберёт историю выполненных пунктов из списка.
                        </div>
                    </div>

                    <div class="grid grid-cols-2 gap-2">
                        <button
                            type="button"
                            class="home-soft-button w-full rounded-[1.35rem] px-4 py-4 text-base font-semibold"
                            :disabled="isClearingDoneTasks"
                            @click="showClearDoneConfirm = false"
                        >
                            Отмена
                        </button>

                        <button
                            type="button"
                            class="home-action-sheet-item home-action-sheet-danger w-full rounded-[1.35rem] px-4 py-4 text-center text-base font-semibold"
                            :disabled="isClearingDoneTasks || !isOnline"
                            @click="clearDoneTasks"
                        >
                            Очистить
                        </button>
                    </div>
                </div>
            </div>
        </Transition>

        <Transition
            enter-active-class="transition duration-200 ease-out"
            enter-from-class="translate-y-5 opacity-0 sm:translate-y-2"
            enter-to-class="translate-y-0 opacity-100"
            leave-active-class="transition duration-150 ease-in"
            leave-from-class="translate-y-0 opacity-100"
            leave-to-class="translate-y-5 opacity-0 sm:translate-y-2"
        >
            <div
                v-if="showListSettings"
                class="fixed inset-0 z-50 flex bg-black/10 px-3 pb-[max(env(safe-area-inset-bottom),12px)] pt-10 backdrop-blur-[2px] sm:items-center sm:justify-center sm:p-4"
                @click="closeListSettings"
            >
                <form
                    class="home-action-sheet mt-auto w-full max-w-xl rounded-[2rem] p-2 sm:mt-0 sm:p-3"
                    @submit.prevent="updateList"
                    @click.stop
                >
                    <div class="flex items-start justify-between gap-3 px-3 pb-2 pt-3">
                        <div>
                            <div class="home-subtle text-xs font-bold uppercase tracking-wide">
                                Настройки
                            </div>

                            <div class="home-title mt-1 text-base font-bold">
                                {{ list.title }}
                            </div>
                        </div>

                        <button
                            type="button"
                            class="home-menu-button flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xl"
                            aria-label="Закрыть настройки списка"
                            @click="closeListSettings"
                        >
                            ×
                        </button>
                    </div>

                    <div class="px-2 pb-2">
                        <div class="flex items-center gap-3">
                            <button
                                type="button"
                                class="home-input flex h-14 w-14 shrink-0 items-center justify-center rounded-[1.35rem] text-2xl transition active:scale-[0.96]"
                                :class="isIconPickerOpen ? 'ring-2 ring-[var(--home-focus)] ring-offset-2 ring-offset-white' : ''"
                                :aria-expanded="isIconPickerOpen"
                                aria-label="Выбрать иконку списка"
                                @click="toggleIconPicker"
                            >
                                {{ listForm.emoji }}
                            </button>

                            <input
                                v-model="listForm.title"
                                class="home-input h-14 min-w-0 flex-1 rounded-[1.35rem] px-4 text-base font-semibold"
                                placeholder="Название списка"
                                aria-label="Название списка"
                            >
                        </div>

                        <div
                            v-if="isIconPickerOpen"
                            class="mt-3"
                        >
                            <div class="home-subtle px-1 text-xs font-bold uppercase tracking-wide">
                                Выберите иконку
                            </div>

                            <div class="mt-2 grid max-h-64 grid-cols-6 gap-2 overflow-y-auto pr-1 sm:grid-cols-8">
                                <button
                                    v-for="icon in listIconOptions"
                                    :key="icon"
                                    type="button"
                                    class="home-soft-button flex h-12 items-center justify-center rounded-[1.15rem] text-2xl transition active:scale-[0.96]"
                                    :class="listForm.emoji === icon ? 'ring-2 ring-[var(--home-focus)] ring-offset-2 ring-offset-white' : ''"
                                    :aria-label="`Выбрать иконку ${icon}`"
                                    @click="selectListIcon(icon)"
                                >
                                    {{ icon }}
                                </button>
                            </div>
                        </div>
                    </div>

                    <div
                        v-if="listForm.errors.title"
                        class="px-4 pb-2 text-sm text-red-500"
                    >
                        {{ listForm.errors.title }}
                    </div>

                    <button
                        type="submit"
                        class="home-action-sheet-item w-full rounded-[1.35rem] px-4 py-4 text-left text-base font-semibold"
                        :disabled="listForm.processing || !isOnline"
                    >
                        {{ listForm.processing ? 'Сохраняю…' : 'Сохранить изменения' }}
                    </button>

                    <button
                        type="button"
                        class="home-action-sheet-item home-action-sheet-danger w-full rounded-[1.35rem] px-4 py-4 text-left text-base font-semibold"
                        :disabled="listForm.processing || !isOnline"
                        @click="archiveList"
                    >
                        Архивировать список
                    </button>

                    <button
                        type="button"
                        class="home-soft-button mt-2 w-full rounded-[1.35rem] px-4 py-4 text-base font-semibold"
                        :disabled="listForm.processing"
                        @click="closeListSettings"
                    >
                        Отмена
                    </button>
                </form>
            </div>
        </Transition>

        <Transition
            enter-active-class="transition duration-200 ease-out"
            enter-from-class="translate-y-5 opacity-0"
            enter-to-class="translate-y-0 opacity-100"
            leave-active-class="transition duration-150 ease-in"
            leave-from-class="translate-y-0 opacity-100"
            leave-to-class="translate-y-5 opacity-0"
        >
            <div
                v-if="openedTask"
                class="fixed inset-0 z-50 bg-black/10 px-3 pb-[max(env(safe-area-inset-bottom),12px)] pt-10 backdrop-blur-[2px] sm:hidden"
                @click="closeTaskMenu"
            >
                <div
                    class="home-action-sheet mt-auto rounded-[2rem] p-2"
                    @click.stop
                >
                    <div class="px-3 pb-2 pt-3">
                        <div class="home-subtle text-xs font-bold uppercase tracking-wide">
                            Действия
                        </div>

                        <div class="home-title mt-1 line-clamp-2 text-base font-bold">
                            {{ openedTask.title }}
                        </div>
                    </div>

                    <button
                        type="button"
                        class="home-action-sheet-item w-full rounded-[1.35rem] px-4 py-4 text-left text-base font-semibold"
                        @click="toggleTask(openedTask)"
                    >
                        {{ openedTask?.is_done ? 'Вернуть в активные' : 'Отметить выполненной' }}
                    </button>

                    <button
                        type="button"
                        class="home-action-sheet-item w-full rounded-[1.35rem] px-4 py-4 text-left text-base font-semibold"
                        @click="startEditTask(openedTask)"
                    >
                        Редактировать
                    </button>

                    <button
                        type="button"
                        class="home-action-sheet-item home-action-sheet-danger w-full rounded-[1.35rem] px-4 py-4 text-left text-base font-semibold"
                        @click="deleteTask(openedTask)"
                    >
                        Удалить
                    </button>

                    <button
                        type="button"
                        class="home-soft-button mt-2 w-full rounded-[1.35rem] px-4 py-4 text-base font-semibold"
                        @click="closeTaskMenu"
                    >
                        Отмена
                    </button>
                </div>
            </div>
        </Transition>

        <HomeToast
            :show="pendingDeleteTasks.length > 0"
            title="Задача удалена"
            :description="pendingDeleteTasks[pendingDeleteTasks.length - 1]?.title"
            button-text="Отменить"
            @action="undoDeleteTask(pendingDeleteTasks[pendingDeleteTasks.length - 1])"
        />

        <HomeToast
            :show="pendingClearDoneTasks.length > 0"
            title="История очищена"
            button-text="Отменить"
            @action="undoClearDoneTasks"
        />

        <HomeToast
            :show="updateAvailable"
            :title="pwaUpdateTitle"
            :description="pwaUpdateDescription"
            :button-text="pwaUpdateState === 'ready' ? 'Обновить' : '…'"
            @action="pwaUpdateState === 'ready' ? reloadApp() : null"
        />
    </main>
</template>

<style scoped>
.task-list-move,
.task-list-enter-active,
.task-list-leave-active {
    transition: opacity 220ms ease,
    transform 220ms ease;
}

.task-list-enter-from,
.task-list-leave-to {
    opacity: 0;
    transform: translateY(8px) scale(0.98);
}

.task-drag-handle {
    touch-action: none;
}

.home-list-hero {
    background: linear-gradient(135deg, rgba(255, 255, 255, 0.82), rgba(245, 250, 239, 0.72)),
    radial-gradient(circle at 15% 10%, rgba(205, 226, 183, 0.55), transparent 34%),
    radial-gradient(circle at 95% 20%, rgba(231, 239, 218, 0.9), transparent 34%);
    box-shadow: 0 16px 38px rgba(76, 96, 63, 0.08);
    border: 1px solid rgba(204, 221, 190, 0.7);
}

.home-list-hero-orb {
    position: absolute;
    pointer-events: none;
    border-radius: 999px;
    filter: blur(1px);
    opacity: 0.65;
}

.home-list-hero-orb-left {
    left: -8px;
    top: 58px;
    width: 85px;
    height: 85px;
    background: rgba(211, 229, 190, 0.55);
}

.home-list-hero-orb-right {
    right: -38px;
    top: -26px;
    width: 118px;
    height: 118px;
    background: rgba(239, 246, 229, 0.9);
}

.home-back-button {
    color: var(--home-text);
    background: rgba(255, 255, 255, 0.62);
    border: 1px solid rgba(205, 221, 190, 0.82);
    box-shadow: 0 8px 22px rgba(79, 103, 63, 0.07);
    backdrop-filter: blur(14px);
}

.home-back-icon {
    color: var(--home-text);
    background: rgba(224, 237, 207, 0.88);
}

.home-list-avatar {
    box-shadow: 0 12px 26px rgba(85, 109, 66, 0.12),
    inset 0 1px 0 rgba(255, 255, 255, 0.85);
}

.home-stat-pill {
    background: rgba(255, 255, 255, 0.58);
    border: 1px solid rgba(207, 222, 191, 0.72);
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.78);
}

.home-stat-label {
    color: var(--home-text-subtle);
    font-size: 10px;
    font-weight: 800;
    line-height: 1;
    text-transform: uppercase;
    letter-spacing: 0.04em;
}

.home-stat-value {
    margin-top: 5px;
    color: var(--home-text);
    font-size: 17px;
    font-weight: 900;
    line-height: 1;
}

@media (max-width: 640px) {
    .home-container {
        padding-top: 0.75rem;
    }

    .home-list-header {
        backdrop-filter: blur(18px);
    }
}
</style>
