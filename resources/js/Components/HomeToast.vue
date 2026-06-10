<script setup>
// Описывает параметры всплывающего уведомления:
// видимость, заголовок, необязательное описание и текст кнопки.
defineProps({
    show: {
        type: Boolean,
        default: false,
    },
    title: {
        type: String,
        required: true,
    },
    description: {
        type: String,
        default: '',
    },
    buttonText: {
        type: String,
        required: true,
    },
})

// Объявляет событие нажатия на кнопку действия в уведомлении.
defineEmits(['action'])
</script>

<template>
    <Transition
        enter-active-class="transition duration-300 ease-out"
        enter-from-class="translate-y-4 opacity-0"
        enter-to-class="translate-y-0 opacity-100"
        leave-active-class="transition duration-200 ease-in"
        leave-from-class="translate-y-0 opacity-100"
        leave-to-class="translate-y-4 opacity-0"
    >
        <div
            v-if="show"
            class="fixed inset-x-0 bottom-24 z-50 px-3 sm:bottom-6"
        >
            <div class="home-toast mx-auto flex max-w-xl items-center justify-between gap-3 rounded-[1.5rem] px-4 py-3">
                <div class="min-w-0">
                    <div class="text-sm font-semibold">
                        {{ title }}
                    </div>

                    <div
                        v-if="description"
                        class="truncate text-xs text-white/70"
                    >
                        {{ description }}
                    </div>
                </div>

                <button
                    type="button"
                    class="shrink-0 rounded-full bg-white/15 px-4 py-2 text-sm font-semibold text-white transition active:scale-95"
                    @click="$emit('action')"
                >
                    {{ buttonText }}
                </button>
            </div>
        </div>
    </Transition>
</template>
