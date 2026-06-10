<script setup>
import { computed } from 'vue'
import TaskAvatar from '@/Components/TaskAvatar.vue'

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
    isMenuOpen: {
        type: Boolean,
        default: false,
    },
    reorderMode: {
        type: Boolean,
        default: false,
    },
})

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
])

const cardClass = computed(() => {
    if (props.variant === 'done') {
        return 'home-soft-card opacity-80'
    }

    return 'home-card'
})

const titleClass = computed(() => {
    if (props.variant === 'done') {
        return 'home-muted font-medium line-through decoration-[var(--home-focus)]'
    }

    return 'home-title font-semibold'
})

const checkButtonClass = computed(() => {
    if (props.variant === 'done') {
        return 'home-done-check-button text-sm font-bold'
    }

    return 'home-check-button home-check-button-mobile'
})

const checkLabel = computed(() => {
    return props.variant === 'done'
        ? 'Вернуть в активные'
        : 'Отметить выполненной'
})
</script>

<template>
    <div
        class="home-task-card relative rounded-[1.8rem] p-3 transition active:scale-[0.99] sm:p-4"
        :class="[
            cardClass,
            reorderMode ? 'border-[var(--home-focus)] bg-[var(--home-surface-soft)]' : '',
        ]"
    >
        <div class="flex min-h-[60px] items-center gap-3">
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

            <textarea
                v-if="isEditing"
                ref="editingInput"
                :value="editingTitle"
                class="home-input min-h-[68px] min-w-0 flex-1 resize-none rounded-2xl px-3 py-2 text-[17px] font-semibold leading-snug sm:min-h-[44px] sm:text-lg"
                rows="2"
                @input="emit('update:editingTitle', $event.target.value)"
                @keydown.ctrl.enter.prevent="emit('save-edit', task)"
                @keydown.meta.enter.prevent="emit('save-edit', task)"
                @keydown.esc.prevent="emit('cancel-edit')"
                @blur="emit('save-edit', task)"
            />

            <button
                v-else
                type="button"
                class="min-w-0 flex-1 select-none py-2 text-left text-[17px] leading-snug line-clamp-3 sm:text-lg sm:line-clamp-2"
                :class="titleClass"
                @click="emit('toggle', task)"
                @contextmenu.prevent="emit('edit', task)"
                @pointerdown="emit('start-long-press', task)"
                @pointerup="emit('clear-long-press')"
                @pointerleave="emit('clear-long-press')"
                @pointercancel="emit('clear-long-press')"
            >
                {{ task.title }}
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
