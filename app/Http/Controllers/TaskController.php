<?php

namespace App\Http\Controllers;

use App\Models\FamilyList;
use App\Models\Task;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;

class TaskController extends Controller
{
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

    public function destroy(Task $task): RedirectResponse
    {
        $task->delete();

        return back();
    }

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
