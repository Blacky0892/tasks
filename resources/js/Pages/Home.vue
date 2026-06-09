<script setup>
import { Head, Link, useForm, usePage } from '@inertiajs/vue3'
import { computed, ref } from 'vue'

defineProps({
    lists: {
        type: Array,
        default: () => [],
    },
})

const page = usePage()
const user = computed(() => page.props.auth.user)

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
    <Head title="Дома" />

    <main class="min-h-screen bg-stone-100 px-4 py-6 text-stone-900">
        <div class="mx-auto max-w-xl">
            <header class="mb-8">
                <div class="text-sm text-stone-500">
                    Добро пожаловать
                </div>

                <h1 class="mt-1 text-3xl font-bold">
                    Дома
                </h1>

                <div class="mt-2 text-stone-600">
                    {{ user.name }}, здесь ваши списки.
                </div>
            </header>

            <section class="space-y-3">
                <Link
                    v-for="list in lists"
                    :key="list.id"
                    :href="route('lists.show', list.id)"
                    class="block rounded-3xl bg-white p-5 shadow-sm ring-1 ring-black/5 transition active:scale-[0.99]"
                >
                    <div class="flex items-center justify-between gap-4">
                        <div class="min-w-0">
                            <div class="flex items-center gap-3">
                                <div class="text-2xl">
                                    {{ list.emoji }}
                                </div>

                                <div class="truncate text-lg font-semibold">
                                    {{ list.title }}
                                </div>
                            </div>

                            <div class="mt-2 text-sm text-stone-500">
                                {{ list.active_tasks_count }} активных ·
                                {{ list.done_tasks_count }} выполнено
                            </div>
                        </div>

                        <div class="rounded-full bg-stone-100 px-3 py-1 text-sm font-medium text-stone-600">
                            {{ list.active_tasks_count }}
                        </div>
                    </div>
                </Link>

                <div
                    v-if="lists.length === 0 && !showCreateForm"
                    class="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-black/5"
                >
                    <div class="text-lg font-semibold">
                        Пока списков нет
                    </div>

                    <div class="mt-2 text-sm text-stone-500">
                        Создайте первый список, например «Покупки» или «Дом».
                    </div>
                </div>
            </section>

            <section class="mt-5">
                <form
                    v-if="showCreateForm"
                    class="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-black/5"
                    @submit.prevent="createList"
                >
                    <div class="flex gap-3">
                        <input
                            v-model="form.emoji"
                            class="h-12 w-16 rounded-2xl border border-stone-200 bg-stone-50 text-center text-2xl outline-none focus:border-stone-400"
                            maxlength="4"
                        >

                        <input
                            v-model="form.title"
                            class="h-12 min-w-0 flex-1 rounded-2xl border border-stone-200 bg-stone-50 px-4 outline-none focus:border-stone-400"
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
                            class="flex-1 rounded-2xl bg-stone-900 px-4 py-3 font-medium text-white disabled:opacity-50"
                            :disabled="form.processing"
                        >
                            Создать
                        </button>

                        <button
                            type="button"
                            class="rounded-2xl bg-stone-100 px-4 py-3 font-medium text-stone-600"
                            @click="showCreateForm = false"
                        >
                            Отмена
                        </button>
                    </div>
                </form>

                <button
                    v-else
                    type="button"
                    class="w-full rounded-3xl bg-stone-900 px-5 py-4 font-semibold text-white shadow-sm"
                    @click="showCreateForm = true"
                >
                    + Новый список
                </button>
            </section>
        </div>
    </main>
</template>
