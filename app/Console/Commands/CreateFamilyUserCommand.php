<?php

namespace App\Console\Commands;

use App\Models\User;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

class CreateFamilyUserCommand extends Command
{
    protected $signature = 'family:create-user {name} {email?}';

    protected $description = 'Create family user with magic login link';

    public function handle(): int
    {
        $name = $this->argument('name');

        $email = $this->argument('email') ?: Str::slug($name) . '@family.local';

        $plainToken = Str::random(80);

        $avatarColors = [
            '#ef4444',
            '#f97316',
            '#f59e0b',
            '#84cc16',
            '#22c55e',
            '#14b8a6',
            '#06b6d4',
            '#3b82f6',
            '#6366f1',
            '#8b5cf6',
            '#ec4899',
        ];

        $user = User::query()->create([
            'name' => $name,
            'email' => $email,
            'password' => Hash::make(Str::random(40)),
            'magic_token_hash' => hash('sha256', $plainToken),
            'avatar_color' => $avatarColors[array_rand($avatarColors)],
        ]);

        $this->info('Пользователь создан: ' . $user->name);
        $this->newLine();

        $this->line('Magic-ссылка:');
        $this->line(url('/magic/' . $plainToken));

        return self::SUCCESS;
    }
}
