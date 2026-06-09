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
            'title' => ['required', 'string', 'max:255'],
        ]);

        $maxSortOrder = $list->tasks()
            ->where('is_done', false)
            ->max('sort_order');

        $list->tasks()->create([
            'title' => $validated['title'],
            'sort_order' => ((int) $maxSortOrder) + 1,
            'created_by' => $request->user()->id,
        ]);

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
}
