<script setup>
import { Head, Link, router, useForm } from '@inertiajs/vue3'
import { computed, nextTick, ref, watch } from 'vue'
import draggable from 'vuedraggable'

const props = defineProps({
    list: {
        type: Object,
        required: true,
    },
})

const localActiveTasks = ref([])
const localDoneTasks = ref([])

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

function focusAddTaskInput() {
    nextTick(() => {
        addTaskInput.value?.focus()
        addTaskInput.value?.scrollIntoView({
            behavior: 'smooth',
            block: 'center',
        })
    })
}

const showListSettings = ref(false)

const listForm = useForm({
    title: props.list.title,
    emoji: props.list.emoji,
})

function updateList() {
    listForm.patch(route('lists.update', props.list.id), {
        preserveScroll: true,
        onSuccess: () => {
            showListSettings.value = false
        },
    })
}

function archiveList() {
    if (!confirm('Архивировать этот список? Он пропадёт с главной страницы.')) {
        return
    }

    router.delete(route('lists.destroy', props.list.id))
}

function repeatDoneTasks() {
    router.post(route('lists.repeat-done-tasks', props.list.id), {}, {
        preserveScroll: true,
    })
}

const editingTaskId = ref(null)
const editingTitle = ref('')
const editingInput = ref(null)

function startEditTask(task) {
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

function createTask() {
    form.post(route('tasks.store', props.list.id), {
        preserveScroll: true,
        onSuccess: () => {
            form.reset()

            nextTick(() => {
                addTaskInput.value?.focus()
            })
        },
    })
}

function toggleTask(task) {
    router.post(route('tasks.toggle', task.id), {}, {
        preserveScroll: true,
    })
}

function deleteTask(task) {
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

function saveTasksOrder() {
    router.patch(route('tasks.reorder', props.list.id), {
        ids: localActiveTasks.value.map(task => task.id),
    }, {
        preserveScroll: true,
        preserveState: true,
    })
}
</script>

<template>
    <Head :title="list.title" />

    <main class="home-page">
        <div class="home-container pb-32">
            <header class="mb-5">
                <Link
                    :href="route('home')"
                    class="home-heading-soft text-sm font-semibold transition hover:opacity-80"
                >
                    ← Все списки
                </Link>

                <div class="mt-4 flex items-center gap-3">
                    <div class="home-avatar-card flex h-14 w-14 shrink-0 items-center justify-center rounded-3xl text-3xl">
                        {{ list.emoji }}
                    </div>

                    <div class="min-w-0 flex-1">
                        <h1 class="home-title truncate text-2xl font-bold sm:text-3xl">
                            {{ list.title }}
                        </h1>

                        <div class="home-muted mt-1 text-sm font-medium">
                            {{ activeTasks.length }} активных · {{ doneTasks.length }} выполнено
                        </div>
                    </div>

                    <button
                        type="button"
                        class="home-icon-button hidden h-11 w-11 shrink-0 items-center justify-center rounded-full text-xl hover:bg-[var(--home-surface-soft)] sm:flex"
                        @click="showListSettings = !showListSettings"
                    >
                        ⋯
                    </button>
                </div>
            </header>

            <section
                v-if="showListSettings"
                id="list-settings"
                class="home-card mb-5 rounded-[2rem] p-5"
            >
                <form @submit.prevent="updateList">
                    <div class="flex gap-3">
                        <input
                            v-model="listForm.emoji"
                            class="home-input h-12 w-16 rounded-2xl text-center text-2xl"
                            maxlength="4"
                        >

                        <input
                            v-model="listForm.title"
                            class="home-input h-12 min-w-0 flex-1 rounded-2xl px-4"
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
                            :disabled="listForm.processing"
                        >
                            Сохранить
                        </button>

                        <button
                            type="button"
                            class="home-soft-button rounded-2xl px-4 py-3 font-medium"
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

            <form
                class="home-glass-card sticky top-2 z-10 mb-5 rounded-[2rem] p-2"
                @submit.prevent="createTask"
            >
                <div class="flex items-stretch gap-2">
                    <textarea
                        ref="addTaskInput"
                        v-model="form.title"
                        class="home-input min-h-[68px] flex-1 resize-none rounded-[1.5rem] border-transparent px-4 py-5 text-[17px] leading-snug sm:min-h-[52px] sm:py-3 sm:text-base"
                        placeholder="Добавить задачу..."
                        autocomplete="off"
                        rows="1"
                    />

                    <button
                        type="submit"
                        class="flex min-h-[68px] w-[58px] shrink-0 items-center justify-center rounded-[1.5rem] bg-[var(--home-primary-muted)] text-2xl font-medium leading-none text-[var(--home-text-heading-soft)] ring-1 ring-[var(--home-border)] transition active:scale-[0.96] disabled:opacity-50 sm:min-h-[52px] sm:w-[52px]"
                        :disabled="form.processing || !form.title.trim()"
                        aria-label="Добавить задачу"
                    >
                        +
                    </button>
                </div>

                <div
                    v-if="form.errors.title"
                    class="px-2 pt-2 text-sm text-red-500"
                >
                    {{ form.errors.title }}
                </div>
            </form>

            <div
                v-if="doneTasks.length > 0"
                class="mb-5 hidden sm:block"
            >
                <button
                    type="button"
                    class="home-secondary-button w-full rounded-[1.75rem] px-5 py-4 text-base font-semibold active:scale-[0.99]"
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

                    <div class="home-muted mt-2 text-sm">
                        Добавьте первый пункт в этот список.
                    </div>
                </div>

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
                            class="home-card rounded-[1.75rem] p-3 transition active:scale-[0.99] sm:p-4"
                        >
                            <div class="flex min-h-[48px] items-center gap-3">
                                <button
                                    type="button"
                                    class="task-drag-handle flex h-10 w-7 shrink-0 items-center justify-center rounded-full text-xl text-[var(--home-text-subtle)] active:cursor-grabbing"
                                    aria-label="Перетащить задачу"
                                >
                                    ⋮⋮
                                </button>

                                <button
                                    type="button"
                                    class="home-check-button flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
                                    aria-label="Отметить выполненной"
                                    @click="toggleTask(task)"
                                />

                                <div
                                    class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                                    :style="{ backgroundColor: task.creator?.avatar_color || 'var(--home-avatar-fallback)' }"
                                    :title="task.creator?.name"
                                >
                                    {{ userInitials(task.creator?.name) }}
                                </div>

                                <textarea
                                    v-if="editingTaskId === task.id"
                                    ref="editingInput"
                                    v-model="editingTitle"
                                    class="home-input min-h-[64px] min-w-0 flex-1 resize-none rounded-2xl px-3 py-2 text-base font-semibold leading-snug sm:min-h-[44px] sm:text-lg"
                                    rows="2"
                                    @keydown.ctrl.enter.prevent="saveEditTask(task)"
                                    @keydown.meta.enter.prevent="saveEditTask(task)"
                                    @keydown.esc.prevent="cancelEditTask"
                                    @blur="saveEditTask(task)"
                                />

                                <button
                                    v-else
                                    type="button"
                                    class="home-title min-w-0 flex-1 text-left text-base font-semibold leading-snug line-clamp-2 sm:text-lg"
                                    @click="startEditTask(task)"
                                >
                                    {{ task.title }}
                                </button>

                                <button
                                    type="button"
                                    class="home-delete-button flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xl"
                                    @click="deleteTask(task)"
                                    aria-label="Удалить задачу"
                                >
                                    ×
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
                <div class="home-subtle mb-3 px-2 text-xs font-bold uppercase tracking-wide">
                    Выполнено
                </div>

                <TransitionGroup
                    name="task-list"
                    tag="div"
                    class="space-y-3"
                >
                    <div
                        v-for="task in doneTasks"
                        :key="task.id"
                        class="home-soft-card rounded-[1.75rem] p-3 opacity-80 transition active:scale-[0.99] sm:p-4"
                    >
                        <div class="flex items-center gap-3">
                            <button
                                type="button"
                                class="home-done-check-button flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold"
                                aria-label="Вернуть в активные"
                                @click="toggleTask(task)"
                            >
                                ✓
                            </button>

                            <div
                                class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white opacity-70"
                                :style="{ backgroundColor: task.creator?.avatar_color || 'var(--home-avatar-fallback)' }"
                                :title="task.creator?.name"
                            >
                                {{ userInitials(task.creator?.name) }}
                            </div>

                            <textarea
                                v-if="editingTaskId === task.id"
                                ref="editingInput"
                                v-model="editingTitle"
                                class="home-input min-h-[64px] min-w-0 flex-1 resize-none rounded-2xl px-3 py-2 text-base font-semibold leading-snug sm:min-h-[44px] sm:text-lg"
                                rows="2"
                                @keydown.ctrl.enter.prevent="saveEditTask(task)"
                                @keydown.meta.enter.prevent="saveEditTask(task)"
                                @keydown.esc.prevent="cancelEditTask"
                                @blur="saveEditTask(task)"
                            />

                            <button
                                v-else
                                type="button"
                                class="home-muted min-w-0 flex-1 text-left text-base font-medium leading-snug line-clamp-2 line-through decoration-[var(--home-focus)] sm:text-lg"
                                @click="startEditTask(task)"
                            >
                                {{ task.title }}
                            </button>

                            <button
                                type="button"
                                class="home-delete-button flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xl"
                                @click="deleteTask(task)"
                                aria-label="Удалить задачу"
                            >
                                ×
                            </button>
                        </div>
                    </div>
                </TransitionGroup>
            </section>
        </div>

        <nav class="home-bottom-nav fixed inset-x-0 bottom-0 z-30 px-3 pb-[max(env(safe-area-inset-bottom),12px)] pt-3 sm:hidden">
            <div class="mx-auto grid max-w-xl grid-cols-3 gap-2">
                <button
                    type="button"
                    class="home-primary-button flex min-h-[54px] flex-col items-center justify-center rounded-2xl px-2 text-sm font-semibold"
                    @click="handleBottomAddClick"
                >
                    <span class="text-lg leading-none">+</span>
                    <span class="mt-1">Добавить</span>
                </button>

                <button
                    type="button"
                    class="home-secondary-button flex min-h-[54px] flex-col items-center justify-center rounded-2xl px-2 text-sm font-semibold"
                    :disabled="doneTasks.length === 0"
                    @click="repeatDoneTasks"
                >
                    <span class="text-lg leading-none">↺</span>
                    <span class="mt-1">Повторить</span>
                </button>

                <button
                    type="button"
                    class="home-secondary-button flex min-h-[54px] flex-col items-center justify-center rounded-2xl px-2 text-sm font-semibold"
                    @click="openListSettings"
                >
                    <span class="text-lg leading-none">⋯</span>
                    <span class="mt-1">Настройки</span>
                </button>
            </div>
        </nav>

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
</style>
