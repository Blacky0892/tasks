<script setup>
import { useNetworkStatus } from '@/Composables/useNetworkStatus'

const {
    isOnline,
    recentlyRestored,
    networkLabel,
    networkDescription,
} = useNetworkStatus()
</script>

<template>
    <Transition
        enter-active-class="transition duration-250 ease-out"
        enter-from-class="-translate-y-3 opacity-0"
        enter-to-class="translate-y-0 opacity-100"
        leave-active-class="transition duration-200 ease-in"
        leave-from-class="translate-y-0 opacity-100"
        leave-to-class="-translate-y-3 opacity-0"
    >
        <div
            v-if="!isOnline || recentlyRestored"
            class="home-network-status fixed inset-x-0 top-0 z-[70] px-3 pt-[max(env(safe-area-inset-top),12px)]"
        >
            <div
                class="mx-auto flex max-w-xl items-center gap-3 rounded-[1.35rem] px-4 py-3"
                :class="isOnline ? 'home-network-status-online' : 'home-network-status-offline'"
                role="status"
                aria-live="polite"
            >
                <div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/35 text-base">
                    {{ isOnline ? '✓' : '!' }}
                </div>

                <div class="min-w-0">
                    <div class="text-sm font-bold leading-tight">
                        {{ networkLabel }}
                    </div>

                    <div
                        v-if="networkDescription"
                        class="mt-0.5 text-xs leading-snug opacity-80"
                    >
                        {{ networkDescription }}
                    </div>
                </div>
            </div>
        </div>
    </Transition>
</template>
