<?php

use App\Http\Controllers\FamilyListController;
use App\Http\Controllers\MagicLoginController;
use App\Http\Controllers\PushSubscriptionController;
use App\Http\Controllers\TaskController;
use Illuminate\Support\Facades\Route;

Route::get('/magic/{token}', MagicLoginController::class)->name('magic.login');

Route::get('/offline', function () {
    return response(<<<'HTML'
<!doctype html>
<html lang="ru">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
    <meta name="theme-color" content="#DDEBCB">
    <title>Нет сети — Наш дом</title>
    <style>
        :root { color-scheme: light; font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
        body { min-height: 100vh; margin: 0; display: grid; place-items: center; background: #F8FAF3; color: #283326; padding: 24px; }
        main { max-width: 420px; border: 1px solid #D9E2D0; border-radius: 28px; background: rgba(255,255,255,.9); box-shadow: 0 16px 40px rgba(221,235,203,.55); padding: 24px; }
        .icon { width: 64px; height: 64px; display: grid; place-items: center; border-radius: 22px; background: #DDEBCB; font-size: 32px; }
        h1 { margin: 18px 0 8px; font-size: 28px; line-height: 1; }
        p { margin: 0; color: #526743; line-height: 1.55; }
        button { margin-top: 20px; min-height: 48px; width: 100%; border: 0; border-radius: 18px; background: #CFE0BB; color: #283326; font: inherit; font-weight: 800; }
    </style>
</head>
<body>
    <main>
        <div class="icon">🏡</div>
        <h1>Вы офлайн</h1>
        <p>Открытые ранее списки могут быть доступны. Новые задачи, добавленные без сети, отправятся после восстановления подключения.</p>
        <button onclick="location.reload()">Попробовать снова</button>
    </main>
</body>
</html>
HTML, 200)->header('Content-Type', 'text/html; charset=UTF-8');
})->name('offline');

Route::middleware(['auth'])->group(function () {
    Route::get('/', [FamilyListController::class, 'index'])->name('home');
    Route::get('/lists-sync-state', [FamilyListController::class, 'indexSyncState'])
        ->name('lists.sync-state');
    Route::post('/lists', [FamilyListController::class, 'store'])->name('lists.store');
    Route::get('/lists/{list}', [FamilyListController::class, 'show'])->name('lists.show');
    Route::post('/push-subscriptions', [PushSubscriptionController::class, 'store'])
        ->name('push-subscriptions.store');
    Route::patch('/lists/reorder', [FamilyListController::class, 'reorder'])
        ->name('lists.reorder');
    Route::patch('/lists/{list}', [FamilyListController::class, 'update'])->name('lists.update');
    Route::delete('/lists/{list}', [FamilyListController::class, 'destroy'])->name('lists.destroy');
    Route::post('/lists/{list}/repeat-done-tasks', [FamilyListController::class, 'repeatDoneTasks'])
        ->name('lists.repeat-done-tasks');
    Route::get('/lists/{list}/sync-state', [FamilyListController::class, 'syncState'])
        ->name('lists.sync-state');

    Route::patch('/lists/{list}/tasks/reorder', [TaskController::class, 'reorder'])
        ->name('tasks.reorder');
    Route::post('/lists/{list}/tasks', [TaskController::class, 'store'])->name('tasks.store');
    Route::delete('/lists/{list}/tasks/done', [TaskController::class, 'clearDone'])
        ->name('tasks.clear-done');
    Route::patch('/tasks/{task}', [TaskController::class, 'update'])->name('tasks.update');
    Route::post('/tasks/{task}/toggle', [TaskController::class, 'toggle'])->name('tasks.toggle');
    Route::delete('/tasks/{task}', [TaskController::class, 'destroy'])->name('tasks.destroy');
});

require __DIR__.'/auth.php';
