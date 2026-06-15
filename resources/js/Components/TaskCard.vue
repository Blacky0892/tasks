<script setup>
import { computed, ref } from 'vue'
import TaskAvatar from '@/Components/TaskAvatar.vue'

// Описывает задачу, вариант карточки и внешние состояния:
// редактирование, открытое меню и режим сортировки.
const props = defineProps({
    task: {
        type: Object,
        required: true,
    },
    variant: {
        type: String,
        default: 'active', // active | done
    },
    isEditing: {
        type: Boolean,
        default: false,
    },
    editingTitle: {
        type: String,
        default: '',
    },
    editingNote: {
        type: String,
        default: '',
    },
    editingAttachments: {
        type: Array,
        default: () => [],
    },
    editingNewAttachments: {
        type: Array,
        default: () => [],
    },
    editingDueAt: {
        type: String,
        default: '',
    },
    editingRemindAt: {
        type: String,
        default: '',
    },
    editingPriority: {
        type: String,
        default: 'normal',
    },
    isMenuOpen: {
        type: Boolean,
        default: false,
    },
    reorderMode: {
        type: Boolean,
        default: false,
    },
    searchQuery: {
        type: String,
        default: '',
    },
})

// Объявляет события карточки, через которые родитель управляет задачей.
const emit = defineEmits([
    'toggle',
    'edit',
    'save-edit',
    'cancel-edit',
    'delete',
    'toggle-menu',
    'start-long-press',
    'clear-long-press',
    'update:editingTitle',
    'update:editingNote',
    'update:editingAttachments',
    'update:editingNewAttachments',
    'update:editingDueAt',
    'update:editingRemindAt',
    'update:editingPriority',
])

const detailsOpen = ref(false)

// Возвращает базовый класс карточки в зависимости от того,
// активная задача отображается или уже выполненная.
const cardClass = computed(() => {
    if (props.variant === 'done') {
        return 'home-soft-card opacity-80'
    }

    return 'home-card'
})

// Возвращает класс заголовка задачи:
// обычный для активных задач и зачёркнутый для выполненных.
const titleClass = computed(() => {
    if (props.variant === 'done') {
        return 'home-muted font-medium line-through decoration-[var(--home-focus)]'
    }

    return 'home-title font-semibold'
})

// Возвращает класс кнопки выполнения с учётом состояния задачи.
const checkButtonClass = computed(() => {
    if (props.variant === 'done') {
        return 'home-done-check-button text-sm font-bold'
    }

    return 'home-check-button home-check-button-mobile'
})

// Формирует aria-label для кнопки выполнения,
// чтобы действие было понятно скринридерам.
const checkLabel = computed(() => {
    return props.variant === 'done'
        ? 'Вернуть в активные'
        : 'Отметить выполненной'
})

// Определяет имя пользователя, который выполнил задачу.
// Если имени нет, использует email, иначе возвращает null.
const completedByName = computed(() => {
    return props.task.completed_by?.name ?? props.task.completed_by?.email ?? null
})

// Формирует подпись о том, кто отметил задачу выполненной.
// Для активных задач и задач без автора выполнения подпись не показывается.
const completedHint = computed(() => {
    if (props.variant !== 'done' || !completedByName.value) {
        return ''
    }

    return `${completedByName.value} отметил(а)`
})

const normalizedSearchQuery = computed(() => props.searchQuery.trim().toLocaleLowerCase())

const titleSegments = computed(() => {
    const title = props.task.title ?? ''
    const query = normalizedSearchQuery.value

    if (!query) {
        return [{ value: title, match: false }]
    }

    const lowerTitle = title.toLocaleLowerCase()
    const segments = []
    let lastIndex = 0
    let index = lowerTitle.indexOf(query)

    while (index !== -1) {
        if (index > lastIndex) {
            segments.push({ value: title.slice(lastIndex, index), match: false })
        }

        const end = index + query.length
        segments.push({ value: title.slice(index, end), match: true })
        lastIndex = end
        index = lowerTitle.indexOf(query, lastIndex)
    }

    if (lastIndex < title.length) {
        segments.push({ value: title.slice(lastIndex), match: false })
    }

    return segments
})

