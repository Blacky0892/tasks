import { computed, onMounted, onUnmounted, ref } from 'vue'

const isOnline = ref(
    typeof navigator === 'undefined' ? true : navigator.onLine,
)

const wasOffline = ref(false)
const recentlyRestored = ref(false)
let restoredTimer = null

function setOnline() {
    isOnline.value = true

    if (wasOffline.value) {
        recentlyRestored.value = true

        window.clearTimeout(restoredTimer)

        restoredTimer = window.setTimeout(() => {
            recentlyRestored.value = false
        }, 3500)
    }

    wasOffline.value = false
}

function setOffline() {
    isOnline.value = false
    wasOffline.value = true
    recentlyRestored.value = false
}

export function useNetworkStatus() {
    onMounted(() => {
        isOnline.value = navigator.onLine

        window.addEventListener('online', setOnline)
        window.addEventListener('offline', setOffline)
    })

    onUnmounted(() => {
        window.removeEventListener('online', setOnline)
        window.removeEventListener('offline', setOffline)
    })

    const networkLabel = computed(() => {
        if (!isOnline.value) {
            return 'Нет сети'
        }

        if (recentlyRestored.value) {
            return 'Снова онлайн'
        }

        return 'Онлайн'
    })

    const networkDescription = computed(() => {
        if (!isOnline.value) {
            return 'Проверьте подключение. Изменения пока не отправятся.'
        }

        if (recentlyRestored.value) {
            return 'Подключение восстановлено.'
        }

        return ''
    })

    return {
        isOnline,
        wasOffline,
        recentlyRestored,
        networkLabel,
        networkDescription,
    }
}
