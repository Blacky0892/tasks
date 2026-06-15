<script setup>
import { Head, Link, router, useForm, usePage } from '@inertiajs/vue3'
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import draggable from 'vuedraggable'
import NetworkStatus from '@/Components/NetworkStatus.vue'
import MobileCommandBar from '@/Components/MobileCommandBar.vue'
import { useNetworkStatus } from '@/Composables/useNetworkStatus'
import { listIconOptions } from '@/Support/listIcons'

const props = defineProps({
    lists: {
        type: Array,
        default: () => [],
    },
})

const page = usePage()
// Возвращает текущего авторизованного пользователя из Inertia props.
const user = computed(() => page.props.auth?.user ?? null)

const { isOnline } = useNetworkStatus()

const localLists = ref([...props.lists])
const searchQuery = ref('')
const showSearch = ref(false)
const searchInput = ref(null)

// Следит за изменениями списков из props и синхронизирует локальную копию для drag-and-drop.
watch(
    () => props.lists,
    value => {
        localLists.value = [...value]
    },
)


// Считает общее количество активных задач во всех списках.
const activeTasksCount = computed(() => {
    return localLists.value.reduce((total, list) => total + Number(list.active_tasks_count || 0), 0)
})

// Считает общее количество выполненных задач во всех списках.
const doneTasksCount = computed(() => {
    return localLists.value.reduce((total, list) => total + Number(list.done_tasks_count || 0), 0)
})

// Возвращает общее количество задач: активные плюс выполненные.
const totalTasksCount = computed(() => activeTasksCount.value + doneTasksCount.value)

const normalizedSearchQuery = computed(() => searchQuery.value.trim().toLocaleLowerCase())
const isSearching = computed(() => normalizedSearchQuery.value.length > 0)
const searchResults = computed(() => {
    if (!isSearching.value) {
        return []
    }

    return localLists.value.flatMap(list => {
        return (list.tasks ?? [])
            .filter(task => (task.title ?? '').toLocaleLowerCase().includes(normalizedSearchQuery.value))
            .map(task => ({ task, list }))
    })
})

watch(isSearching, value => {
    if (value) {
        listReorderMode.value = false
    }
})

// Рассчитывает общий процент выполненных задач по всем спискам.
const totalProgressPercent = computed(() => {
    if (totalTasksCount.value === 0) {
        return 0
    }

    return Math.round((doneTasksCount.value / totalTasksCount.value) * 100)
})

// Подбирает текст подзаголовка главной страницы по текущему состоянию задач.
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
const isCreateIconPickerOpen = ref(false)
const listReorderMode = ref(false)
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
const canInstallApp = ref(false)
const installPrompt = ref(null)
const isStandaloneApp = ref(false)
const remoteListsVersion = ref(null)
const isCheckingRemoteListsChanges = ref(false)
let listsSyncTimer = null

// Проверяет, запущено ли приложение как установленное PWA, а не как обычная вкладка браузера.
function detectStandaloneApp() {
    return window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true
}

// Обрабатывает событие доступного обновления PWA и показывает кнопку перезагрузки приложения.
function handlePwaUpdateAvailable(event) {
    updateAvailable.value = true
    pwaUpdateState.value = event.detail?.state ?? 'ready'
}

// Синхронизирует более подробные состояния обновления service worker с toast в UI.
function handlePwaUpdateState(event) {
    updateAvailable.value = true
    pwaUpdateState.value = event.detail?.state ?? 'ready'
}

// Сохраняет браузерный prompt установки PWA, если приложение ещё не установлено.
function handleInstallAvailable(event) {
    if (detectStandaloneApp()) {
        return
    }

    installPrompt.value = event.detail?.prompt ?? window.__pwaInstallPrompt ?? null
    canInstallApp.value = Boolean(installPrompt.value)
}

// Сбрасывает состояние установки после успешной установки PWA.
function handleAppInstalled() {
    installPrompt.value = null
    canInstallApp.value = false
    isStandaloneApp.value = true
}

// Запускает системное окно установки PWA и обновляет состояние после выбора пользователя.
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

