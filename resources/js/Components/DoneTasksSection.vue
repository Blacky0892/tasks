<script setup>
import TaskCard from '@/Components/TaskCard.vue'

// Описывает входные данные секции выполненных задач:
// полный список, видимую часть списка, состояние раскрытия,
// текущую задачу в режиме редактирования и открытое меню.
defineProps({
    tasks: {
        type: Array,
        required: true,
    },
    visibleTasks: {
        type: Array,
        required: true,
    },
    hiddenCount: {
        type: Number,
        required: true,
    },
    show: {
        type: Boolean,
        required: true,
    },
    editingTaskId: {
        type: [Number, String, null],
        default: null,
    },
    editingTitle: {
        type: String,
        default: '',
    },
    openedTaskMenuId: {
        type: [Number, String, null],
        default: null,
    },
    canClearDone: {
        type: Boolean,
        default: true,
    },
    isClearingDone: {
        type: Boolean,
        default: false,
    },
})

// Объявляет события, которые секция пробрасывает родителю:
// раскрытие списка, подгрузку задач и все действия с карточками.
defineEmits([
    'toggle-show',
    'show-more',
    'update:editing-title',
    'toggle-task',
    'edit',
    'save-edit',
    'cancel-edit',
    'delete',
    'toggle-menu',
    'start-long-press',
    'clear-long-press',
    'open-actions',
])
</script>

<template>
    <section
        v-if="tasks.length > 0"
        class="mt-8 pb-6"
    >
        <div class="mb-3 flex gap-2">
            <button
                type="button"
                class="home-done-section-toggle flex min-h-12 flex-1 items-center justify-between rounded-[1.5rem] px-4 py-3 text-left text-sm font-bold"
                @click="$emit('toggle-show')"
            >
                <span>
                    {{ show ? 'Свернуть выполненные' : 'Выполнено' }} · {{ tasks.length }}
                </span>

                <span class="text-base leading-none">
                    {{ show ? '⌃' : '⌄' }}
                </span>
            </button>

            <button
                type="button"
                class="home-soft-button min-h-12 shrink-0 rounded-[1.5rem] px-4 py-3 text-sm font-bold disabled:opacity-50"
                :disabled="!canClearDone || isClearingDone"
                aria-label="Действия с выполненными задачами"
                @click="$emit('open-actions')"
            >
                {{ isClearingDone ? '…' : '⋯' }}
            </button>
        </div>

        <TransitionGroup
            name="task-list"
            tag="div"
            class="space-y-3"
        >
            <TaskCard
                v-for="task in visibleTasks"
                :key="task.id"
                :task="task"
                variant="done"
                :is-editing="editingTaskId === task.id"
                :editing-title="editingTitle"
                :is-menu-open="openedTaskMenuId === task.id"
                @update:editing-title="$emit('update:editing-title', $event)"
                @toggle="$emit('toggle-task', $event)"
                @edit="$emit('edit', $event)"
                @save-edit="$emit('save-edit', $event)"
                @cancel-edit="$emit('cancel-edit')"
                @delete="$emit('delete', $event)"
                @toggle-menu="$emit('toggle-menu', $event)"
                @start-long-press="$emit('start-long-press', $event)"
                @clear-long-press="$emit('clear-long-press')"
            />
        </TransitionGroup>

        <button
            v-if="show && hiddenCount > 0"
            type="button"
            class="home-soft-button mt-3 min-h-12 w-full rounded-[1.5rem] px-4 py-3 text-sm font-semibold"
            @click="$emit('show-more')"
        >
            Показать ещё {{ hiddenCount }}
        </button>
    </section>
</template>
