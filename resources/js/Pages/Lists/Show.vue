<script setup>
import { Head, Link, router, useForm, usePage } from '@inertiajs/vue3'
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import draggable from 'vuedraggable'
import NetworkStatus from '@/Components/NetworkStatus.vue'
import { useNetworkStatus } from '@/Composables/useNetworkStatus'
import { useOfflineTaskQueue } from '@/Composables/useOfflineTaskQueue'

const props = defineProps({
    list: {
        type: Object,
        required: true,
    },
})

const page = usePage()
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

function handlePwaUpdateAvailable() {
    updateAvailable.value = true
}

function reloadApp() {
    if (window.__pwaWaitingWorker) {
        window.__pwaWaitingWorker.postMessage({ type: 'SKIP_WAITING' })
        return
    }

    window.location.reload()
}

function vibrateLight() {
    if ('vibrate' in navigator) {
        navigator.vibrate(8)
    }
}

const localActiveTasks = ref([])
const localDoneTasks = ref([])
const showDoneTasks = ref(false)

function handleOnline() {
    syncOfflineTasks()
}

onMounted(() => {
    if (navigator.onLine) {
        syncOfflineTasks()
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('pwa-update-available', handlePwaUpdateAvailable)
})

onUnmounted(() => {
    window.removeEventListener('online', handleOnline)
    window.removeEventListener('pwa-update-available', handlePwaUpdateAvailable)
})

watch(
    () => isOnline.value,
    value => {
        if (value) {
            syncOfflineTasks()
        }
    },
)

function syncLocalTasks(tasks) {
    localActiveTasks.value = tasks.filter(task => !task.is_done)
    localDoneTasks.value = tasks.filter(task => task.is_done)
}

syncLocalTasks(props.list.tasks)

watch(
    () => props.list.tasks,
    value => {
        syncLocalTasks(value)
    },
)

const form = useForm({
    title: '',
})

const pendingDeleteIds = ref([])
const pendingDeleteTasks = ref([])
const deleteTimers = new Map()

const addTaskInput = ref(null)
const showTaskComposer = ref(false)

function focusAddTaskInput() {
    showTaskComposer.value = true

    nextTick(() => {
        addTaskInput.value?.focus()
        addTaskInput.value?.scrollIntoView({
            behavior: 'smooth',
            block: 'center',
        })
    })
}

function closeTaskComposer() {
    if (form.processing) {
        return
    }

    form.reset()
    form.clearErrors()
    showTaskComposer.value = false
}

const showListSettings = ref(false)

const listForm = useForm({
    title: props.list.title,
    emoji: props.list.emoji,
})

function updateList() {
    if (!isOnline.value) {
        return
    }

    listForm.patch(route('lists.update', props.list.id), {
        preserveScroll: true,
        onSuccess: () => {
            showListSettings.value = false
        },
    })
}

function archiveList() {
    if (!isOnline.value) {
        return
    }

    if (!confirm('Архивировать этот список? Он пропадёт с главной страницы.')) {
        return
    }

    router.delete(route('lists.destroy', props.list.id))
}

function repeatDoneTasks() {
    if (!isOnline.value) {
        return
    }

    router.post(route('lists.repeat-done-tasks', props.list.id), {}, {
        preserveScroll: true,
    })
}

const editingTaskId = ref(null)
const editingTitle = ref('')
const editingInput = ref(null)
const openedTaskMenuId = ref(null)
const longPressTimer = ref(null)

function startEditTask(task) {
    if (task._offline) {
        return
    }

    openedTaskMenuId.value = null
    editingTaskId.value = task.id
    editingTitle.value = task.title

    nextTick(() => {
        editingInput.value?.focus()
    })
}

function cancelEditTask() {
    editingTaskId.value = null
    editingTitle.value = ''
}

function saveEditTask(task) {
    const title = editingTitle.value.trim()

    if (!title) {
        cancelEditTask()
        return
    }

    if (title === task.title) {
        cancelEditTask()
        return
    }

    if (!isOnline.value) {
        cancelEditTask()
        return
    }

    router.patch(route('tasks.update', task.id), {
        title,
    }, {
        preserveScroll: true,
        onSuccess: () => {
            cancelEditTask()
        },
    })
}

const activeTasks = computed(() => {
    return localActiveTasks.value.filter(task => !pendingDeleteIds.value.includes(task.id))
})

const doneTasks = computed(() => {
    return localDoneTasks.value.filter(task => !pendingDeleteIds.value.includes(task.id))
})

const visibleDoneTasks = computed(() => {
    if (showDoneTasks.value) {
        return doneTasks.value
    }

    return []
})

const hiddenDoneTasksCount = computed(() => {
    return Math.max(doneTasks.value.length - visibleDoneTasks.value.length, 0)
})

const tasksTotal = computed(() => activeTasks.value.length + doneTasks.value.length + offlineTasks.value.length)

const progressPercent = computed(() => {
    if (tasksTotal.value === 0) {
        return 0
    }

    return Math.round((doneTasks.value.length / tasksTotal.value) * 100)
})

const openedTask = computed(() => {
    return [...activeTasks.value, ...doneTasks.value].find(task => task.id === openedTaskMenuId.value) ?? null
})

const listMood = computed(() => {
    if (tasksTotal.value === 0) {
        return 'Список пустой — самое время добавить первый пункт.'
    }

    if (activeTasks.value.length === 0) {
        return 'Все задачи выполнены. Красиво.'
    }

    return `${activeTasks.value.length} осталось · ${progressPercent.value}% готово`
})

function createTask() {
    const title = form.title.trim()

    if (!title || form.processing) {
        return
    }

    if (!isOnline.value) {
        addOfflineTask(title, user.value)
        vibrateLight()

        form.reset()

        nextTick(() => {
            addTaskInput.value?.focus()
        })

        return
    }

    form.post(route('tasks.store', props.list.id), {
        preserveScroll: true,
        onSuccess: () => {
            vibrateLight()
            form.reset()

            nextTick(() => {
                addTaskInput.value?.focus()
            })
        },
    })
}

function toggleTask(task) {
    if (task._offline) {
        return
    }

    if (!isOnline.value) {
        return
    }

    openedTaskMenuId.value = null
    vibrateLight()

    router.post(route('tasks.toggle', task.id), {}, {
        preserveScroll: true,
    })
}

function deleteTask(task) {
    openedTaskMenuId.value = null

    if (task._offline) {
        removeOfflineTask(task.id)
        return
    }

    if (!isOnline.value) {
        return
    }

    if (pendingDeleteIds.value.includes(task.id)) {
        return
    }

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

function undoDeleteTask(task) {
    const timer = deleteTimers.get(task.id)

    if (timer) {
        window.clearTimeout(timer)
        deleteTimers.delete(task.id)
    }

    removePendingDelete(task.id)
}

function removePendingDelete(taskId) {
    pendingDeleteIds.value = pendingDeleteIds.value.filter(id => id !== taskId)
    pendingDeleteTasks.value = pendingDeleteTasks.value.filter(task => task.id !== taskId)
    deleteTimers.delete(taskId)
}

function userInitials(name) {
    return name
        ?.split(' ')
        .map(part => part[0])
        .join('')
        .slice(0, 2)
        .toUpperCase()
}

function openListSettings() {
    showListSettings.value = true

    nextTick(() => {
        document
            .getElementById('list-settings')
            ?.scrollIntoView({
                behavior: 'smooth',
                block: 'start',
            })
    })
}

function handleBottomAddClick() {
    focusAddTaskInput()
}

function toggleTaskMenu(task) {
    openedTaskMenuId.value = openedTaskMenuId.value === task.id ? null : task.id
}

function closeTaskMenu() {
    openedTaskMenuId.value = null
}

function startLongPress(task) {
    clearLongPress()

    longPressTimer.value = window.setTimeout(() => {
        openedTaskMenuId.value = task.id
        vibrateLight()
    }, 500)
}

function clearLongPress() {
    if (!longPressTimer.value) {
        return
    }

    window.clearTimeout(longPressTimer.value)
    longPressTimer.value = null
}

function saveTasksOrder() {
    if (!isOnline.value) {
        syncLocalTasks(props.list.tasks)
        return
    }

    router.patch(route('tasks.reorder', props.list.id), {
        ids: localActiveTasks.value
            .filter(task => !pendingDeleteIds.value.includes(task.id))
            .map(task => task.id),
    }, {
        preserveScroll: true,
        preserveState: true,
    })
}
</script>

<template>
    <Head :title="list.title" />

    <NetworkStatus />

    <main class="home-page home-mobile-page" @click.self="closeTaskMenu">
        <div class="home-container pb-44 sm:pb-32">
            <header class="home-list-header sticky top-0 z-20 -mx-3 mb-5 px-3 pt-3 sm:static sm:mx-0 sm:px-0 sm:pt-0">
                <div class="home-list-hero relative overflow-hidden rounded-b-[2.2rem] px-1 pb-4 pt-2 sm:rounded-[2rem] sm:px-4">
                    <div class="home-list-hero-orb home-list-hero-orb-left" />
                    <div class="home-list-hero-orb home-list-hero-orb-right" />

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
                        <div class="home-avatar-card home-list-avatar flex h-16 w-16 shrink-0 items-center justify-center rounded-[1.6rem] text-3xl">
                            {{ list.emoji }}
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

                    <div class="relative z-10 mt-3 rounded-[1.35rem] bg-white/45 p-2.5 ring-1 ring-[var(--home-border)]">
                        <div class="home-progress-track h-2.5 overflow-hidden rounded-full">
                            <div
                                class="home-progress-bar h-full rounded-full transition-all duration-500"
                                :style="{ width: `${progressPercent}%` }"
                            />
                        </div>
                    </div>
                </div>
            </header>

            <section
                id="list-settings"
                class="mb-5"
            >
                <button
                    v-if="!showListSettings"
                    type="button"
                    class="home-secondary-button hidden w-full rounded-[1.75rem] px-5 py-4 text-base font-semibold sm:block"
                    @click="showListSettings = true"
                >
                    Настройки списка
                </button>

                <form
                    v-else
                    class="home-card rounded-[2rem] p-5"
                    @submit.prevent="updateList"
                >
                    <div class="home-title text-lg font-semibold">
                        Настройки списка
                    </div>

                    <div class="mt-4 flex gap-3">
                        <input
                            v-model="listForm.emoji"
                            class="home-input h-12 w-16 rounded-2xl text-center text-2xl"
                            maxlength="4"
                        >

                        <input
                            v-model="listForm.title"
                            class="home-input h-12 min-w-0 flex-1 rounded-2xl px-4 text-base"
                            placeholder="Название списка"
                        >
                    </div>

                    <div
                        v-if="listForm.errors.title"
                        class="mt-2 text-sm text-red-500"
                    >
                        {{ listForm.errors.title }}
                    </div>

                    <div class="mt-4 flex gap-2">
                        <button
                            type="submit"
                            class="home-primary-button flex-1 rounded-2xl px-4 py-3 font-semibold"
                            :disabled="listForm.processing || !isOnline"
                        >
                            {{ listForm.processing ? 'Сохраняю…' : 'Сохранить' }}
                        </button>

                        <button
                            type="button"
                            class="home-soft-button rounded-2xl px-4 py-3 font-medium"
                            :disabled="listForm.processing"
                            @click="showListSettings = false"
                        >
                            Отмена
                        </button>
                    </div>

                    <button
                        type="button"
                        class="home-danger-button mt-4 w-full rounded-2xl px-4 py-3 font-medium"
                        @click="archiveList"
                    >
                        Архивировать список
                    </button>
                </form>
            </section>

            <Transition
                enter-active-class="transition duration-200 ease-out"
                enter-from-class="opacity-0"
                enter-to-class="opacity-100"
                leave-active-class="transition duration-150 ease-in"
                leave-from-class="opacity-100"
                leave-to-class="opacity-0"
            >
                <div
                    v-if="showTaskComposer"
                    class="fixed inset-0 z-20 hidden bg-black/5 backdrop-blur-[1px] max-sm:block"
                    @click="closeTaskComposer"
                />
            </Transition>

            <Transition
                enter-active-class="transition duration-200 ease-out"
                enter-from-class="-translate-y-2 opacity-0"
                enter-to-class="translate-y-0 opacity-100"
                leave-active-class="transition duration-150 ease-in"
                leave-from-class="translate-y-0 opacity-100"
                leave-to-class="-translate-y-2 opacity-0"
            >
                <form
                    v-if="showTaskComposer"
                    class="home-glass-card home-task-composer sticky top-[172px] z-30 mb-5 rounded-[2rem] p-2 sm:top-4"
                    @submit.prevent="createTask"
                >
                    <div class="mb-2 flex items-center justify-between px-2 pt-1">
                        <div class="home-muted text-xs font-bold uppercase tracking-wide">
                            Новая задача
                        </div>

                        <button
                            type="button"
                            class="home-menu-button flex h-9 w-9 items-center justify-center rounded-full text-xl"
                            aria-label="Закрыть поле добавления"
                            @click="closeTaskComposer"
                        >
                            ×
                        </button>
                    </div>

                    <div class="flex items-stretch gap-2">
            <textarea
                ref="addTaskInput"
                v-model="form.title"
                class="home-input min-h-[72px] flex-1 resize-none rounded-[1.5rem] border-transparent px-4 py-4 text-[17px] leading-snug sm:min-h-[52px] sm:py-3 sm:text-base"
                placeholder="Новая задача или список строк..."
                autocomplete="off"
                rows="2"
                @keydown.ctrl.enter.prevent="createTask"
                @keydown.meta.enter.prevent="createTask"
                @keydown.esc.prevent="closeTaskComposer"
            />

                        <button
                            type="submit"
                            class="home-composer-add grid min-h-[72px] w-[58px] shrink-0 place-items-center rounded-[1.5rem] text-[28px] font-normal leading-none transition active:scale-[0.96] disabled:opacity-50 sm:min-h-[52px] sm:w-[52px] sm:text-2xl"
                            :disabled="form.processing || !form.title.trim()"
                            aria-label="Добавить задачу"
                        >
                <span aria-hidden="true" class="-mt-0.5 leading-none">
                    {{ form.processing ? '…' : '＋' }}
                </span>
                        </button>
                    </div>

                    <div
                        v-if="form.errors.title"
                        class="px-2 pt-2 text-sm text-red-500"
                    >
                        {{ form.errors.title }}
                    </div>

                    <div
                        v-if="offlineTasks.length > 0"
                        class="px-2 pt-2 text-xs font-semibold"
                        :class="syncError ? 'text-red-500' : 'home-muted'"
                    >
                        <template v-if="isSyncingOfflineTasks">
                            Отправляю сохранённые задачи…
                        </template>

                        <template v-else-if="syncError">
                            Не удалось отправить сохранённые задачи. Попробуем позже.
                        </template>

                        <template v-else>
                            {{ offlineTasks.length }} {{ offlineTasks.length === 1 ? 'задача ждёт' : 'задачи ждут' }} отправки.
                        </template>
                    </div>
                </form>
            </Transition>

            <div
                v-if="doneTasks.length > 0"
                class="mb-5 hidden sm:block"
            >
                <button
                    type="button"
                    class="home-secondary-button w-full rounded-[1.75rem] px-5 py-4 text-base font-semibold active:scale-[0.99]"
                    :disabled="!isOnline"
                    @click="repeatDoneTasks"
                >
                    ↺ Повторить выполненные
                </button>
            </div>

            <section class="space-y-3">
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
                    <div
                        v-for="task in offlineTasks"
                        :key="task.id"
                        class="home-card home-task-card relative rounded-[1.8rem] p-3 transition active:scale-[0.99] sm:p-4"
                    >
                        <div class="flex min-h-[60px] items-center gap-3">
                            <button
                                type="button"
                                class="home-check-button home-check-button-mobile flex h-12 w-12 shrink-0 items-center justify-center rounded-full opacity-50"
                                aria-label="Задача ожидает отправки"
                                disabled
                            />

                            <div
                                class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                                :style="{ backgroundColor: task.creator?.avatar_color || 'var(--home-avatar-fallback)' }"
                                :title="task.creator?.name"
                            >
                                {{ userInitials(task.creator?.name) }}
                            </div>

                            <div class="min-w-0 flex-1 py-2">
                                <div class="home-title text-[17px] font-semibold leading-snug line-clamp-3 sm:text-lg sm:line-clamp-2">
                                    {{ task.title }}
                                </div>

                                <div class="home-muted mt-1 flex items-center gap-2 text-xs font-semibold">
                    <span
                        class="inline-flex h-2 w-2 rounded-full"
                        :class="task._syncing ? 'bg-amber-500' : 'bg-[var(--home-focus)]'"
                    />

                                    <span>
                        {{ task._syncing ? 'Отправляется…' : 'Сохранено на устройстве' }}
                    </span>
                                </div>
                            </div>

                            <button
                                type="button"
                                class="home-menu-button flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-xl"
                                aria-label="Удалить локальную задачу"
                                @click="removeOfflineTask(task.id)"
                            >
                                ×
                            </button>
                        </div>
                    </div>
                </TransitionGroup>

                <draggable
                    v-model="localActiveTasks"
                    item-key="id"
                    handle=".task-drag-handle"
                    tag="div"
                    class="space-y-3"
                    ghost-class="opacity-40"
                    chosen-class="scale-[0.99]"
                    animation="180"
                    @end="saveTasksOrder"
                >
                    <template #item="{ element: task }">
                        <div
                            v-if="!pendingDeleteIds.includes(task.id)"
                            class="home-card home-task-card relative rounded-[1.8rem] p-3 transition active:scale-[0.99] sm:p-4"
                        >
                            <div class="flex min-h-[60px] items-center gap-3">
                                <button
                                    type="button"
                                    class="task-drag-handle flex h-12 w-8 shrink-0 cursor-grab items-center justify-center rounded-full text-xl text-[var(--home-text-subtle)] active:cursor-grabbing sm:h-10 sm:w-7"
                                    aria-label="Перетащить задачу"
                                >
                                    ⋮⋮
                                </button>

                                <button
                                    type="button"
                                    class="home-check-button home-check-button-mobile flex h-12 w-12 shrink-0 items-center justify-center rounded-full"
                                    aria-label="Отметить выполненной"
                                    @click="toggleTask(task)"
                                />

                                <div
                                    class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                                    :style="{ backgroundColor: task.creator?.avatar_color || 'var(--home-avatar-fallback)' }"
                                    :title="task.creator?.name"
                                >
                                    {{ userInitials(task.creator?.name) }}
                                </div>

                                <textarea
                                    v-if="editingTaskId === task.id"
                                    ref="editingInput"
                                    v-model="editingTitle"
                                    class="home-input min-h-[68px] min-w-0 flex-1 resize-none rounded-2xl px-3 py-2 text-[17px] font-semibold leading-snug sm:min-h-[44px] sm:text-lg"
                                    rows="2"
                                    @keydown.ctrl.enter.prevent="saveEditTask(task)"
                                    @keydown.meta.enter.prevent="saveEditTask(task)"
                                    @keydown.esc.prevent="cancelEditTask"
                                    @blur="saveEditTask(task)"
                                />

                                <button
                                    v-else
                                    type="button"
                                    class="home-title min-w-0 flex-1 select-none py-2 text-left text-[17px] font-semibold leading-snug line-clamp-3 sm:text-lg sm:line-clamp-2"
                                    @click="startEditTask(task)"
                                    @contextmenu.prevent="toggleTaskMenu(task)"
                                    @pointerdown="startLongPress(task)"
                                    @pointerup="clearLongPress"
                                    @pointerleave="clearLongPress"
                                    @pointercancel="clearLongPress"
                                >
                                    {{ task.title }}
                                </button>

                                <button
                                    type="button"
                                    class="home-menu-button flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-xl"
                                    @click.stop="toggleTaskMenu(task)"
                                    aria-label="Действия с задачей"
                                >
                                    ⋯
                                </button>
                            </div>

                            <div
                                v-if="task._offline"
                                class="mt-2 flex items-center gap-2 pl-[108px] text-xs font-semibold sm:pl-[122px]"
                            >
                                <span
                                    class="inline-flex h-2 w-2 rounded-full"
                                    :class="task._syncing ? 'bg-amber-500' : 'bg-[var(--home-focus)]'"
                                />

                                <span class="home-muted">
                                    {{ task._syncing ? 'Отправляется…' : 'Сохранено на устройстве' }}
                                </span>
                            </div>

                            <div
                                v-if="openedTaskMenuId === task.id"
                                class="home-task-menu absolute right-3 top-16 z-20 hidden w-44 overflow-hidden rounded-2xl p-1 sm:block"
                                @click.stop
                            >
                                <button
                                    type="button"
                                    class="home-task-menu-item w-full rounded-xl px-3 py-3 text-left text-sm font-semibold"
                                    @click="startEditTask(task)"
                                >
                                    Редактировать
                                </button>

                                <button
                                    type="button"
                                    class="home-task-menu-item home-task-menu-danger w-full rounded-xl px-3 py-3 text-left text-sm font-semibold"
                                    @click="deleteTask(task)"
                                >
                                    Удалить
                                </button>
                            </div>
                        </div>
                    </template>
                </draggable>
            </section>

            <section
                v-if="doneTasks.length > 0"
                class="mt-8 pb-6"
            >
                <button
                    type="button"
                    class="home-done-section-toggle mb-3 flex min-h-12 w-full items-center justify-between rounded-[1.5rem] px-4 py-3 text-left text-sm font-bold"
                    @click="showDoneTasks = !showDoneTasks"
                >
        <span>
            {{ showDoneTasks ? 'Свернуть выполненные' : 'Выполнено' }} · {{ doneTasks.length }}
        </span>

                    <span class="text-base leading-none">
            {{ showDoneTasks ? '⌃' : '⌄' }}
        </span>
                </button>

                <TransitionGroup
                    name="task-list"
                    tag="div"
                    class="space-y-3"
                >
                    <div
                        v-for="task in visibleDoneTasks"
                        :key="task.id"
                        class="home-soft-card home-task-card relative rounded-[1.8rem] p-3 opacity-80 transition active:scale-[0.99] sm:p-4"
                    >
                        <div class="flex min-h-[56px] items-center gap-3">
                            <button
                                type="button"
                                class="home-done-check-button flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-sm font-bold"
                                aria-label="Вернуть в активные"
                                @click="toggleTask(task)"
                            >
                                ✓
                            </button>

                            <div
                                class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white opacity-70"
                                :style="{ backgroundColor: task.creator?.avatar_color || 'var(--home-avatar-fallback)' }"
                                :title="task.creator?.name"
                            >
                                {{ userInitials(task.creator?.name) }}
                            </div>

                            <textarea
                                v-if="editingTaskId === task.id"
                                ref="editingInput"
                                v-model="editingTitle"
                                class="home-input min-h-[68px] min-w-0 flex-1 resize-none rounded-2xl px-3 py-2 text-[17px] font-semibold leading-snug sm:min-h-[44px] sm:text-lg"
                                rows="2"
                                @keydown.ctrl.enter.prevent="saveEditTask(task)"
                                @keydown.meta.enter.prevent="saveEditTask(task)"
                                @keydown.esc.prevent="cancelEditTask"
                                @blur="saveEditTask(task)"
                            />

                            <button
                                v-else
                                type="button"
                                class="home-muted min-w-0 flex-1 select-none py-2 text-left text-[17px] font-medium leading-snug line-clamp-3 line-through decoration-[var(--home-focus)] sm:text-lg sm:line-clamp-2"
                                @click="startEditTask(task)"
                                @contextmenu.prevent="toggleTaskMenu(task)"
                                @pointerdown="startLongPress(task)"
                                @pointerup="clearLongPress"
                                @pointerleave="clearLongPress"
                                @pointercancel="clearLongPress"
                            >
                                {{ task.title }}
                            </button>

                            <button
                                type="button"
                                class="home-menu-button flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-xl"
                                @click.stop="toggleTaskMenu(task)"
                                aria-label="Действия с задачей"
                            >
                                ⋯
                            </button>
                        </div>

                        <div
                            v-if="openedTaskMenuId === task.id"
                            class="home-task-menu absolute right-3 top-16 z-20 hidden w-44 overflow-hidden rounded-2xl p-1 sm:block"
                            @click.stop
                        >
                            <button
                                type="button"
                                class="home-task-menu-item w-full rounded-xl px-3 py-3 text-left text-sm font-semibold"
                                @click="startEditTask(task)"
                            >
                                Редактировать
                            </button>

                            <button
                                type="button"
                                class="home-task-menu-item home-task-menu-danger w-full rounded-xl px-3 py-3 text-left text-sm font-semibold"
                                @click="deleteTask(task)"
                            >
                                Удалить
                            </button>
                        </div>
                    </div>
                </TransitionGroup>
                <button
                    v-if="showDoneTasks && hiddenDoneTasksCount > 0"
                    type="button"
                    class="home-soft-button mt-3 min-h-12 w-full rounded-[1.5rem] px-4 py-3 text-sm font-semibold"
                    @click="showDoneTasks = true"
                >
                    Показать ещё {{ hiddenDoneTasksCount }}
                </button>
            </section>
        </div>

        <nav class="home-bottom-nav fixed inset-x-0 bottom-0 z-30 px-3 pb-[max(env(safe-area-inset-bottom),12px)] pt-2 sm:hidden">
            <div class="mx-auto grid max-w-xl grid-cols-3 items-end gap-2">
                <button
                    v-if="doneTasks.length > 0"
                    type="button"
                    class="home-bottom-side-button flex min-h-[50px] flex-col items-center justify-center rounded-2xl px-2 text-xs font-semibold"
                    :disabled="!isOnline"
                    @click="repeatDoneTasks"
                >
                    <span class="text-base leading-none">↺</span>
                    <span class="mt-1">Повторить</span>
                </button>

                <div v-else />

                <button
                    type="button"
                    class="home-bottom-add-button mx-auto flex h-16 w-16 -translate-y-3 items-center justify-center rounded-[1.7rem] text-3xl font-medium leading-none"
                    @click="handleBottomAddClick"
                    aria-label="Добавить задачу"
                >
                    <span aria-hidden="true" class="-mt-0.5 leading-none">＋</span>
                </button>

                <button
                    type="button"
                    class="home-bottom-side-button flex min-h-[50px] flex-col items-center justify-center rounded-2xl px-2 text-xs font-semibold"
                    @click="openListSettings"
                >
                    <span class="text-base leading-none">⋯</span>
                    <span class="mt-1">Ещё</span>
                </button>
            </div>
        </nav>

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

        <Transition
            enter-active-class="transition duration-300 ease-out"
            enter-from-class="translate-y-4 opacity-0"
            enter-to-class="translate-y-0 opacity-100"
            leave-active-class="transition duration-200 ease-in"
            leave-from-class="translate-y-0 opacity-100"
            leave-to-class="translate-y-4 opacity-0"
        >
            <div
                v-if="pendingDeleteTasks.length > 0"
                class="fixed inset-x-0 bottom-24 z-40 px-3 sm:bottom-6"
            >
                <div class="home-toast mx-auto flex max-w-xl items-center justify-between gap-3 rounded-[1.5rem] px-4 py-3">
                    <div class="min-w-0">
                        <div class="text-sm font-semibold">
                            Задача удалена
                        </div>

                        <div class="truncate text-xs text-white/70">
                            {{ pendingDeleteTasks[pendingDeleteTasks.length - 1]?.title }}
                        </div>
                    </div>

                    <button
                        type="button"
                        class="shrink-0 rounded-full bg-white/15 px-4 py-2 text-sm font-semibold text-white transition active:scale-95"
                        @click="undoDeleteTask(pendingDeleteTasks[pendingDeleteTasks.length - 1])"
                    >
                        Отменить
                    </button>
                </div>
            </div>
        </Transition>

        <Transition
            enter-active-class="transition duration-300 ease-out"
            enter-from-class="translate-y-4 opacity-0"
            enter-to-class="translate-y-0 opacity-100"
            leave-active-class="transition duration-200 ease-in"
            leave-from-class="translate-y-0 opacity-100"
            leave-to-class="translate-y-4 opacity-0"
        >
            <div
                v-if="updateAvailable"
                class="fixed inset-x-0 bottom-24 z-50 px-3 sm:bottom-6"
            >
                <div class="home-toast mx-auto flex max-w-xl items-center justify-between gap-3 rounded-[1.5rem] px-4 py-3">
                    <div class="min-w-0">
                        <div class="text-sm font-semibold">
                            Доступна новая версия
                        </div>
                        <div class="truncate text-xs text-white/70">
                            Обновите приложение, чтобы применить изменения.
                        </div>
                    </div>

                    <button
                        type="button"
                        class="shrink-0 rounded-full bg-white/15 px-4 py-2 text-sm font-semibold text-white transition active:scale-95"
                        @click="reloadApp"
                    >
                        Обновить
                    </button>
                </div>
            </div>
        </Transition>
    </main>
</template>

<style scoped>
.task-list-move,
.task-list-enter-active,
.task-list-leave-active {
    transition:
        opacity 220ms ease,
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
    background:
        linear-gradient(135deg, rgba(255, 255, 255, 0.82), rgba(245, 250, 239, 0.72)),
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
    left: -24px;
    top: 54px;
    width: 92px;
    height: 92px;
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
    box-shadow:
        0 12px 26px rgba(85, 109, 66, 0.12),
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
