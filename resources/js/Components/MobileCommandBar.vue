<script setup>
import { Link } from '@inertiajs/vue3'

defineProps({
    addLabel: {
        type: String,
        default: 'Добавить',
    },
    searchLabel: {
        type: String,
        default: 'Поиск',
    },
    profileLabel: {
        type: String,
        default: 'Профиль',
    },
    profileIcon: {
        type: String,
        default: '👤',
    },
    isAddDisabled: {
        type: Boolean,
        default: false,
    },
})

const emit = defineEmits(['add', 'search', 'profile'])
</script>

<template>
    <nav
        class="home-bottom-nav fixed inset-x-0 bottom-0 z-40 px-4 pb-[max(env(safe-area-inset-bottom),0.75rem)] pt-3 sm:hidden"
        aria-label="Основные действия"
    >
        <div class="mx-auto grid max-w-xl grid-cols-4 items-end gap-2">
            <Link
                :href="route('home')"
                class="home-bottom-side-button flex h-[64px] flex-col items-center justify-center rounded-[1.35rem] text-[11px] font-bold leading-none"
                aria-label="На главную"
            >
                <span class="text-lg leading-none" aria-hidden="true">🏠</span>
                <span class="mt-1">Домой</span>
            </Link>

            <button
                type="button"
                class="home-bottom-side-button flex h-[64px] flex-col items-center justify-center rounded-[1.35rem] text-[11px] font-bold leading-none"
                :aria-label="searchLabel"
                @click="emit('search')"
            >
                <span class="text-lg leading-none" aria-hidden="true">🔍</span>
                <span class="mt-1">Поиск</span>
            </button>

            <button
                type="button"
                class="home-bottom-add-button -mt-5 flex h-[64px] w-[64px] items-center justify-center justify-self-center rounded-full text-3xl font-black leading-none disabled:opacity-60"
                :disabled="isAddDisabled"
                :aria-label="addLabel"
                @click="emit('add')"
            >
                ➕
            </button>

            <button
                type="button"
                class="home-bottom-side-button flex h-[64px] flex-col items-center justify-center rounded-[1.35rem] text-[11px] font-bold leading-none"
                :aria-label="profileLabel"
                @click="emit('profile')"
            >
                <span class="text-lg leading-none" aria-hidden="true">{{ profileIcon }}</span>
                <span class="mt-1">Профиль</span>
            </button>
        </div>
    </nav>
</template>
