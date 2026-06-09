<script setup>
import { Head, Link, useForm, usePage } from '@inertiajs/vue3'
import { computed, ref } from 'vue'

const props = defineProps({
    lists: {
        type: Array,
        default: () => [],
    },
})

const page = usePage()
const user = computed(() => page.props.auth?.user ?? null)

const activeTasksCount = computed(() => {
    return props.lists.reduce((total, list) => total + Number(list.active_tasks_count || 0), 0)
})

const doneTasksCount = computed(() => {
    return props.lists.reduce((total, list) => total + Number(list.done_tasks_count || 0), 0)
})

const showCreateForm = ref(false)

const form = useForm({
    title: '',
    emoji: '📝',
})

function createList() {
    form.post(route('lists.store'), {
        preserveScroll: true,
        onSuccess: () => {
            form.reset()
            form.emoji = '📝'
            showCreateForm.value = false
        },
    })
}
</script>

<template>
    <Head title="Наш дом" />

    <main class="min-h-screen bg-[#F8FAF3] px-3 py-4 text-[#283326] sm:px-4 sm:py-6">
        <div class="mx-auto max-w-xl pb-24">
            <header class="mb-6">
                <div class="rounded-[2rem] bg-gradient-to-br from-[#EEF6E5] to-[#DDEBCB] p-5 shadow-lg shadow-[#DDEBCB]/50 ring-1 ring-[#B8C9A6]/30">
                    <div class="flex items-start justify-between gap-4">
                        <div>
                            <div class="text-sm font-semibold text-[#65755B]">
                                {{ user?.name ?? 'Привет' }}, добро пожаловать
                            </div>

                            <h1 class="mt-2 text-3xl font-bold tracking-tight text-[#283326]">
                                Наш дом
                            </h1>

                            <div class="mt-2 max-w-xs text-sm leading-relaxed text-[#65755B]">
                                Общие списки, покупки и домашние дела в одном месте.
                            </div>
                        </div>

                        <div class="flex h-14 w-14 shrink-0 items-center justify-center rounded-3xl bg-white/60 text-3xl shadow-sm ring-1 ring-[#B8C9A6]/30">
                            🏡
                        </div>
                    </div>

                    <div class="mt-5 grid grid-cols-3 gap-2">
                        <div class="rounded-2xl bg-white/45 px-3 py-3 ring-1 ring-white/50">
                            <div class="text-xl font-bold text-[#283326]">
                                {{ lists.length }}
                            </div>
                            <div class="mt-1 text-xs font-medium text-[#6C7B62]">
                                списков
                            </div>
                        </div>

                        <div class="rounded-2xl bg-white/45 px-3 py-3 ring-1 ring-white/50">
                            <div class="text-xl font-bold text-[#283326]">
                                {{ activeTasksCount }}
                            </div>
                            <div class="mt-1 text-xs font-medium text-[#6C7B62]">
                                активных
                            </div>
                        </div>

                        <div class="rounded-2xl bg-white/45 px-3 py-3 ring-1 ring-white/50">
                            <div class="text-xl font-bold text-[#283326]">
                                {{ doneTasksCount }}
                            </div>
                            <div class="mt-1 text-xs font-medium text-[#6C7B62]">
                                готово
                            </div>
                        </div>
                    </div>
                </div>
            </header>

            <section class="space-y-3">
                <Link
                    v-for="list in lists"
                    :key="list.id"
                    :href="route('lists.show', list.id)"
                    class="block rounded-[2rem] bg-white p-4 shadow-sm ring-1 ring-[#D9E2D0] transition hover:ring-[#B8C9A6] active:scale-[0.99] sm:p-5"
                >
                    <div class="flex items-center justify-between gap-3">
                        <div class="min-w-0">
                            <div class="flex items-center gap-3">
                                <div class="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#F0F6E9] text-2xl ring-1 ring-[#D9E2D0]">
                                    {{ list.emoji }}
                                </div>

                                <div class="truncate text-lg font-bold text-[#283326]">
                                    {{ list.title }}
                                </div>
                            </div>

                            <div class="mt-2 text-sm font-medium text-[#738267]">
                                {{ list.active_tasks_count }} активных ·
                                {{ list.done_tasks_count }} выполнено
                            </div>
                        </div>

                        <div class="flex h-10 min-w-10 shrink-0 items-center justify-center rounded-full bg-[#E7F2D8] px-3 text-sm font-bold text-[#526743]">
                            {{ list.active_tasks_count }}
                        </div>
                    </div>
                </Link>

                <div
                    v-if="lists.length === 0 && !showCreateForm"
                    class="rounded-[2rem] bg-white p-5 shadow-sm ring-1 ring-[#D9E2D0]"
                >
                    <div class="text-lg font-semibold text-[#283326]">
                        Пока списков нет
                    </div>

                    <div class="mt-2 text-sm text-[#738267]">
                        Создайте первый список, например «Покупки» или «Дом».
                    </div>
                </div>
            </section>

            <section class="sticky bottom-3 z-10 mt-5">
                <form
                    v-if="showCreateForm"
                    class="rounded-[2rem] bg-white p-5 shadow-lg shadow-[#DDEBCB]/40 ring-1 ring-[#D9E2D0]"
                    @submit.prevent="createList"
                >
                    <div class="flex gap-3">
                        <input
                            v-model="form.emoji"
                            class="h-12 w-16 rounded-2xl border border-[#D2DEC7] bg-[#F0F6E9] text-center text-2xl outline-none transition focus:border-[#AFC39E] focus:bg-white"
                            maxlength="4"
                        >

                        <input
                            v-model="form.title"
                            class="h-12 min-w-0 flex-1 rounded-2xl border border-[#D2DEC7] bg-[#F0F6E9] px-4 text-[#283326] outline-none transition placeholder:text-[#8B9982] focus:border-[#AFC39E] focus:bg-white"
                            placeholder="Название списка"
                            autofocus
                        >
                    </div>

                    <div
                        v-if="form.errors.title"
                        class="mt-2 text-sm text-red-500"
                    >
                        {{ form.errors.title }}
                    </div>

                    <div class="mt-4 flex gap-2">
                        <button
                            type="submit"
                            class="flex-1 rounded-2xl bg-[#CFE0BB] px-4 py-3 font-semibold text-[#283326] shadow-lg shadow-[#DDEBCB]/60 transition active:scale-[0.98] disabled:opacity-50"
                            :disabled="form.processing"
                        >
                            Создать
                        </button>

                        <button
                            type="button"
                            class="rounded-2xl bg-[#F0F6E9] px-4 py-3 font-medium text-[#65755B] transition active:scale-[0.98]"
                            @click="showCreateForm = false"
                        >
                            Отмена
                        </button>
                    </div>
                </form>

                <button
                    v-else
                    type="button"
                    class="w-full rounded-[2rem] bg-[#CFE0BB] px-5 py-4 font-semibold text-[#283326] shadow-lg shadow-[#DDEBCB]/70 ring-1 ring-[#B8C9A6]/40 transition active:scale-[0.99]"
                    @click="showCreateForm = true"
                >
                    + Новый список
                </button>
            </section>
        </div>
    </main>
</template>
