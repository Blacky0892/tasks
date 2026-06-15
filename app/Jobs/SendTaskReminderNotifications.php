<?php

namespace App\Jobs;

use App\Models\Task;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class SendTaskReminderNotifications implements ShouldQueue
{
    use Queueable;

    public function handle(): void
    {
        Task::query()
            ->with(['creator.pushSubscriptions', 'familyList'])
            ->where('is_done', false)
            ->whereNotNull('remind_at')
            ->whereNull('reminder_sent_at')
            ->where('remind_at', '<=', now())
            ->chunkById(100, function ($tasks) {
                foreach ($tasks as $task) {
                    $this->sendTaskReminder($task);
                    $task->forceFill(['reminder_sent_at' => now()])->save();
                }
            });
    }

    private function sendTaskReminder(Task $task): void
    {
        $payload = [
            'title' => 'Напоминание о задаче',
            'body' => $task->title,
            'url' => route('lists.show', $task->family_list_id, false),
            'tag' => 'task-'.$task->id,
            'task_id' => $task->id,
            'list_title' => $task->familyList?->title,
        ];

        foreach ($task->creator?->pushSubscriptions ?? [] as $subscription) {
            try {
                Http::timeout(5)->post($subscription->endpoint, $payload);
            } catch (\Throwable $exception) {
                Log::warning('Task reminder push failed.', [
                    'task_id' => $task->id,
                    'subscription_id' => $subscription->id,
                    'message' => $exception->getMessage(),
                ]);
            }
        }
    }
}