const dueDate = computed(() => props.task.due_at ? new Date(props.task.due_at) : null)
const isOverdue = computed(() => props.variant !== 'done' && dueDate.value && dueDate.value < new Date())
const dueLabel = computed(() => {
    if (!dueDate.value) {
        return ''
    }

    return new Intl.DateTimeFormat('ru-RU', {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
    }).format(dueDate.value)
})
const priorityLabel = computed(() => ({ low: 'Низкий', normal: 'Обычный', high: 'Высокий' }[props.task.priority] ?? 'Обычный'))

const hasNote = computed(() => Boolean(props.task.note?.trim()))
const attachments = computed(() => props.task.attachments ?? [])
const hasAttachments = computed(() => attachments.value.length > 0)

const urlPattern = /(https?:\/\/[^\s<]+|www\.[^\s<]+)/giu

const noteSegments = computed(() => {
    const note = props.task.note ?? ''
    const segments = []
    let lastIndex = 0

    for (const match of note.matchAll(urlPattern)) {
        if (match.index > lastIndex) {
            segments.push({type: 'text', value: note.slice(lastIndex, match.index)})
        }

        const value = match[0]
        const href = value.startsWith('www.') ? `https://${value}` : value

        segments.push({type: 'link', value, href})
        lastIndex = match.index + value.length
    }

    if (lastIndex < note.length) {
        segments.push({type: 'text', value: note.slice(lastIndex)})
    }

    return segments
})

function toggleDetails() {
    detailsOpen.value = !detailsOpen.value
}

function removeEditingAttachment(path) {
    emit('update:editingAttachments', props.editingAttachments.filter(attachment => attachment.path !== path))
}

function updateNewAttachments(files) {
    emit('update:editingNewAttachments', files)
}
</script>

