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
      goto('/order'); // ログイン後は注文ページへ
    } catch (err) {
      console.error(err);
      error = '署名に失敗しました。魔力が不足しているか、通信が途絶えています。';
    } finally {
      isLoggingIn = false;
    }
  }
</script>

<div class="min-h-screen bg-[#2d0a0a] text-stone-900 font-serif p-4 sm:p-8 relative overflow-hidden flex items-center justify-center">
  <!-- Decorative Elements -->
  <div class="absolute top-10 left-10 text-amber-700/10 pointer-events-none transform -rotate-12">
    <svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
  </div>
  <div class="absolute bottom-10 right-10 text-amber-700/10 pointer-events-none transform rotate-12">
    <svg xmlns="http://www.w3.org/2000/svg" width="160" height="160" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
  </div>

  <div class="max-w-md w-full relative z-10 text-center">
    <header class="mb-10">
      <h1 class="text-4xl font-black text-amber-100 uppercase italic shadow-black drop-shadow-md tracking-tighter">
        ギルド入会所
      </h1>
      <p class="text-[10px] text-amber-700 mt-2 font-mono tracking-[0.4em] uppercase opacity-80 decoration-double underline underline-offset-4">契約の儀 / Registration</p>
    </header>

    <main class="bg-[#fdf6e3] border-[6px] border-[#8b5a2b] shadow-[0_30px_60px_rgba(0,0,0,0.6)] rounded-sm p-8 sm:p-12 relative overflow-hidden">
      <!-- Old Paper Texture effect overlay -->
      <div class="absolute inset-0 opacity-[0.03] pointer-events-none bg-[url('https://www.transparenttextures.com/patterns/pinstriped-suit.png')]"></div>
      
      <!-- Decorative Nails -->
      <div class="absolute top-2 left-2 w-3 h-3 bg-[#5d3a1a] rounded-full shadow-inner ring-1 ring-amber-900/50"></div>
      <div class="absolute top-2 right-2 w-3 h-3 bg-[#5d3a1a] rounded-full shadow-inner ring-1 ring-amber-900/50"></div>
      <div class="absolute bottom-2 left-2 w-3 h-3 bg-[#5d3a1a] rounded-full shadow-inner ring-1 ring-amber-900/50"></div>
      <div class="absolute bottom-2 right-2 w-3 h-3 bg-[#5d3a1a] rounded-full shadow-inner ring-1 ring-amber-900/50"></div>

      <div class="space-y-8 relative z-10">
        <div class="space-y-4">
          <p class="text-sm font-bold text-amber-900/80 leading-relaxed italic">
            「汝、ギルドの掟を遵守し、<br>
            誠実なる冒険を誓うか？」
          </p>
          <div class="h-px w-12 bg-amber-800/30 mx-auto"></div>
        </div>

        <div>
          <button
            on:click={handleLogin}
            disabled={isLoggingIn}
            class="group relative w-full bg-[#8b0000] hover:bg-[#a00000] active:bg-[#6b0000] p-6 rounded-sm text-amber-100 font-bold text-lg uppercase tracking-widest shadow-lg hover:shadow-xl transition-all duration-300 disabled:opacity-40"
          >
            {#if isLoggingIn}
              <span class="flex items-center justify-center space-x-3">
                <svg class="animate-spin h-5 w-5 text-amber-100" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span>契印中...</span>
              </span>
            {:else}
              魔法印 (Google) で署名する
            {/if}

            <!-- Sealing Wax Impression -->
            <div class="absolute -right-3 -bottom-3 w-12 h-12 bg-[#8b0000] rounded-full border-2 border-amber-900 shadow-lg flex items-center justify-center rotate-12 opacity-90 group-hover:scale-110 transition-transform">
              <span class="text-amber-900 font-bold text-lg">G</span>
            </div>
          </button>
        </div>

        {#if error}
          <p class="text-xs text-red-700 font-bold bg-red-50 p-2 border border-red-200" in:fade>
            {error}
          </p>
        {/if}

        <p class="text-[9px] text-stone-400 font-mono tracking-widest uppercase mt-10">
          Authorization required by the Supreme Council of Momoyama.
        </p>
      </div>
    </main>

    <footer class="mt-12 opacity-30">
      <p class="text-[9px] uppercase font-mono tracking-[0.3em] text-amber-100 italic">Established Anno Domini 1959</p>
    </footer>
  </div>
</div>
