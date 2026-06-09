<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\Auth;

class MagicLoginController extends Controller
{
    public function __invoke(string $token): RedirectResponse
    {
        $tokenHash = hash('sha256', $token);

        $user = User::query()
            ->where('magic_token_hash', $tokenHash)
            ->firstOrFail();

        Auth::login($user, remember: true);

        $user->forceFill([
            'last_login_at' => now(),
        ])->save();

        request()->session()->regenerate();

        return redirect()->route('home');
    }
}
