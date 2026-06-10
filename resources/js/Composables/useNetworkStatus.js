import { computed, onMounted, onUnmounted, ref } from 'vue'

const isOnline = ref(
    typeof navigator === 'undefined' ? true : navigator.onLine,
)

const wasOffline = ref(false)
const recentlyRestored = ref(false)
let restoredTimer = null

// Переводит приложение в онлайн-режим и временно показывает статус восстановления соединения.
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

// Переводит приложение в офлайн-режим и сбрасывает индикатор восстановленного соединения.
function setOffline() {
    isOnline.value = false
    wasOffline.value = true
    recentlyRestored.value = false
}

// Возвращает реактивное состояние сети и текстовые статусы для отображения в интерфейсе.
export function useNetworkStatus() {
    // При монтировании синхронизирует текущее состояние сети и подписывается на системные события браузера.
    onMounted(() => {
        isOnline.value = navigator.onLine

        window.addEventListener('online', setOnline)
        window.addEventListener('offline', setOffline)
    })

    // При размонтировании удаляет обработчики, чтобы не оставлять лишние слушатели событий.
    onUnmounted(() => {
        window.removeEventListener('online', setOnline)
        window.removeEventListener('offline', setOffline)
    })

    // Формирует короткий текстовый статус сети для бейджа или уведомления.
    const networkLabel = computed(() => {
        if (!isOnline.value) {
            return 'Нет сети'
        }

        if (recentlyRestored.value) {
            return 'Снова онлайн'
        }

        return 'Онлайн'
    })

    // Формирует пояснение к сетевому статусу, если пользователю нужно показать дополнительный текст.
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
