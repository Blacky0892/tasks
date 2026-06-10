<?php

namespace App\Http\Controllers;

use App\Models\FamilyList;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Контроллер для работы со списками задач семьи.
 *
 * Отвечает за отображение списков, создание, редактирование, архивирование,
 * сортировку и выдачу контрольной версии состояния для синхронизации интерфейса.
 */
class FamilyListController extends Controller
{
    /**
     * Показывает главную страницу со всеми неархивными списками.
     *
     * Для каждого списка дополнительно считает количество активных и выполненных задач,
     * затем передаёт данные в Inertia-компонент главной страницы.
     */
    public function index(): Response
    {
        $lists = FamilyList::query()
            ->withCount([
                'tasks as active_tasks_count' => fn ($query) => $query->where('is_done', false),
                'tasks as done_tasks_count' => fn ($query) => $query->where('is_done', true),
            ])
            ->whereNull('archived_at')
            ->orderBy('sort_order')
            ->orderByDesc('created_at')
            ->get();

        return Inertia::render('Home', [
            'lists' => $lists,
        ]);
    }

    /**
     * Создаёт новый список задач.
     *
     * Валидирует название и эмодзи, назначает следующий порядок сортировки
     * среди неархивных списков и сохраняет автора создания.
     */
    public function store(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'title' => ['required', 'string', 'max:255'],
            'emoji' => ['nullable', 'string', 'max:10'],
        ]);

        $maxSortOrder = FamilyList::query()
            ->whereNull('archived_at')
            ->max('sort_order');

        FamilyList::query()->create([
            'title' => $validated['title'],
            'emoji' => $validated['emoji'] ?: '📝',
            'sort_order' => ((int) $maxSortOrder) + 1,
            'created_by' => $request->user()->id,
        ]);

        return back();
    }

    /**
     * Обновляет название и эмодзи существующего списка.
     *
     * Если эмодзи не передано, устанавливает стандартную иконку списка задач.
     */
    public function update(Request $request, FamilyList $list): RedirectResponse
    {
        $validated = $request->validate([
            'title' => ['required', 'string', 'max:255'],
            'emoji' => ['nullable', 'string', 'max:10'],
        ]);

        $list->update([
            'title' => $validated['title'],
            'emoji' => $validated['emoji'] ?: '📝',
        ]);

        return back();
    }

    /**
     * Архивирует список задач.
     *
     * Список не удаляется физически из базы, а помечается датой архивирования
     * и после этого скрывается с главной страницы.
     */
    public function destroy(FamilyList $list): RedirectResponse
    {
        $list->update([
            'archived_at' => now(),
        ]);

        return redirect()->route('home');
    }

    /**
     * Показывает страницу конкретного списка задач.
     *
     * Загружает автора списка, задачи, авторов задач и пользователей,
     * которые отметили задачи выполненными. Активные задачи выводятся выше выполненных.
     */
    public function show(FamilyList $list): Response
    {
        $list->load([
            'creator:id,name,avatar_color',
            'tasks' => function ($query) {
                $query
                    ->with([
                        'creator:id,name,avatar_color',
                        'completedBy:id,name,avatar_color',
                    ])
                    ->orderBy('is_done')
                    ->orderByRaw('CASE WHEN is_done = 0 THEN sort_order END ASC')
                    ->orderByRaw('CASE WHEN is_done = 0 THEN created_at END DESC')
                    ->orderByRaw('CASE WHEN is_done = 1 THEN completed_at END DESC')
                    ->orderByDesc('created_at');
            },
        ]);

        return Inertia::render('Lists/Show', [
            'list' => $list,
        ]);
    }

    /**
     * Возвращает выполненные задачи списка обратно в активные.
     *
     * Каждой восстановленной задаче сбрасываются данные выполнения,
     * а новый порядок сортировки назначается после текущих активных задач.
     */
    public function repeatDoneTasks(FamilyList $list): RedirectResponse
    {
        $maxSortOrder = (int) $list->tasks()
            ->where('is_done', false)
            ->max('sort_order');

        $doneTasks = $list->tasks()
            ->where('is_done', true)
            ->orderByDesc('completed_at')
            ->get();

        foreach ($doneTasks as $index => $task) {
            $task->update([
                'is_done' => false,
                'completed_by' => null,
                'completed_at' => null,
                'sort_order' => $maxSortOrder + $index + 1,
            ]);
        }

        return back();
    }

    /**
     * Обновляет порядок списков на главной странице.
     *
     * Принимает массив идентификаторов в новом порядке и последовательно
     * записывает значение sort_order для каждого списка.
     */
    public function reorder(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'ids' => ['required', 'array'],
            'ids.*' => ['integer', 'exists:family_lists,id'],
        ]);

        foreach ($validated['ids'] as $index => $id) {
            FamilyList::query()
                ->whereKey($id)
                ->update([
                    'sort_order' => $index + 1,
                ]);
        }

        return back();
    }

    /**
     * Возвращает контрольную версию состояния конкретного списка.
     *
     * Версия строится из количества активных и выполненных задач,
     * даты обновления списка и дат создания/обновления задач. Используется фронтом,
     * чтобы понять, нужно ли перезагрузить данные списка.
     */
    public function syncState(FamilyList $list): JsonResponse
    {
        $activeTasksCount = $list->tasks()
            ->where('is_done', false)
            ->count();

        $doneTasksCount = $list->tasks()
            ->where('is_done', true)
            ->count();

        $latestTaskUpdatedAt = $list->tasks()
            ->max('updated_at');

        $latestTaskCreatedAt = $list->tasks()
            ->max('created_at');

        $version = sha1(json_encode([
            'list_id' => $list->id,
            'list_updated_at' => optional($list->updated_at)->timestamp,
            'active_tasks_count' => $activeTasksCount,
            'done_tasks_count' => $doneTasksCount,
            'latest_task_updated_at' => optional($latestTaskUpdatedAt)->timestamp,
            'latest_task_created_at' => optional($latestTaskCreatedAt)->timestamp,
        ]));

        return response()->json([
            'version' => $version,
        ]);
    }

    /**
     * Возвращает контрольную версию состояния главной страницы со списками.
     *
     * Учитывает количество списков и задач, последние даты изменений,
     * а также отпечаток сортировки списков. Нужна для синхронизации главной страницы
     * между пользователями или вкладками без постоянной полной перезагрузки данных.
     */
    public function indexSyncState(): JsonResponse
    {
        $latestListUpdatedAt = FamilyList::query()
            ->whereNull('archived_at')
            ->max('updated_at');

        $latestListCreatedAt = FamilyList::query()
            ->whereNull('archived_at')
            ->max('created_at');

        $latestTaskUpdatedAt = FamilyList::query()
            ->whereNull('archived_at')
            ->join('tasks', 'tasks.family_list_id', '=', 'family_lists.id')
            ->max('tasks.updated_at');

        $listsCount = FamilyList::query()
            ->whereNull('archived_at')
            ->count();

        $activeTasksCount = FamilyList::query()
            ->whereNull('archived_at')
            ->join('tasks', 'tasks.family_list_id', '=', 'family_lists.id')
            ->where('tasks.is_done', false)
            ->count();

        $doneTasksCount = FamilyList::query()
            ->whereNull('archived_at')
            ->join('tasks', 'tasks.family_list_id', '=', 'family_lists.id')
            ->where('tasks.is_done', true)
            ->count();

        $sortFingerprint = FamilyList::query()
            ->whereNull('archived_at')
            ->orderBy('sort_order')
            ->orderByDesc('created_at')
            ->get(['id', 'sort_order', 'updated_at'])
            ->map(fn (FamilyList $list) => [
                'id' => $list->id,
                'sort_order' => $list->sort_order,
                'updated_at' => optional($list->updated_at)->timestamp,
            ])
            ->values();

        $version = sha1(json_encode([
            'lists_count' => $listsCount,
            'active_tasks_count' => $activeTasksCount,
            'done_tasks_count' => $doneTasksCount,
            'latest_list_updated_at' => optional($latestListUpdatedAt)->timestamp,
            'latest_list_created_at' => optional($latestListCreatedAt)->timestamp,
            'latest_task_updated_at' => optional($latestTaskUpdatedAt)->timestamp,
            'sort' => $sortFingerprint,
        ]));

        return response()->json([
            'version' => $version,
        ]);
    }
}
