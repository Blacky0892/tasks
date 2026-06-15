<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

class Task extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'family_list_id',
        'title',
        'note',
        'due_at',
        'remind_at',
        'priority',
        'reminder_sent_at',
        'attachments',
        'sort_order',
        'is_done',
        'created_by',
        'completed_by',
        'completed_at',
    ];

    protected $casts = [
        'is_done' => 'boolean',
        'attachments' => 'array',
        'due_at' => 'datetime',
        'remind_at' => 'datetime',
        'completed_at' => 'datetime',
        'reminder_sent_at' => 'datetime',
    ];

    public function familyList(): BelongsTo
    {
        return $this->belongsTo(FamilyList::class);
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function completedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'completed_by');
    }
}
