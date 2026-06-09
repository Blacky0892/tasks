<script setup>
import { Head, Link, router, useForm, usePage } from '@inertiajs/vue3'
import { computed, ref, watch } from 'vue'
import draggable from 'vuedraggable'

const props = defineProps({
    lists: {
        type: Array,
        default: () => [],
    },
})

const page = usePage()
const user = computed(() => page.props.auth?.user ?? null)

const localLists = ref([...props.lists])

watch(
    () => props.lists,
    value => {
        localLists.value = [...value]
    },
)

const activeTasksCount = computed(() => {
    return localLists.value.reduce((total, list) => total + Number(list.active_tasks_count || 0), 0)
})

const doneTasksCount = computed(() => {
    return localLists.value.reduce((total, list) => total + Number(list.done_tasks_count || 0), 0)
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

function saveListsOrder() {
    router.patch(route('lists.reorder'), {
        ids: localLists.value.map(list => list.id),
    }, {
        preserveScroll: true,
        preserveState: true,
    })
}
</script>

<template>
    <Head title="Наш дом" />

    <main class="home-page">
        <div class="home-container pb-24">
            <header class="mb-6">
                <div class="home-hero-card rounded-[2rem] p-5">
                    <div class="flex items-start justify-between gap-4">
                        <div>
                            <div class="home-heading-soft text-sm font-semibold">
                                {{ user?.name ?? 'Привет' }}, добро пожаловать
                            </div>

                            <h1 class="home-title mt-2 text-3xl font-bold tracking-tight">
                                Наш дом
                            </h1>

                            <div class="home-heading-soft mt-2 max-w-xs text-sm leading-relaxed">
                                Общие списки, покупки и домашние дела в одном месте.
                            </div>
                        </div>

                        <div class="flex h-14 w-14 shrink-0 items-center justify-center rounded-3xl bg-white/60 text-3xl shadow-sm">
                            🏡
                        </div>
                    </div>

                    <div class="mt-5 grid grid-cols-3 gap-2">
                        <div class="rounded-2xl bg-white/45 px-3 py-3 ring-1 ring-white/50">
                            <div class="home-title text-xl font-bold">
                                {{ localLists.length }}
                            </div>
                            <div class="home-soft-text mt-1 text-xs font-medium">
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

            <section>
                <draggable
                    v-model="localLists"
                    item-key="id"
                    handle=".list-drag-handle"
                    tag="div"
                    class="space-y-3"
                    ghost-class="opacity-40"
                    chosen-class="scale-[0.99]"
                    animation="180"
                    @end="saveListsOrder"
                >
                    <template #item="{ element: list }">
                        <div class="home-card relative rounded-[2rem] p-4 transition hover:border-[var(--home-border-strong)] active:scale-[0.99] sm:p-5">
                            <div class="flex items-stretch">
                                <button
                                    type="button"
                                    class="list-drag-handle flex w-11 shrink-0 items-center justify-center rounded-l-[2rem] text-xl text-[#A4B197] active:cursor-grabbing"
                                    aria-label="Перетащить список"
                                >
                                    ⋮⋮
                                </button>

                                <Link
                                    :href="route('lists.show', list.id)"
                                    class="block min-w-0 flex-1 p-4 transition active:scale-[0.99] sm:p-5"
                                >
                                    <div class="flex items-center justify-between gap-3">
                                        <div class="min-w-0">
                                            <div class="flex items-center gap-3">
                                                <div class="home-emoji-tile flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-2xl">
                                                    {{ list.emoji }}
                                                </div>

                                                <div class="home-title truncate text-lg font-bold">
                                                    {{ list.title }}
                                                </div>
                                            </div>

                                            <div class="home-muted mt-2 text-sm font-medium">
                                                {{ list.active_tasks_count }} активных ·
                                                {{ list.done_tasks_count }} выполнено
                                            </div>
                                        </div>

                                        <div class="home-badge flex h-10 min-w-10 shrink-0 items-center justify-center rounded-full px-3 text-sm font-bold">
                                            {{ list.active_tasks_count }}
                                        </div>
                                    </div>
                                </Link>
                            </div>
                        </div>
                    </template>
                </draggable>

                <div
                    v-if="localLists.length === 0 && !showCreateForm"
                    class="mt-3 home-card rounded-[2rem] p-5"
                >
                    <div class="home-title text-lg font-semibold">
                        Пока списков нет
                    </div>

                    <div class="home-muted mt-2 text-sm">
                        Создайте первый список, например «Покупки» или «Дом».
                    </div>
                </div>
            </section>

            <section class="sticky bottom-3 z-10 mt-5">
                <form
                    v-if="showCreateForm"
                    class="home-card rounded-[2rem] p-5 shadow-lg"
                    @submit.prevent="createList"
                >
                    <div class="flex gap-3">
                        <input
                            v-model="form.emoji"
                            class="home-input h-12 w-16 rounded-2xl text-center text-2xl"
                            maxlength="4"
                        >

                        <input
                            v-model="form.title"
                            class="home-input h-12 min-w-0 flex-1 rounded-2xl px-4"
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
                            class="home-primary-button flex-1 rounded-2xl px-4 py-3 font-semibold"
                            :disabled="form.processing"
                        >
                            Создать
                        </button>

                        <button
                            type="button"
                            class="home-soft-button rounded-2xl px-4 py-3 font-medium"
                            @click="showCreateForm = false"
                        >
                            Отмена
                        </button>
                    </div>
                </form>

                <button
                    v-else
                    type="button"
                    class="home-primary-button w-full rounded-[2rem] px-5 py-4 font-semibold active:scale-[0.99]"
                    @click="showCreateForm = true"
                >
                    + Новый список
                </button>
            </section>
        </div>
    </main>
</template>
