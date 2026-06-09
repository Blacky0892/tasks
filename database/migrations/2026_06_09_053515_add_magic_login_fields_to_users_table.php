<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('magic_token_hash')->nullable()->unique()->after('password');
            $table->timestamp('last_login_at')->nullable()->after('magic_token_hash');
            $table->string('avatar_color')->nullable()->after('last_login_at');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn([
                'magic_token_hash',
                'last_login_at',
                'avatar_color',
            ]);
        });
    }
};
