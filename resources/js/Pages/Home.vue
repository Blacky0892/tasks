<script setup>
import { Head, Link, router, useForm, usePage } from '@inertiajs/vue3'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import draggable from 'vuedraggable'
import NetworkStatus from '@/Components/NetworkStatus.vue'
import { useNetworkStatus } from '@/Composables/useNetworkStatus'

const props = defineProps({
    lists: {
        type: Array,
        default: () => [],
    },
})

const page = usePage()
const user = computed(() => page.props.auth?.user ?? null)

const { isOnline } = useNetworkStatus()

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

const totalTasksCount = computed(() => activeTasksCount.value + doneTasksCount.value)

const totalProgressPercent = computed(() => {
    if (totalTasksCount.value === 0) {
        return 0
    }

    return Math.round((doneTasksCount.value / totalTasksCount.value) * 100)
})

const homeSubtitle = computed(() => {
    if (activeTasksCount.value === 0 && doneTasksCount.value > 0) {
        return 'Сегодня всё закрыто. Можно выдохнуть.'
    }

    if (activeTasksCount.value > 0) {
        return 'Самое важное под рукой — покупки, дела и идеи.'
    }

    return 'Создайте первый список и начните вести дом без лишнего шума.'
})

const showCreateForm = ref(false)
const updateAvailable = ref(false)
const canInstallApp = ref(false)
const installPrompt = ref(null)
const isStandaloneApp = ref(false)

function detectStandaloneApp() {
    return window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true
}

function handlePwaUpdateAvailable() {
    updateAvailable.value = true
}

function handleInstallAvailable(event) {
    if (detectStandaloneApp()) {
        return
    }

    installPrompt.value = event.detail?.prompt ?? window.__pwaInstallPrompt ?? null
    canInstallApp.value = Boolean(installPrompt.value)
}

function handleAppInstalled() {
    installPrompt.value = null
    canInstallApp.value = false
    isStandaloneApp.value = true
}

async function installApp() {
    const prompt = installPrompt.value ?? window.__pwaInstallPrompt

    if (!prompt) {
        return
    }

    prompt.prompt()

    const choice = await prompt.userChoice

    if (choice.outcome === 'accepted') {
        handleAppInstalled()
    }
}

function reloadApp() {
    if (window.__pwaWaitingWorker) {
        window.__pwaWaitingWorker.postMessage({ type: 'SKIP_WAITING' })
        return
    }

    window.location.reload()
}

onMounted(() => {
    isStandaloneApp.value = detectStandaloneApp()

    if (window.__pwaInstallPrompt && !isStandaloneApp.value) {
        installPrompt.value = window.__pwaInstallPrompt
        canInstallApp.value = true
    }

    window.addEventListener('pwa-update-available', handlePwaUpdateAvailable)
    window.addEventListener('pwa-install-available', handleInstallAvailable)
    window.addEventListener('pwa-app-installed', handleAppInstalled)
})

onUnmounted(() => {
    window.removeEventListener('pwa-update-available', handlePwaUpdateAvailable)
    window.removeEventListener('pwa-install-available', handleInstallAvailable)
    window.removeEventListener('pwa-app-installed', handleAppInstalled)
})

const form = useForm({
    title: '',
    emoji: '📝',
})

function listTasksTotal(list) {
    return Number(list.active_tasks_count || 0) + Number(list.done_tasks_count || 0)
}

function listProgressPercent(list) {
    const total = listTasksTotal(list)

    if (total === 0) {
        return 0
    }

    return Math.round((Number(list.done_tasks_count || 0) / total) * 100)
}

function progressLabel(list) {
    const total = listTasksTotal(list)

    if (total === 0) {
        return 'пусто'
    }

    if (Number(list.active_tasks_count || 0) === 0) {
        return 'готово'
    }

    return `${listProgressPercent(list)}%`
}

function listStatusClass(list) {
    const total = listTasksTotal(list)

    if (total === 0) {
        return 'home-list-card-status-empty'
    }

    if (Number(list.active_tasks_count || 0) === 0) {
        return 'home-list-card-status-done'
    }

    return 'home-list-card-status-active'
}

function listStatusText(list) {
    const total = listTasksTotal(list)

    if (total === 0) {
        return 'Пусто'
    }

    if (Number(list.active_tasks_count || 0) === 0) {
        return 'Готово'
    }

    return Number(list.active_tasks_count || 0)
}

function createList() {
    if (!isOnline.value) {
        return
    }

    form.post(route('lists.store'), {
        preserveScroll: true,
        onSuccess: () => {
            form.reset()
            form.emoji = '📝'
            showCreateForm.value = false
        },
    })
}

function createTemplateList(title, emoji) {
    if (form.processing || !isOnline.value) {
        return
    }

    form.title = title
    form.emoji = emoji
    createList()
}

