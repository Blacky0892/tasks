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

        $user = User::query()->create([
            'name' => $name,
            'email' => $email,
            'password' => Hash::make(Str::random(40)),
            'magic_token_hash' => hash('sha256', $plainToken),
            'avatar_color' => fake()->hexColor(),
        ]);

        $this->info('Пользователь создан: ' . $user->name);
        $this->newLine();

        $this->line('Magic-ссылка:');
        $this->line(url('/magic/' . $plainToken));

        return self::SUCCESS;
    }
}
