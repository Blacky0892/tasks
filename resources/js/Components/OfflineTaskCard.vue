<script setup>
import TaskAvatar from '@/Components/TaskAvatar.vue'

// Описывает локальную задачу, которая ещё не была отправлена на сервер.
defineProps({
    task: {
        type: Object,
        required: true,
    },
})

// Объявляет событие удаления задачи из локальной очереди.
defineEmits(['remove'])
</script>

<template>
    <div class="home-card home-task-card relative rounded-[1.8rem] p-3 transition active:scale-[0.99] sm:p-4">
        <div class="flex min-h-[60px] items-center gap-3">
            <button
                type="button"
                class="home-check-button home-check-button-mobile flex h-12 w-12 shrink-0 items-center justify-center rounded-full opacity-50"
                aria-label="Задача ожидает отправки"
                disabled
            />

            <TaskAvatar :user="task.creator" />

            <div class="min-w-0 flex-1 py-2">
                <div class="home-title text-[17px] font-semibold leading-snug line-clamp-3 sm:text-lg sm:line-clamp-2">
                    {{ task.title }}
                </div>

                <div class="home-muted mt-1 flex items-center gap-2 text-xs font-semibold">
                    <span
                        class="inline-flex h-2 w-2 rounded-full"
                        :class="task._syncing ? 'bg-amber-500' : 'bg-[var(--home-focus)]'"
                    />

                    <span>
                        {{ task._syncing ? 'Отправляется…' : 'Сохранено на устройстве' }}
                    </span>
                </div>
            </div>

            <button
                type="button"
                class="home-menu-button flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-xl"
                aria-label="Удалить локальную задачу"
                @click="$emit('remove', task)"
            >
                ×
            </button>
        </div>
    </div>
</template>
