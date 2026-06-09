<?php

use App\Http\Controllers\FamilyListController;
use App\Http\Controllers\MagicLoginController;
use App\Http\Controllers\TaskController;
use Illuminate\Support\Facades\Route;
use Inertia\Inertia;

Route::get('/magic/{token}', MagicLoginController::class)->name('magic.login');

Route::middleware(['auth'])->group(function () {
    Route::get('/', [FamilyListController::class, 'index'])->name('home');

    Route::post('/lists', [FamilyListController::class, 'store'])->name('lists.store');
    Route::get('/lists/{list}', [FamilyListController::class, 'show'])->name('lists.show');
    Route::patch('/lists/{list}', [FamilyListController::class, 'update'])->name('lists.update');
    Route::delete('/lists/{list}', [FamilyListController::class, 'destroy'])->name('lists.destroy');
    Route::post('/lists/{list}/repeat-done-tasks', [FamilyListController::class, 'repeatDoneTasks'])
        ->name('lists.repeat-done-tasks');

    Route::post('/lists/{list}/tasks', [TaskController::class, 'store'])->name('tasks.store');
    Route::patch('/tasks/{task}', [TaskController::class, 'update'])->name('tasks.update');
    Route::post('/tasks/{task}/toggle', [TaskController::class, 'toggle'])->name('tasks.toggle');
    Route::delete('/tasks/{task}', [TaskController::class, 'destroy'])->name('tasks.destroy');
});

require __DIR__.'/auth.php';
