<?php

namespace App\Http\Controllers;

use App\Models\FamilyList;
use App\Models\Task;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;

/**
 * Контроллер для управления задачами внутри семейных списков.
 *
 * Отвечает за создание, выполнение, редактирование, удаление
 * и ручную сортировку активных задач.
 */
class TaskController extends Controller
{
    /**
     * Создаёт одну или несколько задач в выбранном списке.
     *
     * Принимает текст, разбивает его на строки, удаляет пустые и повторяющиеся значения,
     * ограничивает импорт до 50 задач и добавляет их в конец активного списка.
     */
    public function store(Request $request, FamilyList $list): RedirectResponse
    {
        $validated = $request->validate([
            'title' => ['required', 'string', 'max:4000'],
        ]);

        $titles = collect(preg_split('/\R/u', $validated['title']))
            ->map(fn ($title) => trim($title))
            ->filter()
            ->unique()
            ->take(50)
            ->values();

        $maxSortOrder = (int) $list->tasks()
            ->where('is_done', false)
            ->max('sort_order');

        foreach ($titles as $index => $title) {
            $list->tasks()->create([
                'title' => mb_substr($title, 0, 255),
                'sort_order' => $maxSortOrder + $index + 1,
                'created_by' => $request->user()->id,
            ]);
        }

        return back();
    }

    /**
     * Переключает состояние задачи между активной и выполненной.
     *
     * Если задача уже выполнена, сбрасывает данные выполнения.
     * Если задача активна, отмечает её выполненной текущим пользователем.
     */
    public function toggle(Request $request, Task $task): RedirectResponse
    {
        if ($task->is_done) {
            $task->update([
                'is_done' => false,
                'completed_by' => null,
                'completed_at' => null,
            ]);

            return back();
        }

        $task->update([
            'is_done' => true,
            'completed_by' => $request->user()->id,
            'completed_at' => now(),
        ]);

        return back();
    }

    /**
     * Обновляет название задачи.
     *
     * Валидирует новое название и сохраняет его в существующей записи задачи.
     */
    public function update(Request $request, Task $task): RedirectResponse
    {
        $validated = $request->validate([
            'title' => ['required', 'string', 'max:255'],
        ]);

        $task->update([
            'title' => $validated['title'],
        ]);

        return back();
    }

    /**
     * Удаляет задачу из списка.
     *
     * Использует стандартное удаление модели, с учётом настроек самой модели Task
     * и подключённых трейтов, если они используются.
     */
    public function destroy(Task $task): RedirectResponse
    {
        $task->delete();

        return back();
    }

    /**
     * Обновляет порядок активных задач внутри списка.
     *
     * Принимает массив идентификаторов в новом порядке, проверяет принадлежность задач
     * текущему списку и меняет sort_order только у невыполненных задач.
     */
    public function reorder(Request $request, FamilyList $list): RedirectResponse
    {
        $validated = $request->validate([
            'ids' => ['required', 'array'],
            'ids.*' => ['integer', 'exists:tasks,id'],
        ]);

        $tasks = $list->tasks()
            ->whereIn('id', $validated['ids'])
            ->where('is_done', false)
            ->get()
            ->keyBy('id');

        foreach ($validated['ids'] as $index => $id) {
            $task = $tasks->get($id);

            if (!$task) {
                continue;
            }

            $task->update([
                'sort_order' => $index + 1,
            ]);
        }

        return back();
    }
}
