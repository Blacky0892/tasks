<script setup>
import {nextTick, ref, watch} from 'vue'

// Создаёт двустороннюю модель для текста новой задачи.
const model = defineModel({
    type: String,
    default: '',
})

const noteModel = defineModel('note', {
    type: String,
    default: '',
})

// Описывает состояние формы создания задачи:
// видимость, отправку, ошибки и состояние локальной offline-очереди.
defineProps({
    show: {
        type: Boolean,
        default: false,
    },
    processing: {
        type: Boolean,
        default: false,
    },
    error: {
        type: String,
        default: '',
    },
    offlineTasksCount: {
        type: Number,
        default: 0,
    },
    isSyncingOfflineTasks: {
        type: Boolean,
        default: false,
    },
    syncError: {
        type: Boolean,
        default: false,
    },
})

// Объявляет события отправки формы и закрытия композера.
defineEmits(['submit', 'close', 'attachments-change'])

const textarea = ref(null)
const detailsOpen = ref(false)

function focusTextarea() {
    nextTick(() => {
        textarea.value?.focus({preventScroll: true})
    })
}

watch(
    () => model.value,
    () => {
        if (!textarea.value) {
            return
        }

        textarea.value.style.height = 'auto'
        textarea.value.style.height = `${textarea.value.scrollHeight}px`
    },
)

defineExpose({
    focus: focusTextarea,
})

function toggleDetails() {
    detailsOpen.value = !detailsOpen.value
}
</script>

<template>
    <Transition
        enter-active-class="transition duration-200 ease-out"
        enter-from-class="opacity-0"
        enter-to-class="opacity-100"
        leave-active-class="transition duration-150 ease-in"
        leave-from-class="opacity-100"
        leave-to-class="opacity-0"
    >
        <div
            v-if="show"
            class="fixed inset-0 z-20 hidden bg-black/5 backdrop-blur-[1px] max-sm:block"
            @click="$emit('close')"
        />
    </Transition>

    <Transition
        enter-active-class="transition duration-200 ease-out"
        enter-from-class="-translate-y-2 opacity-0"
        enter-to-class="translate-y-0 opacity-100"
        leave-active-class="transition duration-150 ease-in"
        leave-from-class="translate-y-0 opacity-100"
        leave-to-class="-translate-y-2 opacity-0"
    >
        <form
            v-if="show"
            class="home-glass-card home-task-composer sticky top-[172px] z-30 mb-5 rounded-[2rem] p-2 sm:top-4"
            @submit.prevent="$emit('submit')"
        >
            <div class="mb-2 flex items-center justify-between px-2 pt-1">
                <div class="home-muted text-xs font-bold uppercase tracking-wide">
                    Новая задача
                </div>

                <button
                    type="button"
                    class="home-soft-button rounded-full px-3 py-1.5 text-xs font-bold"
                    :aria-expanded="detailsOpen"
                    @click="toggleDetails"
                >
                    {{ detailsOpen ? 'Скрыть' : 'Подробнее' }}
                </button>

                <button
                    type="button"
                    class="home-menu-button flex h-9 w-9 items-center justify-center rounded-full text-xl"
                    aria-label="Закрыть поле добавления"
                    @click="$emit('close')"
                >
                    ×
                </button>
            </div>

            <div class="flex items-stretch gap-2">
                <textarea
                    ref="textarea"
                    v-model="model"
                    class="home-input min-h-[72px] flex-1 resize-none rounded-[1.5rem] border-transparent px-4 py-4 text-[17px] leading-snug sm:min-h-[52px] sm:py-3 sm:text-base"
                    placeholder="Новая задача или список строк..."
                    autocomplete="off"
                    rows="2"
                    @keydown.ctrl.enter.prevent="$emit('submit')"
                    @keydown.meta.enter.prevent="$emit('submit')"
                    @keydown.esc.prevent="$emit('close')"
                />

                <button
                    type="submit"
                    class="home-composer-add grid min-h-[72px] w-[58px] shrink-0 place-items-center rounded-[1.5rem] text-[28px] font-normal leading-none transition active:scale-[0.96] disabled:opacity-50 sm:min-h-[52px] sm:w-[52px] sm:text-2xl"
                    :disabled="processing || !model.trim()"
                    aria-label="Сохранить задачу"
                >
                    <span aria-hidden="true" class="-mt-0.5 leading-none">
                        {{ processing ? '…' : '✓' }}
                    </span>
                </button>
            </div>

            <Transition
                enter-active-class="transition duration-150 ease-out"
                enter-from-class="-translate-y-1 opacity-0"
                enter-to-class="translate-y-0 opacity-100"
                leave-active-class="transition duration-100 ease-in"
                leave-from-class="translate-y-0 opacity-100"
                leave-to-class="-translate-y-1 opacity-0"
            >
                <div
                    v-if="detailsOpen"
                    class="px-1 pt-2"
                >
                    <label class="home-muted mb-1 block px-2 text-xs font-bold uppercase tracking-wide" for="task-note">
                        Заметка
                    </label>

                    <textarea
                        id="task-note"
                        v-model="noteModel"
                        class="home-input min-h-[96px] w-full resize-none rounded-[1.5rem] border-transparent px-4 py-3 text-sm leading-relaxed"
                        placeholder="Ссылки, контекст или уточнения…"
                        rows="3"
                    />

                    <label class="home-muted mt-3 block px-2 text-xs font-bold uppercase tracking-wide" for="task-attachments">
                        Файлы и изображения
                    </label>

                    <input
                        id="task-attachments"
                        class="home-input mt-1 w-full rounded-[1.2rem] px-3 py-2 text-sm"
                        type="file"
                        multiple
                        @change="$emit('attachments-change', [...$event.target.files])"
                    />
                </div>
            </Transition>

            <div
                v-if="error"
                class="px-2 pt-2 text-sm text-red-500"
            >
                {{ error }}
            </div>

            <div
                v-if="offlineTasksCount > 0"
                class="px-2 pt-2 text-xs font-semibold"
                :class="syncError ? 'text-red-500' : 'home-muted'"
            >
                <template v-if="isSyncingOfflineTasks">
                    Отправляю сохранённые задачи…
                </template>

                <template v-else-if="syncError">
                    Не удалось отправить сохранённые задачи. Попробуем позже.
                </template>

                <template v-else>
                    {{ offlineTasksCount }} {{ offlineTasksCount === 1 ? 'задача ждёт' : 'задачи ждут' }} отправки.
                </template>
            </div>
        </form>
    </Transition>
</template>
