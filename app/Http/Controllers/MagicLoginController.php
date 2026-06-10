<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\Auth;

/**
 * Контроллер для авторизации пользователя по одноразовой магической ссылке.
 *
 * Получает открытый токен из URL, сравнивает его хеш с сохранённым значением
 * у пользователя и выполняет вход без ввода пароля.
 */
class MagicLoginController extends Controller
{
    /**
     * Авторизует пользователя по токену магической ссылки.
     *
     * Хеширует переданный токен, находит пользователя с таким хешем,
     * выполняет вход с запоминанием сессии, обновляет дату последнего входа
     * и перенаправляет пользователя на главную страницу.
     */
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