// Применяет ожидающее обновление service worker с промежуточными состояниями UI.
function reloadApp() {
    pwaUpdateState.value = 'updating'

    if (window.__applyPwaUpdate) {
        window.__applyPwaUpdate()
        return
    }

    window.location.reload()
}

// Перезагружает списки после возврата назад, если другая страница пометила главную как устаревшую.
function refreshAfterBackNavigation() {
    if (sessionStorage.getItem('home:needs-refresh') !== '1') {
        return
    }

    sessionStorage.removeItem('home:needs-refresh')

    router.reload({
        only: ['lists'],
        preserveScroll: true,
        preserveState: false,
    })
}

// Проверяет на сервере, изменилась ли версия списков, и обновляет данные без полной перезагрузки страницы.
async function checkRemoteListsChanges() {
    if (!isOnline.value) {
        return
    }

    if (isCheckingRemoteListsChanges.value) {
        return
    }

    if (form.processing) {
        return
    }

    if (showCreateForm.value || isCreateIconPickerOpen.value || listReorderMode.value || isSearching.value) {
        return
    }

    isCheckingRemoteListsChanges.value = true

    try {
        const response = await fetch(route('lists.sync-state'), {
            headers: {
                Accept: 'application/json',
                'X-Requested-With': 'XMLHttpRequest',
            },
        })

        if (!response.ok) {
            return
        }

        const data = await response.json()

        if (!remoteListsVersion.value) {
            remoteListsVersion.value = data.version
            return
        }

        if (remoteListsVersion.value === data.version) {
            return
        }

        remoteListsVersion.value = data.version

        router.reload({
            only: ['lists'],
            preserveScroll: true,
            preserveState: true,
        })
    } catch {
        // Ничего не показываем пользователю: временная ошибка сети для PWA не критична.
    } finally {
        isCheckingRemoteListsChanges.value = false
    }
}

// При возвращении вкладки в видимое состояние проверяет свежесть списков.
function handleVisibilityChange() {
    if (document.visibilityState === 'visible') {
        checkRemoteListsChanges()
    }
}

// После восстановления интернета сразу проверяет изменения списков на сервере.
function handleOnline() {
    checkRemoteListsChanges()
}

// Обрабатывает возврат на страницу из браузерного кеша или истории навигации.
function handlePageShow() {
    refreshAfterBackNavigation()
}

// Инициализирует PWA-состояние, синхронизацию списков и обработчики событий при открытии страницы.
onMounted(() => {
    isStandaloneApp.value = detectStandaloneApp()

    if (window.__pwaInstallPrompt && !isStandaloneApp.value) {
        installPrompt.value = window.__pwaInstallPrompt
        canInstallApp.value = true
    }

    refreshAfterBackNavigation()
    checkRemoteListsChanges()

    listsSyncTimer = window.setInterval(() => {
        if (document.visibilityState === 'visible') {
            checkRemoteListsChanges()
        }
    }, 5000)

    window.addEventListener('pageshow', handlePageShow)
    window.addEventListener('online', handleOnline)
    document.addEventListener('visibilitychange', handleVisibilityChange)

    window.addEventListener('pwa-update-available', handlePwaUpdateAvailable)
    window.addEventListener('pwa-update-state', handlePwaUpdateState)
    window.addEventListener('pwa-install-available', handleInstallAvailable)
    window.addEventListener('pwa-app-installed', handleAppInstalled)
})

// Очищает таймер синхронизации и снимает обработчики событий при уходе со страницы.
onUnmounted(() => {
    if (listsSyncTimer) {
        window.clearInterval(listsSyncTimer)
        listsSyncTimer = null
    }

    window.removeEventListener('pageshow', handlePageShow)
    window.removeEventListener('online', handleOnline)
    document.removeEventListener('visibilitychange', handleVisibilityChange)

    window.removeEventListener('pwa-update-available', handlePwaUpdateAvailable)
    window.removeEventListener('pwa-update-state', handlePwaUpdateState)
    window.removeEventListener('pwa-install-available', handleInstallAvailable)
    window.removeEventListener('pwa-app-installed', handleAppInstalled)
})