<template>
    <div
        class="home-task-card relative rounded-[1.8rem] p-3 transition active:scale-[0.99] sm:p-4"
        :class="[
            cardClass,
            reorderMode ? 'border-[var(--home-focus)] bg-[var(--home-surface-soft)]' : '',
        ]"
    >
        <div class="flex min-h-[60px] flex-wrap items-center gap-3 sm:flex-nowrap">
            <button
                v-if="reorderMode"
                type="button"
                class="task-drag-handle flex h-12 w-8 shrink-0 cursor-grab items-center justify-center rounded-full text-xl text-[var(--home-text-subtle)] active:cursor-grabbing sm:h-10 sm:w-7"
                aria-label="Перетащить задачу"
            >
                ⋮⋮
            </button>

            <button
                type="button"
                class="flex h-12 w-12 shrink-0 items-center justify-center rounded-full"
                :class="checkButtonClass"
                :aria-label="checkLabel"
                @click="emit('toggle', task)"
            >
                <template v-if="variant === 'done'">
                    ✓
                </template>
            </button>

            <TaskAvatar
                :user="task.creator"
                :muted="variant === 'done'"
            />

            <div
                v-if="isEditing"
                class="order-last min-w-0 basis-full space-y-2 sm:order-none sm:flex-1 sm:basis-0"
            >
                <textarea
                    ref="editingInput"
                    :value="editingTitle"
                    class="home-input min-h-[68px] w-full max-w-full resize-none rounded-2xl px-3 py-2 text-[17px] font-semibold leading-snug sm:min-h-[44px] sm:text-lg"
                    rows="2"
                    @input="emit('update:editingTitle', $event.target.value)"
                    @keydown.ctrl.enter.prevent="emit('save-edit', task)"
                    @keydown.meta.enter.prevent="emit('save-edit', task)"
                    @keydown.esc.prevent="emit('cancel-edit')"
                />

                <textarea
                    :value="editingNote"
                    class="home-input min-h-[82px] w-full max-w-full resize-none rounded-2xl px-3 py-2 text-sm leading-relaxed"
                    placeholder="Заметка…"
                    rows="3"
                    @input="emit('update:editingNote', $event.target.value)"
                    @keydown.ctrl.enter.prevent="emit('save-edit', task)"
                    @keydown.meta.enter.prevent="emit('save-edit', task)"
                    @keydown.esc.prevent="emit('cancel-edit')"
                />

                <div class="grid min-w-0 gap-2 rounded-2xl bg-white/35 p-2 ring-1 ring-[var(--home-border)] md:grid-cols-3">
                    <label class="home-muted px-1 text-xs font-bold uppercase tracking-wide">
                        Срок
                        <input
                            :value="editingDueAt"
                            class="home-input mt-1 w-full rounded-xl px-3 py-2 text-sm normal-case tracking-normal"
                            type="datetime-local"
                            @input="emit('update:editingDueAt', $event.target.value)"
                        />
                        <button
                            v-if="editingDueAt"
                            type="button"
                            class="mt-1 text-xs font-bold normal-case tracking-normal text-[var(--home-text-subtle)]"
                            @click="emit('update:editingDueAt', '')"
                        >
                            Убрать срок
                        </button>
                    </label>

                    <label class="home-muted px-1 text-xs font-bold uppercase tracking-wide">
                        Напомнить
                        <input
                            :value="editingRemindAt"
                            class="home-input mt-1 w-full rounded-xl px-3 py-2 text-sm normal-case tracking-normal"
                            type="datetime-local"
                            @input="emit('update:editingRemindAt', $event.target.value)"
                        />
                        <button
                            v-if="editingRemindAt"
                            type="button"
                            class="mt-1 text-xs font-bold normal-case tracking-normal text-[var(--home-text-subtle)]"
                            @click="emit('update:editingRemindAt', '')"
                        >
                            Убрать напоминание
                        </button>
                    </label>

                    <label class="home-muted px-1 text-xs font-bold uppercase tracking-wide">
                        Приоритет
                        <select
                            :value="editingPriority"
                            class="home-input mt-1 w-full rounded-xl px-3 py-2 text-sm normal-case tracking-normal"
                            @change="emit('update:editingPriority', $event.target.value)"
                        >
                            <option value="low">Низкий</option>
                            <option value="normal">Обычный</option>
                            <option value="high">Высокий</option>
                        </select>
                    </label>
                </div>

                <div class="space-y-2 rounded-2xl bg-white/35 p-2 ring-1 ring-[var(--home-border)]">
                    <div class="home-muted px-1 text-xs font-bold uppercase tracking-wide">
                        Вложения
                    </div>

                    <div
                        v-if="editingAttachments.length > 0"
                        class="space-y-1"
                    >
                        <div
                            v-for="attachment in editingAttachments"
                            :key="attachment.path"
                            class="flex items-center gap-2 rounded-xl bg-white/55 px-2 py-1.5 text-sm"
                        >
                            <a
                                :href="attachment.url"
                                class="min-w-0 flex-1 truncate font-semibold text-[var(--home-focus)] underline decoration-2 underline-offset-2"
                                target="_blank"
                                rel="noopener noreferrer"
                                @click.stop
                            >
                                {{ attachment.name }}
                            </a>

                            <button
                                type="button"
                                class="home-task-menu-danger rounded-full px-2 py-1 text-xs font-bold"
                                @click.stop="removeEditingAttachment(attachment.path)"
                            >
                                Удалить
                            </button>
                        </div>
                    </div>

                    <div
                        v-else
                        class="home-muted px-1 text-xs font-semibold"
                    >
                        Вложений пока нет.
                    </div>

                    <input
                        class="home-input w-full rounded-xl px-3 py-2 text-sm"
                        type="file"
                        multiple
                        @change="updateNewAttachments([...$event.target.files])"
                    />

                    <div
                        v-if="editingNewAttachments.length > 0"
                        class="home-muted px-1 text-xs font-semibold"
                    >
                        Новые файлы: {{ editingNewAttachments.map(file => file.name).join(', ') }}
                    </div>
                </div>

                <div class="flex flex-wrap justify-end gap-2">
                    <button
                        type="button"
                        class="home-soft-button rounded-full px-4 py-2 text-sm font-bold"
                        @click="emit('cancel-edit')"
                    >
                        Отмена
                    </button>

                    <button
                        type="button"
                        class="home-composer-add rounded-full px-4 py-2 text-sm font-bold"
                        @click="emit('save-edit', task)"
                    >
                        Сохранить
                    </button>
                </div>
            </div>

            <button
                v-else
                type="button"
                class="min-w-0 flex-1 select-none py-2 text-left text-[17px] leading-snug sm:text-lg"
                :class="titleClass"
                @click="emit('toggle', task)"
                @contextmenu.prevent="emit('edit', task)"
                @pointerdown="emit('start-long-press', task)"
                @pointerup="emit('clear-long-press')"
                @pointerleave="emit('clear-long-press')"
                @pointercancel="emit('clear-long-press')"
            >
                 <span class="line-clamp-3 sm:line-clamp-2">
                    <template v-for="(segment, index) in titleSegments" :key="index">
                        <mark
                            v-if="segment.match"
                            class="rounded-md bg-yellow-200/80 px-0.5 text-inherit"
                        >{{ segment.value }}</mark><span v-else>{{ segment.value }}</span>
                    </template>
                </span>

                <span
                    v-if="dueLabel"
                    class="mt-1 inline-flex max-w-full items-center rounded-full px-2.5 py-1 text-[11px] font-bold ring-1"
                    :class="isOverdue ? 'bg-red-50 text-red-600 ring-red-200' : 'bg-white/60 text-[var(--home-text-subtle)] ring-[var(--home-border)]'"
                    :title="isOverdue ? 'Срок просрочен' : 'Срок задачи'"
                >
                    <span class="truncate">{{ isOverdue ? 'Просрочено' : 'Срок' }} · {{ dueLabel }}</span>
                </span>

                <span
                    v-if="task.priority === 'high'"
                    class="ml-1 mt-1 inline-flex max-w-full items-center rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-bold text-amber-700 ring-1 ring-amber-200"
                    :title="`Приоритет: ${priorityLabel}`"
                >
                    Высокий приоритет
                </span>

                <span
                    v-if="completedHint"
                    class="mt-1 inline-flex max-w-full items-center rounded-full bg-white/60 px-2.5 py-1 text-[11px] font-bold text-[var(--home-text-subtle)] ring-1 ring-[var(--home-border)]"
                    :title="completedHint"
                >
                    <span class="truncate">{{ completedHint }}</span>
                </span>
            </button>

            <button
                type="button"
                class="home-menu-button flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-xl"
                aria-label="Действия с задачей"
                @click.stop="emit('toggle-menu', task)"
            >
                ⋯
            </button>
        </div>

        <div
            v-if="hasNote || hasAttachments || isEditing"
            class="mt-2 border-t border-[var(--home-border)] pt-2"
        >
            <button
                type="button"
                class="home-soft-button rounded-full px-3 py-1.5 text-xs font-bold"
                :aria-expanded="detailsOpen"
                @click.stop="toggleDetails"
            >
                {{ detailsOpen ? 'Скрыть детали' : 'Детали' }}
            </button>

            <div v-if="detailsOpen" class="mt-2 space-y-2">
                <div
                    v-if="hasNote"
                    class="home-muted whitespace-pre-wrap break-words rounded-2xl bg-white/45 px-3 py-2 text-sm leading-relaxed ring-1 ring-[var(--home-border)]"
                >
                    <template v-for="(segment, index) in noteSegments" :key="index">
                        <a
                            v-if="segment.type === 'link'"
                            :href="segment.href"
                            class="font-semibold text-[var(--home-focus)] underline decoration-2 underline-offset-2"
                            target="_blank"
                            rel="noopener noreferrer nofollow"
                            @click.stop
                        >{{ segment.value }}</a><span v-else>{{ segment.value }}</span>
                    </template>
                </div>

                <div
                    v-if="hasAttachments"
                    class="grid gap-2 sm:grid-cols-2"
                >
                    <a
                        v-for="attachment in attachments"
                        :key="attachment.path"
                        :href="attachment.url"
                        class="home-soft-button min-w-0 rounded-2xl px-3 py-2 text-sm font-semibold"
                        target="_blank"
                        rel="noopener noreferrer"
                        @click.stop
                    >
                        <span class="block truncate">{{ attachment.name }}</span>
                    </a>
                </div>
            </div>
        </div>

        <div
            v-if="isMenuOpen"
            class="home-task-menu absolute right-3 top-16 z-20 hidden w-44 overflow-hidden rounded-2xl p-1 sm:block"
            @click.stop
        >
            <button
                type="button"
                class="home-task-menu-item w-full rounded-xl px-3 py-3 text-left text-sm font-semibold"
                @click="emit('edit', task)"
            >
                Редактировать
            </button>

            <button
                type="button"
                class="home-task-menu-item home-task-menu-danger w-full rounded-xl px-3 py-3 text-left text-sm font-semibold"
                @click="emit('delete', task)"
            >
                Удалить
            </button>
        </div>
    </div>
</template>
