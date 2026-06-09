<script setup>
import { Head, Link, router, useForm } from '@inertiajs/vue3'
import { computed, nextTick, ref } from 'vue'

const props = defineProps({
    list: {
        type: Object,
        required: true,
    },
})

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

const visibleTasks = computed(() => {
    return props.list.tasks.filter(task => !pendingDeleteIds.value.includes(task.id))
})

const activeTasks = computed(() => {
    return visibleTasks.value.filter(task => !task.is_done)
})

const doneTasks = computed(() => {
    return visibleTasks.value.filter(task => task.is_done)
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
</script>

<template>
    <Head :title="list.title" />

    <main class="min-h-screen bg-[#F8FAF3] px-3 py-4 text-[#283326] sm:px-4 sm:py-6">
        <div class="mx-auto max-w-xl pb-32">
            <header class="mb-5">
                <Link
                    :href="route('home')"
                    class="text-sm font-semibold text-[#65755B] transition hover:text-[#465740]"
                >
                    ← Все списки
                </Link>

                <div class="mt-4 flex items-center gap-3">
                    <div class="flex h-14 w-14 shrink-0 items-center justify-center rounded-3xl bg-white text-3xl shadow-sm ring-1 ring-[#D9E2D0]">
                        {{ list.emoji }}
                    </div>

                    <div class="min-w-0 flex-1">
                        <h1 class="truncate text-2xl font-bold text-[#283326] sm:text-3xl">
                            {{ list.title }}
                        </h1>

                        <div class="mt-1 text-sm font-medium text-[#738267]">
                            {{ activeTasks.length }} активных · {{ doneTasks.length }} выполнено
                        </div>
                    </div>

                    <button
                        type="button"
                        class="hidden h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white text-xl text-[#65755B] shadow-sm ring-1 ring-[#D9E2D0] transition hover:bg-[#F0F6E9] sm:flex"
                        @click="showListSettings = !showListSettings"
                    >
                        ⋯
                    </button>
                </div>
            </header>

            <section
                v-if="showListSettings"
                id="list-settings"
                class="mb-5 rounded-[2rem] bg-white p-5 shadow-sm ring-1 ring-[#D9E2D0]"
            >
                <form @submit.prevent="updateList">
                    <div class="flex gap-3">
                        <input
                            v-model="listForm.emoji"
                            class="h-12 w-16 rounded-2xl border border-[#D2DEC7] bg-[#F0F6E9] text-center text-2xl outline-none transition focus:border-[#AFC39E] focus:bg-white"
                            maxlength="4"
                        >

                        <input
                            v-model="listForm.title"
                            class="h-12 min-w-0 flex-1 rounded-2xl border border-[#D2DEC7] bg-[#F0F6E9] px-4 text-[#283326] outline-none transition placeholder:text-[#8B9982] focus:border-[#AFC39E] focus:bg-white"
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
                            class="flex-1 rounded-2xl bg-[#CFE0BB] px-4 py-3 font-semibold text-[#283326] shadow-lg shadow-[#DDEBCB]/60 transition active:scale-[0.98] disabled:opacity-50"
                            :disabled="listForm.processing"
                        >
                            Сохранить
                        </button>

                        <button
                            type="button"
                            class="rounded-2xl bg-[#F0F6E9] px-4 py-3 font-medium text-[#65755B] transition active:scale-[0.98]"
                            @click="showListSettings = false"
                        >
                            Отмена
                        </button>
                    </div>

                    <button
                        type="button"
                        class="mt-4 w-full rounded-2xl bg-red-50 px-4 py-3 font-medium text-red-600 transition active:scale-[0.98]"
                        @click="archiveList"
                    >
                        Архивировать список
                    </button>
                </form>
            </section>

            <form
                class="sticky top-2 z-10 mb-5 rounded-[2rem] bg-white/95 p-2 shadow-sm ring-1 ring-[#D9E2D0] backdrop-blur"
                @submit.prevent="createTask"
            >
                <div class="flex items-stretch gap-2">
        <textarea
            ref="addTaskInput"
            v-model="form.title"
            class="min-h-[68px] flex-1 resize-none rounded-[1.5rem] border border-transparent bg-[#F0F6E9] px-4 py-5 text-[17px] leading-snug text-[#283326] outline-none transition placeholder:text-[#8B9982] focus:border-[#AFC39E] focus:bg-white sm:min-h-[52px] sm:py-3 sm:text-base"
            placeholder="Добавить задачу..."
            autocomplete="off"
            rows="1"
        />

                    <button
                        type="submit"
                        class="flex min-h-[68px] w-[58px] shrink-0 items-center justify-center rounded-[1.5rem] bg-[#E4EEDB] text-2xl font-medium leading-none text-[#65755B] ring-1 ring-[#D9E2D0] transition active:scale-[0.96] disabled:opacity-50 sm:min-h-[52px] sm:w-[52px]"
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
                    class="w-full rounded-[1.75rem] bg-white px-5 py-4 text-base font-semibold text-[#526743] shadow-sm ring-1 ring-[#D9E2D0] transition active:scale-[0.99]"
                    @click="repeatDoneTasks"
                >
                    ↺ Повторить выполненные
                </button>
            </div>

            <section class="space-y-3">
                <div
                    v-if="activeTasks.length === 0 && doneTasks.length === 0"
                    class="rounded-[2rem] bg-white p-5 shadow-sm ring-1 ring-[#D9E2D0]"
                >
                    <div class="text-lg font-semibold text-[#283326]">
                        Пока задач нет
                    </div>

                    <div class="mt-2 text-sm text-[#738267]">
                        Добавьте первый пункт в этот список.
                    </div>
                </div>

                <TransitionGroup
                    name="task-list"
                    tag="div"
                    class="space-y-3"
                >
                    <div
                        v-for="task in activeTasks"
                        :key="task.id"
                        class="rounded-[1.75rem] bg-white p-3 shadow-sm ring-1 ring-[#D9E2D0] transition active:scale-[0.99] sm:p-4"
                    >
                        <div class="flex min-h-[48px] items-center gap-3">
                            <button
                                type="button"
                                class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 border-[#C6D5B8] bg-[#F0F6E9] transition hover:border-[#AFC39E] active:scale-90"
                                aria-label="Отметить выполненной"
                                @click="toggleTask(task)"
                            />

                            <div
                                class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                                :style="{ backgroundColor: task.creator?.avatar_color || '#6D8061' }"
                                :title="task.creator?.name"
                            >
                                {{ userInitials(task.creator?.name) }}
                            </div>

                            <textarea
                                v-if="editingTaskId === task.id"
                                ref="editingInput"
                                v-model="editingTitle"
                                class="min-h-[64px] min-w-0 flex-1 resize-none rounded-2xl border border-[#D2DEC7] bg-[#F0F6E9] px-3 py-2 text-base font-semibold leading-snug text-[#283326] outline-none transition focus:border-[#AFC39E] focus:bg-white sm:min-h-[44px] sm:text-lg"
                                rows="2"
                                @keydown.ctrl.enter.prevent="saveEditTask(task)"
                                @keydown.meta.enter.prevent="saveEditTask(task)"
                                @keydown.esc.prevent="cancelEditTask"
                                @blur="saveEditTask(task)"
                            />

                            <button
                                v-else
                                type="button"
                                class="min-w-0 flex-1 text-left text-base font-semibold leading-snug text-[#283326] line-clamp-2 sm:text-lg"
                                @click="startEditTask(task)"
                            >
                                {{ task.title }}
                            </button>

                            <button
                                type="button"
                                class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xl text-[#8B9982]/50 transition hover:bg-red-50 hover:text-red-400 active:scale-90 active:bg-red-100"
                                @click="deleteTask(task)"
                                aria-label="Удалить задачу"
                            >
                                ×
                            </button>
                        </div>
                    </div>
                </TransitionGroup>
            </section>

            <section
                v-if="doneTasks.length > 0"
                class="mt-8 pb-6"
            >
                <div class="mb-3 px-2 text-xs font-bold uppercase tracking-wide text-[#8B9982]">
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
                        class="rounded-[1.75rem] bg-[#F0F6E9]/70 p-3 text-[#738267] shadow-sm ring-1 ring-[#D9E2D0] transition active:scale-[0.99] sm:p-4"
                    >
                        <div class="flex items-center gap-3">
                            <button
                                type="button"
                                class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#CFE0BB] text-sm font-bold text-[#283326] shadow-sm shadow-[#DDEBCB]/60 transition active:scale-90"
                                aria-label="Вернуть в активные"
                                @click="toggleTask(task)"
                            >
                                ✓
                            </button>

                            <div
                                class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white opacity-70"
                                :style="{ backgroundColor: task.creator?.avatar_color || '#6D8061' }"
                                :title="task.creator?.name"
                            >
                                {{ userInitials(task.creator?.name) }}
                            </div>

                            <textarea
                                v-if="editingTaskId === task.id"
                                ref="editingInput"
                                v-model="editingTitle"
                                class="min-h-[64px] min-w-0 flex-1 resize-none rounded-2xl border border-[#D2DEC7] bg-white px-3 py-2 text-base font-semibold leading-snug text-[#283326] outline-none transition focus:border-[#AFC39E] sm:min-h-[44px] sm:text-lg"
                                rows="2"
                                @keydown.ctrl.enter.prevent="saveEditTask(task)"
                                @keydown.meta.enter.prevent="saveEditTask(task)"
                                @keydown.esc.prevent="cancelEditTask"
                                @blur="saveEditTask(task)"
                            />

                            <button
                                v-else
                                type="button"
                                class="min-w-0 flex-1 text-left text-base font-medium leading-snug text-[#738267] line-clamp-2 line-through decoration-[#AFC39E] sm:text-lg"
                                @click="startEditTask(task)"
                            >
                                {{ task.title }}
                            </button>

                            <button
                                type="button"
                                class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xl text-[#8B9982]/50 transition hover:bg-red-50 hover:text-red-400 active:scale-90 active:bg-red-100"
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

        <nav class="fixed inset-x-0 bottom-0 z-30 border-t border-[#D9E2D0]/80 bg-[#F8FAF3]/90 px-3 pb-[max(env(safe-area-inset-bottom),12px)] pt-3 backdrop-blur sm:hidden">
            <div class="mx-auto grid max-w-xl grid-cols-3 gap-2">
                <button
                    type="button"
                    class="flex min-h-[54px] flex-col items-center justify-center rounded-2xl bg-[#CFE0BB] px-2 text-sm font-semibold text-[#283326] shadow-lg shadow-[#DDEBCB]/70 ring-1 ring-[#B8C9A6]/40 transition active:scale-[0.98]"
                    @click="handleBottomAddClick"
                >
                    <span class="text-lg leading-none">+</span>
                    <span class="mt-1">Добавить</span>
                </button>

                <button
                    type="button"
                    class="flex min-h-[54px] flex-col items-center justify-center rounded-2xl bg-white px-2 text-sm font-semibold text-[#526743] shadow-sm ring-1 ring-[#D9E2D0] transition active:scale-[0.98] disabled:opacity-40"
                    :disabled="doneTasks.length === 0"
                    @click="repeatDoneTasks"
                >
                    <span class="text-lg leading-none">↺</span>
                    <span class="mt-1">Повторить</span>
                </button>

                <button
                    type="button"
                    class="flex min-h-[54px] flex-col items-center justify-center rounded-2xl bg-white px-2 text-sm font-semibold text-[#526743] shadow-sm ring-1 ring-[#D9E2D0] transition active:scale-[0.98]"
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
                <div class="mx-auto flex max-w-xl items-center justify-between gap-3 rounded-[1.5rem] bg-[#53634C] px-4 py-3 text-white shadow-xl shadow-[#DDEBCB]/70">
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
