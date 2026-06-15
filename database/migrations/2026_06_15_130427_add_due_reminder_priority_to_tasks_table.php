<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('tasks', function (Blueprint $table) {
            $table->timestamp('due_at')->nullable()->after('note');
            $table->timestamp('remind_at')->nullable()->after('due_at');
            $table->string('priority', 20)->default('normal')->after('remind_at');
            $table->timestamp('reminder_sent_at')->nullable()->after('completed_at');
            $table->index(['remind_at', 'reminder_sent_at', 'is_done']);
        });
    }

    public function down(): void
    {
        Schema::table('tasks', function (Blueprint $table) {
            $table->dropIndex(['remind_at', 'reminder_sent_at', 'is_done']);
            $table->dropColumn(['due_at', 'remind_at', 'priority', 'reminder_sent_at']);
        });
    }
};