const form = useForm({
    title: '',
    emoji: '📝',
})

// Открывает или закрывает выбор иконки для нового списка.
function toggleCreateIconPicker() {
    isCreateIconPickerOpen.value = !isCreateIconPickerOpen.value
}

// Устанавливает выбранную иконку в форму создания списка и закрывает пикер.
function selectCreateIcon(icon) {
    form.emoji = icon
    isCreateIconPickerOpen.value = false
}

// Показывает форму создания нового списка и закрывает выбор иконки.
function openCreateForm() {
    showCreateForm.value = true
    isCreateIconPickerOpen.value = false
}

// Закрывает форму создания списка и возвращает её к начальному состоянию.
function closeCreateForm() {
    showCreateForm.value = false
    isCreateIconPickerOpen.value = false
    form.reset()
    form.emoji = '📝'
    form.clearErrors()
}

// Возвращает общее количество задач в конкретном списке.
function listTasksTotal(list) {
    return Number(list.active_tasks_count || 0) + Number(list.done_tasks_count || 0)
}

// Рассчитывает процент выполнения задач для конкретного списка.
function listProgressPercent(list) {
    const total = listTasksTotal(list)

    if (total === 0) {
        return 0
    }

    return Math.round((Number(list.done_tasks_count || 0) / total) * 100)
}

// Формирует короткую подпись прогресса списка для отображения в карточке.
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

// Возвращает CSS-класс статуса списка: пустой, завершённый или активный.
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

// Возвращает текст статуса списка: «Пусто», «Готово» или количество активных задач.
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

// Отправляет форму создания списка на сервер, если приложение онлайн.
function createList() {
    if (!isOnline.value) {
        return
    }

    form.post(route('lists.store'), {
        preserveScroll: true,
        onSuccess: () => {
            remoteListsVersion.value = null
            form.reset()
            form.emoji = '📝'
            showCreateForm.value = false
            isCreateIconPickerOpen.value = false
            checkRemoteListsChanges()
        },
    })
}

// Создаёт список из готового шаблона с переданным названием и иконкой.
function createTemplateList(title, emoji) {
    if (form.processing || !isOnline.value) {
        return
    }

    form.title = title
    form.emoji = emoji
    createList()
}

// Прокручивает главную к спискам: временное действие для кнопки поиска в мобильной панели.
function handleMobileSearch() {
    showSearch.value = true

    nextTick(() => {
        searchInput.value?.focus()
        document.querySelector('[data-home-search]')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
}

// Включает или выключает режим ручной сортировки списков.
function toggleListReorderMode() {
    if (isSearching.value) {
        listReorderMode.value = false
        return
    }

    if (!isOnline.value) {
        return
    }

    listReorderMode.value = !listReorderMode.value
}

// Принудительно выключает режим сортировки списков.
function disableListReorderMode() {
    listReorderMode.value = false
}

// Блокирует переход в список при клике, если сейчас включён режим сортировки.
function handleListClick(event) {
    if (isSearching.value) {
        return
    }

    if (!listReorderMode.value) {
        return
    }

    event.preventDefault()
}

// Сохраняет новый порядок списков на сервере или откатывает локальные изменения без интернета.
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
        onSuccess: () => {
            remoteListsVersion.value = null
            checkRemoteListsChanges()
        },
    })
}
</script>

