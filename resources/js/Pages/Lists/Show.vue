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
    return props.list.tasks.filter(task => !task.is_done)
})

const doneTasks = computed(() => {
    return props.list.tasks.filter(task => task.is_done)
})

function createTask() {
    form.post(route('tasks.store', props.list.id), {
        preserveScroll: true,
        onSuccess: () => {
            form.reset()
        },
    })
}

function toggleTask(task) {
    router.post(route('tasks.toggle', task.id), {}, {
        preserveScroll: true,
    })
}

function deleteTask(task) {
    router.delete(route('tasks.destroy', task.id), {
        preserveScroll: true,
    })
}

function userInitials(name) {
    return name
        ?.split(' ')
        .map(part => part[0])
        .join('')
        .slice(0, 2)
        .toUpperCase()
}
</script>

<template>
    <Head :title="list.title" />

    <main class="min-h-screen bg-stone-100 px-4 py-6 text-stone-900">
        <div class="mx-auto max-w-xl">
            <header class="mb-6">
                <Link
                    :href="route('home')"
                    class="text-sm font-medium text-stone-500"
                >
                    ← Все списки
                </Link>

                <div class="mt-5 flex items-center gap-3">
                    <div class="text-4xl">
                        {{ list.emoji }}
                    </div>

                    <div class="min-w-0 flex-1">
                        <h1 class="truncate text-3xl font-bold">
                            {{ list.title }}
                        </h1>

                        <div class="mt-1 text-sm text-stone-500">
                            {{ activeTasks.length }} активных · {{ doneTasks.length }} выполнено
                        </div>
                    </div>

                    <button
                        type="button"
                        class="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white text-xl text-stone-500 shadow-sm ring-1 ring-black/5"
                        @click="showListSettings = !showListSettings"
                    >
                        ⋯
                    </button>
                </div>
            </header>

            <section
                v-if="showListSettings"
                class="mb-5 rounded-3xl bg-white p-5 shadow-sm ring-1 ring-black/5"
            >
                <form @submit.prevent="updateList">
                    <div class="flex gap-3">
                        <input
                            v-model="listForm.emoji"
                            class="h-12 w-16 rounded-2xl border border-stone-200 bg-stone-50 text-center text-2xl outline-none focus:border-stone-400"
                            maxlength="4"
                        >

                        <input
                            v-model="listForm.title"
                            class="h-12 min-w-0 flex-1 rounded-2xl border border-stone-200 bg-stone-50 px-4 outline-none focus:border-stone-400"
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
                            class="flex-1 rounded-2xl bg-stone-900 px-4 py-3 font-medium text-white disabled:opacity-50"
                            :disabled="listForm.processing"
                        >
                            Сохранить
                        </button>

                        <button
                            type="button"
                            class="rounded-2xl bg-stone-100 px-4 py-3 font-medium text-stone-600"
                            @click="showListSettings = false"
                        >
                            Отмена
                        </button>
                    </div>

                    <button
                        type="button"
                        class="mt-4 w-full rounded-2xl bg-red-50 px-4 py-3 font-medium text-red-600"
                        @click="archiveList"
                    >
                        Архивировать список
                    </button>
                </form>
            </section>

            <form
                class="mb-5 rounded-3xl bg-white p-3 shadow-sm ring-1 ring-black/5"
                @submit.prevent="createTask"
            >
                <div class="flex gap-2">
                    <input
                        v-model="form.title"
                        class="h-12 min-w-0 flex-1 rounded-2xl border border-transparent bg-stone-50 px-4 outline-none focus:border-stone-300"
                        placeholder="Добавить задачу..."
                        autocomplete="off"
                    >

                    <button
                        type="submit"
                        class="h-12 rounded-2xl bg-stone-900 px-5 font-semibold text-white disabled:opacity-50"
                        :disabled="form.processing || !form.title.trim()"
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
                class="mb-5"
            >
                <button
                    type="button"
                    class="w-full rounded-3xl bg-white px-5 py-4 text-sm font-semibold text-stone-700 shadow-sm ring-1 ring-black/5 transition active:scale-[0.99]"
                    @click="repeatDoneTasks"
                >
                    ↺ Повторить выполненные
                </button>
            </div>

            <section class="space-y-3">
                <div
                    v-if="activeTasks.length === 0 && doneTasks.length === 0"
                    class="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-black/5"
                >
                    <div class="text-lg font-semibold">
                        Пока задач нет
                    </div>

                    <div class="mt-2 text-sm text-stone-500">
                        Добавьте первый пункт в этот список.
                    </div>
                </div>

                <div
                    v-for="task in activeTasks"
                    :key="task.id"
                    class="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-black/5"
                >
                    <div class="flex items-center gap-3">
                        <button
                            type="button"
                            class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 border-stone-300"
                            @click="toggleTask(task)"
                        />

                        <div
                            class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                            :style="{ backgroundColor: task.creator?.avatar_color || '#57534e' }"
                            :title="task.creator?.name"
                        >
                            {{ userInitials(task.creator?.name) }}
                        </div>

                        <input
                            v-if="editingTaskId === task.id"
                            ref="editingInput"
                            v-model="editingTitle"
                            class="min-w-0 flex-1 rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-lg font-medium outline-none focus:border-stone-400"
                            @keydown.enter.prevent="saveEditTask(task)"
                            @keydown.esc.prevent="cancelEditTask"
                            @blur="saveEditTask(task)"
                        >

                        <button
                            v-else
                            type="button"
                            class="min-w-0 flex-1 truncate text-left text-lg font-medium"
                            @click="startEditTask(task)"
                        >
                            {{ task.title }}
                        </button>

                        <button
                            type="button"
                            class="rounded-full px-2 text-stone-300"
                            @click="deleteTask(task)"
                        >
                            ×
                        </button>
                    </div>
                </div>
            </section>

            <section
                v-if="doneTasks.length > 0"
                class="mt-7"
            >
                <div class="mb-3 px-1 text-sm font-semibold uppercase tracking-wide text-stone-400">
                    Выполнено
                </div>

                <div class="space-y-3">
                    <div
                        v-for="task in doneTasks"
                        :key="task.id"
                        class="rounded-3xl bg-white/70 p-4 text-stone-500 shadow-sm ring-1 ring-black/5"
                    >
                        <div class="flex items-center gap-3">
                            <button
                                type="button"
                                class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-stone-900 text-sm text-white"
                                @click="toggleTask(task)"
                            >
                                ✓
                            </button>

                            <div
                                class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white opacity-70"
                                :style="{ backgroundColor: task.creator?.avatar_color || '#57534e' }"
                                :title="task.creator?.name"
                            >
                                {{ userInitials(task.creator?.name) }}
                            </div>

                            <input
                                v-if="editingTaskId === task.id"
                                ref="editingInput"
                                v-model="editingTitle"
                                class="min-w-0 flex-1 rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-lg font-medium text-stone-500 outline-none focus:border-stone-400"
                                @keydown.enter.prevent="saveEditTask(task)"
                                @keydown.esc.prevent="cancelEditTask"
                                @blur="saveEditTask(task)"
                            >

                            <button
                                v-else
                                type="button"
                                class="min-w-0 flex-1 truncate text-left text-lg font-medium line-through decoration-stone-400"
                                @click="startEditTask(task)"
                            >
                                {{ task.title }}
                            </button>

                            <button
                                type="button"
                                class="rounded-full px-2 text-stone-300"
                                @click="deleteTask(task)"
                            >
                                ×
                            </button>
                        </div>
                    </div>
                </div>
            </section>
        </div>
    </main>
</template>
