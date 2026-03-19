<script lang="ts">
  import { signInWithGoogle } from '$lib/firebase/authStore';
  import { goto } from '$app/navigation';
  import { fade, fly } from 'svelte/transition';

  let isLoggingIn = false;
  let error = '';

  async function handleLogin() {
    isLoggingIn = true;
    error = '';
    try {
      await signInWithGoogle();
      goto('/'); // ログイン後はトップへ
    } catch (err) {
      console.error(err);
      error = 'ログインに失敗しました。通信環境を確認してください。';
    } finally {
      isLoggingIn = false;
    }
  }
</script>

<div class="min-h-screen bg-pink-50/20 p-4 sm:p-8 animate-mesh flex items-center justify-center">
  <div class="max-w-md w-full space-y-10 text-center">
    <header class="space-y-4" in:fly={{ y: -20 }}>
      <div class="w-16 h-16 bg-gradient-to-br from-pink-400 to-orange-400 rounded-2xl shadow-xl flex items-center justify-center text-white mx-auto transform rotate-6">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-10 w-10" viewBox="0 0 20 20" fill="currentColor">
          <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3.005 3.005 0 013.75-2.906z" />
        </svg>
      </div>
      <div class="space-y-1">
        <h1 class="text-4xl font-black text-stone-800 tracking-tighter">Campus Hub</h1>
        <p class="text-stone-500 font-bold uppercase tracking-[0.2em] text-[10px]">Student Support Platform</p>
      </div>
    </header>

    <main class="campus-card space-y-8" in:fade={{ delay: 200 }}>
      <div class="space-y-2">
        <h2 class="text-xl font-bold text-stone-800">さあ、始めましょう</h2>
        <p class="text-sm text-stone-500">大学アカウント（Google）で安全にログインできます</p>
      </div>

      <button
        on:click={handleLogin}
        disabled={isLoggingIn}
        class="campus-button-primary w-full py-4 flex items-center justify-center space-x-3 disabled:opacity-50"
      >
        {#if isLoggingIn}
          <svg class="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <span>認証中...</span>
        {:else}
          <svg class="w-5 h-5" viewBox="0 0 24 24">
            <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
            <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
            <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
            <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
          </svg>
          <span>Googleでログイン</span>
        {/if}
      </button>

      {#if error}
        <p class="text-xs text-red-500 font-bold" in:fade>{error}</p>
      {/if}

      <div class="pt-4">
        <p class="text-[9px] text-stone-400 uppercase tracking-widest leading-relaxed">
          By logging in, you agree to connect<br>with your campus community safely.
        </p>
      </div>
    </main>

    <footer class="text-stone-300 transform scale-75">
      <p class="text-xs font-bold uppercase tracking-[0.4em]">Campus Hub Protocol v2.0</p>
    </footer>
  </div>
</div>