<template>
    <Head title="Наш дом" />

    <NetworkStatus />

    <main class="home-page home-mobile-page">
        <div class="home-container pb-[calc(7.75rem+env(safe-area-inset-bottom))] sm:pb-24">
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

                        <button
                            type="button"
                            class="home-hero-icon flex h-14 w-14 shrink-0 items-center justify-center rounded-[1.45rem] text-3xl transition active:scale-95 disabled:opacity-50 sm:h-16 sm:w-16 sm:text-4xl"
                            :class="listReorderMode ? 'ring-4 ring-white/70' : ''"
                            :disabled="!isOnline || isSearching"
                            :aria-label="listReorderMode ? 'Выключить сортировку списков' : 'Включить сортировку списков'"
                            @click="toggleListReorderMode"
                        >
                            🏡
                        </button>
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

            <section data-home-lists>
                <div
                    v-if="showSearch"
                    class="home-soft-card mb-3 rounded-[1.75rem] p-3"
                    data-home-search
                >
                    <label class="home-muted mb-2 block text-xs font-bold uppercase tracking-wide" for="home-task-search">
                        Поиск по задачам
                    </label>
                    <input
                        id="home-task-search"
                        v-model="searchQuery"
                        ref="searchInput"
                        type="search"
                        class="home-input min-h-12 w-full rounded-[1.35rem] px-4 text-base font-semibold"
                        placeholder="Найти задачу на главной"
                        autocomplete="off"
                    >
                </div>
                <div
                    v-if="listReorderMode && !isSearching"
                    class="home-soft-card mb-3 rounded-[1.75rem] p-3"
                >
                    <div class="flex items-center justify-between gap-3">
                        <div>
                            <div class="home-title text-sm font-bold">
                                Режим сортировки списков
                            </div>
                            <div class="home-muted mt-1 text-xs font-semibold">
                                Тяните карточки за кнопку слева.
                            </div>
                        </div>

                        <button
                            type="button"
                            class="home-soft-button shrink-0 rounded-full px-4 py-2 text-sm font-semibold"
                            @click="disableListReorderMode"
                        >
                            Готово
                        </button>
                    </div>
                </div>

                <draggable
                    v-if="!isSearching"
                    v-model="localLists"
                    item-key="id"
                    handle=".list-drag-handle"
                    tag="div"
                    class="space-y-3"
                    :class="listReorderMode && !isSearching ? 'rounded-[2rem] ring-2 ring-[var(--home-focus)] ring-offset-2 ring-offset-[var(--home-bg)]' : ''"
                    :disabled="!listReorderMode"
                    ghost-class="home-drag-ghost"
                    chosen-class="home-drag-chosen"
                    drag-class="home-drag-active"
                    animation="180"
                    @end="saveListsOrder"
                >
                    <template #item="{ element: list }">
                        <div
                            class="home-card home-tap-card relative overflow-hidden rounded-[2rem] p-2 transition active:scale-[0.99] sm:p-3"
                            :class="listReorderMode ? 'border-[var(--home-focus)] bg-[var(--home-surface-soft)]' : ''"
                        >
                            <div class="flex items-stretch">
                                <button
                                    v-if="listReorderMode"
                                    type="button"
                                    class="list-drag-handle home-drag-handle-mobile flex w-8 shrink-0 cursor-grab items-center justify-center rounded-l-[2rem] text-lg active:cursor-grabbing sm:w-10 sm:text-xl"
                                    aria-label="Перетащить список"
                                >
                                    ⋮⋮
                                </button>

                                <Link
                                    :href="route('lists.show', list.id)"
                                    class="block min-w-0 flex-1 rounded-[1.65rem] p-3 transition active:scale-[0.99] sm:p-4"
                                    :class="listReorderMode ? 'cursor-grab' : ''"
                                    @click="handleListClick"
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
                    v-else
                    class="space-y-3"
                >
                    <div
                        v-for="result in searchResults"
                        :key="`${result.list.id}-${result.task.id}`"
                        class="home-card home-tap-card relative overflow-hidden rounded-[2rem] p-2 transition active:scale-[0.99] sm:p-3"
                    >
                        <Link
                            :href="route('lists.show', result.list.id)"
                            class="block min-w-0 flex-1 rounded-[1.65rem] p-3 transition active:scale-[0.99] sm:p-4"
                        >
                            <div class="flex items-start justify-between gap-3">
                                <div class="min-w-0 flex-1">
                                    <div class="flex items-center gap-3">
                                        <div class="home-emoji-tile flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-[1.35rem] text-[28px] sm:h-12 sm:w-12 sm:text-2xl">
                                            {{ result.list.emoji }}
                                        </div>
                                        <div class="min-w-0">
                                            <div class="home-title truncate text-[19px] font-bold leading-tight sm:text-lg">
                                                {{ result.task.title }}
                                            </div>
                                            <div class="home-muted mt-1 text-[14px] font-medium leading-tight">
                                                В списке «{{ result.list.title }}» · {{ result.task.is_done ? 'выполнено' : 'активно' }}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div
                                    class="home-list-card-status flex h-10 min-w-10 shrink-0 items-center justify-center rounded-full px-3 text-sm font-bold"
                                    :class="result.task.is_done ? 'home-list-card-status-done' : 'home-list-card-status-active'"
                                >
                                    {{ result.task.is_done ? '✓' : '•' }}
                                </div>
                            </div>
                        </Link>
                    </div>
                </div>

                <div
                    v-if="isSearching && searchResults.length === 0"
                    class="home-card rounded-[2rem] p-5"
                >
                    <div class="home-title text-lg font-semibold">Ничего не найдено</div>
                    <div class="home-muted mt-2 text-sm leading-relaxed">Попробуйте изменить запрос или очистить поиск.</div>
                </div>


                <div
                    v-if="localLists.length === 0 && !showCreateForm && !isSearching"
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

            <section
                v-if="showCreateForm"
                class="home-create-dock sticky z-20 mt-5"
            >
                <form
                    class="home-card rounded-[2rem] p-4 shadow-lg sm:p-5"
                    @submit.prevent="createList"
                >
                    <div>
                        <div class="flex gap-3">
                            <button
                                type="button"
                                class="home-input flex h-[52px] w-16 shrink-0 items-center justify-center rounded-2xl text-2xl transition active:scale-[0.96]"
                                :class="isCreateIconPickerOpen ? 'ring-2 ring-[var(--home-focus)] ring-offset-2 ring-offset-white' : ''"
                                :aria-expanded="isCreateIconPickerOpen"
                                aria-label="Выбрать иконку списка"
                                @click="toggleCreateIconPicker"
                            >
                                {{ form.emoji }}
                            </button>

                            <input
                                v-model="form.title"
                                class="home-input h-[52px] min-w-0 flex-1 rounded-2xl px-4 text-[17px]"
                                placeholder="Название списка"
                                autofocus
                            >
                        </div>

                        <div
                            v-if="isCreateIconPickerOpen"
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
                                    :class="form.emoji === icon ? 'ring-2 ring-[var(--home-focus)] ring-offset-2 ring-offset-white' : ''"
                                    :aria-label="`Выбрать иконку ${icon}`"
                                    @click="selectCreateIcon(icon)"
                                >
                                    {{ icon }}
                                </button>
                            </div>
                        </div>
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
                            @click="closeCreateForm"
                        >
                            Отмена
                        </button>
                    </div>
                </form>
            </section>
        </div>

        <MobileCommandBar
            v-if="!showCreateForm"
            add-label="Добавить список"
            profile-label="Профиль"
            profile-icon="👤"
            @add="openCreateForm"
            @search="handleMobileSearch"
        />

        <button
            v-if="!showCreateForm"
            type="button"
            class="home-bottom-add-button fixed bottom-6 right-6 z-30 hidden h-[58px] w-[58px] items-center justify-center rounded-full text-2xl font-bold leading-none sm:flex"
            @click="openCreateForm"
            aria-label="Добавить список"
        >
            ➕
        </button>

        <button
            v-if="!showCreateForm"
            type="button"
            class="home-bottom-add-button fixed bottom-23 right-6 z-30 hidden h-[58px] w-[58px] items-center justify-center rounded-full text-2xl font-bold leading-none sm:flex"
            @click="handleMobileSearch"
            aria-label="Поиск задачи"
        >
            🔍
        </button>

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
                            {{ pwaUpdateTitle }}
                        </div>
                        <div class="truncate text-xs text-white/70">
                            {{ pwaUpdateDescription }}
                        </div>
                    </div>

                    <button
                        type="button"
                        class="shrink-0 rounded-full bg-white/15 px-4 py-2 text-sm font-semibold text-white transition active:scale-95"
                        @click="pwaUpdateState === 'ready' ? reloadApp() : null"
                    >
                        {{ pwaUpdateState === 'ready' ? 'Обновить' : '…' }}
                    </button>
                </div>
            </div>
        </Transition>
    </main>
</template>
