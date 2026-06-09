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
        Schema::create('family_lists', function (Blueprint $table) {
            $table->id();
            $table->string('title');
            $table->string('emoji')->default('📝');
            $table->unsignedInteger('sort_order')->default(0);
            $table->foreignId('created_by')->constrained('users');
            $table->timestamp('archived_at')->nullable();
            $table->timestamps();
            $table->softDeletes();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('family_lists');
    }
};