function saveListsOrder() {
    if (!isOnline.value) {
        localLists.value = [...props.lists]
        return
    }

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

    <NetworkStatus />

    <main class="home-page home-mobile-page">
        <div class="home-container pb-28 sm:pb-24">
            <header class="mb-5 sm:mb-6">
                <div class="home-hero-card-compact home-hero-mobile relative overflow-hidden rounded-[2rem] p-4 sm:p-5">
                    <div class="home-hero-orb" />

                    <div class="relative flex items-start justify-between gap-4">
                        <div class="min-w-0 flex-1">
                            <div class="home-heading-soft text-sm font-semibold">
                                {{ user?.name ?? 'Привет' }}, добро пожаловать
                            </div>

                            <h1 class="home-title mt-1.5 text-[30px] font-bold leading-none tracking-tight sm:text-4xl">
                                Наш дом
                            </h1>

                            <div class="home-heading-soft mt-3 max-w-sm text-[15px] leading-relaxed">
                                {{ homeSubtitle }}
                            </div>
                        </div>

                        <div class="home-hero-icon flex h-14 w-14 shrink-0 items-center justify-center rounded-[1.45rem] text-3xl sm:h-16 sm:w-16 sm:text-4xl">
                            🏡
                        </div>
                    </div>

                    <div class="relative mt-5 rounded-[1.55rem] bg-white/45 p-3 ring-1 ring-white/55">
                        <div class="flex items-center justify-between gap-3">
                            <div>
                                <div class="home-title text-sm font-bold">
                                    Общий прогресс
                                </div>
                                <div class="home-soft-text mt-1 text-xs font-semibold">
                                    {{ activeTasksCount }} активных · {{ doneTasksCount }} выполнено
                                </div>
                            </div>

                            <div class="home-progress-percent-pill rounded-full px-3 py-1 text-sm font-bold">
                                {{ totalProgressPercent }}%
                            </div>
                        </div>

                        <div class="home-progress-track mt-3 h-2.5 overflow-hidden rounded-full">
                            <div
                                class="home-progress-bar h-full rounded-full transition-all duration-500"
                                :style="{ width: `${totalProgressPercent}%` }"
                            />
                        </div>
                    </div>

                    <div class="relative mt-3 hidden grid-cols-3 gap-2 sm:grid">
                        <div class="home-stat-tile rounded-2xl px-3 py-3">
                            <div class="home-title text-xl font-bold">
                                {{ localLists.length }}
                            </div>
                            <div class="home-soft-text mt-1 text-xs font-medium">
                                списков
                            </div>
                        </div>

                        <div class="home-stat-tile rounded-2xl px-3 py-3">
                            <div class="home-title text-xl font-bold">
                                {{ activeTasksCount }}
                            </div>
                            <div class="home-soft-text mt-1 text-xs font-medium">
                                активных
                            </div>
                        </div>

                        <div class="home-stat-tile rounded-2xl px-3 py-3">
                            <div class="home-title text-xl font-bold">
                                {{ doneTasksCount }}
                            </div>
                            <div class="home-soft-text mt-1 text-xs font-medium">
                                готово
                            </div>
                        </div>
                    </div>
                </div>
            </header>

            <Transition
                enter-active-class="transition duration-200 ease-out"
                enter-from-class="-translate-y-2 opacity-0"
                enter-to-class="translate-y-0 opacity-100"
                leave-active-class="transition duration-150 ease-in"
                leave-from-class="translate-y-0 opacity-100"
                leave-to-class="-translate-y-2 opacity-0"
            >
                <section
                    v-if="canInstallApp && !isStandaloneApp"
                    class="home-install-card mb-4 rounded-[1.75rem] p-4"
                >
                    <div class="flex items-center gap-3">
                        <div class="home-install-icon flex h-12 w-12 shrink-0 items-center justify-center rounded-[1.2rem] text-2xl">
                            📲
                        </div>

                        <div class="min-w-0 flex-1">
                            <div class="home-title text-sm font-bold">
                                Добавить на экран
                            </div>
                            <div class="home-muted mt-1 text-xs leading-relaxed">
                                «Наш дом» откроется как обычное приложение.
                            </div>
                        </div>

                        <button
                            type="button"
                            class="home-primary-button min-h-11 shrink-0 rounded-2xl px-4 text-sm font-bold"
                            @click="installApp"
                        >
                            Установить
                        </button>
                    </div>
                </section>
            </Transition>

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
                        <div class="home-card home-tap-card relative overflow-hidden rounded-[2rem] p-2 transition active:scale-[0.99] sm:p-3">
                            <div class="flex items-stretch">
                                <button
                                    type="button"
                                    class="list-drag-handle home-drag-handle-mobile flex w-8 shrink-0 items-center justify-center rounded-l-[2rem] text-lg active:cursor-grabbing sm:w-10 sm:text-xl"
                                    aria-label="Перетащить список"
                                >
                                    ⋮⋮
                                </button>

                                <Link
                                    :href="route('lists.show', list.id)"
                                    class="block min-w-0 flex-1 rounded-[1.65rem] p-3 transition active:scale-[0.99] sm:p-4"
                                >
                                    <div class="flex items-start justify-between gap-3">
                                        <div class="min-w-0 flex-1">
                                            <div class="flex items-center gap-3">
                                                <div class="home-emoji-tile flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-[1.35rem] text-[28px] sm:h-12 sm:w-12 sm:text-2xl">
                                                    {{ list.emoji }}
                                                </div>

                                                <div class="min-w-0">
                                                    <div class="home-title truncate text-[19px] font-bold leading-tight sm:text-lg">
                                                        {{ list.title }}
                                                    </div>

                                                    <div class="home-muted mt-1 text-[14px] font-medium leading-tight">
                                                        {{ list.active_tasks_count }} активных ·
                                                        {{ list.done_tasks_count }} выполнено
                                                    </div>
                                                </div>
                                            </div>

                                            <div class="mt-4 flex items-center gap-3">
                                                <div class="home-progress-track h-2.5 flex-1 overflow-hidden rounded-full">
                                                    <div
                                                        class="home-progress-bar h-full rounded-full transition-all duration-500"
                                                        :style="{ width: `${listProgressPercent(list)}%` }"
                                                    />
                                                </div>

                                                <div class="home-subtle min-w-12 text-right text-xs font-bold">
                                                    {{ progressLabel(list) }}
                                                </div>
                                            </div>
                                        </div>

                                        <div
                                            class="home-list-card-status flex h-10 min-w-10 shrink-0 items-center justify-center rounded-full px-3 text-sm font-bold"
                                            :class="listStatusClass(list)"
                                        >
                                            {{ listStatusText(list) }}
                                        </div>
                                    </div>
                                </Link>
                            </div>
                        </div>
                    </template>
                </draggable>

                <div
                    v-if="localLists.length === 0 && !showCreateForm"
                    class="home-card rounded-[2rem] p-5"
                >
                    <div class="home-title text-lg font-semibold">
                        Пока списков нет
                    </div>

                    <div class="home-muted mt-2 text-sm leading-relaxed">
                        Создайте «Покупки», «Дом» или «Аптека» — так приложение сразу станет полезным.
                    </div>

                    <div class="mt-4 grid grid-cols-3 gap-2">
                        <button
                            type="button"
                            class="home-template-button min-h-12 rounded-2xl px-2 py-2 text-sm font-semibold"
                            :disabled="form.processing || !isOnline"
                            @click="createTemplateList('Покупки', '🛒')"
                        >
                            🛒<br>Покупки
                        </button>

                        <button
                            type="button"
                            class="home-template-button min-h-12 rounded-2xl px-2 py-2 text-sm font-semibold"
                            :disabled="form.processing || !isOnline"
                            @click="createTemplateList('Дом', '🏡')"
                        >
                            🏡<br>Дом
                        </button>

                        <button
                            type="button"
                            class="home-template-button min-h-12 rounded-2xl px-2 py-2 text-sm font-semibold"
                            :disabled="form.processing || !isOnline"
                            @click="createTemplateList('Аптека', '💊')"
                        >
                            💊<br>Аптека
                        </button>
                    </div>
                </div>
            </section>

            <section class="home-create-dock sticky z-20 mt-5">
                <form
                    v-if="showCreateForm"
                    class="home-card rounded-[2rem] p-4 shadow-lg sm:p-5"
                    @submit.prevent="createList"
                >
                    <div class="flex gap-3">
                        <input
                            v-model="form.emoji"
                            class="home-input h-[52px] w-16 rounded-2xl text-center text-2xl"
                            maxlength="4"
                        >

                        <input
                            v-model="form.title"
                            class="home-input h-[52px] min-w-0 flex-1 rounded-2xl px-4 text-[17px]"
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
                            class="home-primary-button min-h-12 flex-1 rounded-2xl px-4 py-3 font-semibold"
                            :disabled="form.processing"
                        >
                            {{ form.processing ? 'Создаю…' : 'Создать' }}
                        </button>

                        <button
                            type="button"
                            class="home-soft-button min-h-12 rounded-2xl px-4 py-3 font-medium"
                            :disabled="form.processing"
                            @click="showCreateForm = false"
                        >
                            Отмена
                        </button>
                    </div>
                </form>

                <button
                    v-else
                    type="button"
                    class="home-primary-button min-h-14 w-full rounded-[2rem] px-5 py-4 text-[17px] font-semibold active:scale-[0.99]"
                    @click="showCreateForm = true"
                >
                    + Новый список
                </button>
            </section>
        </div>
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
