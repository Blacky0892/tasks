<?php

namespace App\Http\Controllers;

use App\Models\FamilyList;
use App\Models\Task;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;

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
            'note' => ['nullable', 'string', 'max:10000'],
            'attachments' => ['nullable', 'array', 'max:5'],
            'attachments.*' => ['file', 'max:10240'],
            'due_at' => ['nullable', 'date'],
            'remind_at' => ['nullable', 'date'],
            'priority' => ['nullable', Rule::in(['low', 'normal', 'high'])],
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

        $note = isset($validated['note']) ? trim($validated['note']) : null;
        $note = $note !== '' ? $note : null;

        $attachments = $titles->count() === 1
            ? $this->storeAttachments($request)
            : [];

        foreach ($titles as $index => $title) {
            $list->tasks()->create([
                'title' => mb_substr($title, 0, 255),
                'note' => $titles->count() === 1 ? $note : null,
                'attachments' => $attachments,
                'due_at' => $titles->count() === 1 ? ($validated['due_at'] ?? null) : null,
                'remind_at' => $titles->count() === 1 ? ($validated['remind_at'] ?? null) : null,
                'priority' => $validated['priority'] ?? 'normal',
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
     * Обновляет название и заметку задачи.
     *
     * Валидирует новое название и сохраняет его в существующей записи задачи.
     */
    public function update(Request $request, Task $task): RedirectResponse
    {
        $validated = $request->validate([
            'title' => ['required', 'string', 'max:255'],
            'note' => ['nullable', 'string', 'max:10000'],
            'attachments' => ['nullable', 'array', 'max:5'],
            'attachments.*' => ['file', 'max:10240'],
            'due_at' => ['nullable', 'date'],
            'remind_at' => ['nullable', 'date'],
            'priority' => ['nullable', Rule::in(['low', 'normal', 'high'])],
            'kept_attachments' => ['nullable', 'array'],
            'kept_attachments.*.name' => ['required_with:kept_attachments', 'string', 'max:255'],
            'kept_attachments.*.path' => ['required_with:kept_attachments', 'string', 'max:1000'],
            'kept_attachments.*.url' => ['required_with:kept_attachments', 'string', 'max:2000'],
            'kept_attachments.*.mime' => ['nullable', 'string', 'max:255'],
            'kept_attachments.*.size' => ['nullable', 'integer'],
        ]);

        $note = isset($validated['note']) ? trim($validated['note']) : null;

        $attachments = [
            ...($validated['kept_attachments'] ?? ($task->attachments ?? [])),
            ...$this->storeAttachments($request),
        ];

        $this->deleteRemovedAttachments($task->attachments ?? [], $attachments);

        $task->update([
            'title' => $validated['title'],
            'note' => $note !== '' ? $note : null,
            'due_at' => $validated['due_at'] ?? null,
            'remind_at' => $validated['remind_at'] ?? null,
            'priority' => $validated['priority'] ?? 'normal',
            'reminder_sent_at' => null,
            'attachments' => $attachments,
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
     * Удаляет все выполненные задачи выбранного списка.
     *
     * Использует связь списка, чтобы очистить только задачи текущего списка
     * и не затронуть активные пункты.
     */
    public function clearDone(FamilyList $list): RedirectResponse
    {
        $list->tasks()
            ->where('is_done', true)
            ->delete();

        return back();
    }

    /**
     * Сохраняет приложенные к задаче файлы в публичный storage и возвращает метаданные.
     */
    private function storeAttachments(Request $request): array
    {
        if (! $request->hasFile('attachments')) {
            return [];
        }

        return collect($request->file('attachments'))
            ->filter(fn ($file) => $file->isValid())
            ->map(function ($file) {
                $path = $file->store('task-attachments', 'public');

                return [
                    'name' => $file->getClientOriginalName(),
                    'path' => $path,
                    'url' => Storage::disk('public')->url($path),
                    'mime' => $file->getClientMimeType(),
                    'size' => $file->getSize(),
                ];
            })
            ->values()
            ->all();
    }

    /**
     * Удаляет файлы, которые пользователь убрал из списка вложений задачи.
     */
    private function deleteRemovedAttachments(array $oldAttachments, array $newAttachments): void
    {
        $newPaths = collect($newAttachments)
            ->pluck('path')
            ->filter()
            ->all();

        collect($oldAttachments)
            ->pluck('path')
            ->filter()
            ->reject(fn ($path) => in_array($path, $newPaths, true))
            ->each(fn ($path) => Storage::disk('public')->delete($path));
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

            if (! $task) {
                continue;
            }

            $task->update([
                'sort_order' => $index + 1,
            ]);
        }

        return back();
    }
}
