<script setup>
import { userInitials } from '@/Support/userInitials'

defineProps({
    user: {
        type: Object,
        default: null,
    },
    muted: {
        type: Boolean,
        default: false,
    },
})
</script>

<template>
    <div
        class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
        :class="muted ? 'opacity-70' : ''"
        :style="{ backgroundColor: user?.avatar_color || 'var(--home-avatar-fallback)' }"
        :title="user?.name"
    >
        {{ userInitials(user?.name) }}
    </div>
</template>
