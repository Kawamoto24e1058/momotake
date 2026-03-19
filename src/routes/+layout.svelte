<script lang="ts">
  import '../app.css';
  import { onMount } from 'svelte';
  import { auth } from '$lib/firebase/firebase';
  import { onAuthStateChanged } from 'firebase/auth';
  import { user, signOutUser } from '$lib/firebase/authStore';
  import { fade } from 'svelte/transition';

  onMount(() => {
    // 認証状態の監視を開始
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      user.set(firebaseUser);
    });

    return () => unsubscribe();
  });
</script>

<div class="flex flex-col min-h-screen font-serif">
  <!-- Guild Header Bar -->
  <header class="bg-[#1a0f0f] border-b-4 border-[#8b5a2b] p-4 sticky top-0 z-50 shadow-2xl">
    <div class="max-w-6xl mx-auto flex justify-between items-center">
      <a href="/" class="flex items-center space-x-3 group">
        <div class="w-10 h-10 bg-[#8b0000] rounded-full border-2 border-amber-700 flex items-center justify-center shadow-lg group-hover:rotate-12 transition-transform">
          <span class="text-amber-100 font-black text-xs">MT</span>
        </div>
        <div class="hidden sm:block">
          <span class="text-amber-100 font-black tracking-tighter text-xl uppercase italic drop-shadow-md">Momotake Guild</span>
        </div>
      </a>

      <nav class="flex items-center space-x-6">
        {#if $user}
          <div class="flex items-center space-x-4">
            <div class="text-right hidden sm:block">
              <span class="block text-[8px] text-amber-700 uppercase tracking-widest font-black leading-none mb-1">冒険者</span>
              <span class="text-amber-100 font-bold text-sm">{$user.displayName}</span>
            </div>
            {#if $user.photoURL}
              <img src={$user.photoURL} alt="Profile" class="w-8 h-8 rounded-full border-2 border-amber-800 shadow-inner" />
            {/if}
            <button
              on:click={signOutUser}
              class="text-amber-700 hover:text-amber-100 text-xs uppercase font-black tracking-widest border-l border-amber-900/50 pl-4 transition-colors"
            >
              辞世 (Logout)
            </button>
          </div>
        {:else}
          <a
            href="/login"
            class="bg-amber-900 text-amber-100 px-6 py-2 rounded-sm text-xs font-black uppercase tracking-widest hover:bg-amber-800 transition-colors shadow-lg"
          >
            署名 (Login)
          </a>
        {/if}
      </nav>
    </div>
  </header>

  <!-- Page Content -->
  <main class="flex-grow">
    <slot />
  </main>
</div>

<style>
  :global(body) {
    background-color: #2d0a0a;
    margin: 0;
    padding: 0;
  }
</style>
