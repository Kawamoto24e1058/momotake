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

<div class="min-h-screen animate-mesh relative overflow-hidden flex flex-col">
  <!-- Interactive Particles -->
  <div class="absolute inset-0 pointer-events-none overflow-hidden z-0">
    <div class="particle" style="--size: 80px; --tx: 100px; --ty: -300px; --duration: 25s; --delay: 0s; top: 90%; left: 10%;"></div>
    <div class="particle" style="--size: 150px; --tx: -200px; --ty: -400px; --duration: 35s; --delay: 5s; top: 80%; left: 80%;"></div>
    <div class="particle" style="--size: 60px; --tx: 50px; --ty: -200px; --duration: 20s; --delay: 10s; top: 70%; left: 30%;"></div>
  </div>

  <!-- Modern Glassmorphic Header -->
  <header class="sticky top-0 z-50 bg-white/40 backdrop-blur-md border-b border-white/30 px-6 py-4 shadow-sm">
    <div class="max-w-6xl mx-auto flex justify-between items-center">
      <a href="/" class="flex items-center space-x-3 group transition-transform active:scale-95">
        <div class="w-10 h-10 bg-gradient-to-br from-pink-400 to-orange-300 rounded-xl flex items-center justify-center shadow-lg transform group-hover:rotate-6 transition-all duration-300">
          <span class="text-white font-black text-xs">MT</span>
        </div>
        <div class="hidden sm:block">
          <span class="text-stone-800 font-bold tracking-tight text-xl">Momotake Portal</span>
        </div>
      </a>

      <nav class="flex items-center space-x-6">
        {#if $user}
          <div class="flex items-center space-x-4">
            <div class="text-right hidden sm:block">
              <span class="block text-[8px] text-pink-500 uppercase tracking-widest font-black leading-none mb-1">Adventurer</span>
              <span class="text-stone-700 font-bold text-sm">{$user.displayName}</span>
            </div>
            {#if $user.photoURL}
              <img src={$user.photoURL} alt="Profile" class="w-9 h-9 rounded-full border-2 border-white/50 shadow-sm" />
            {/if}
            <button
              on:click={signOutUser}
              class="bg-stone-200/50 hover:bg-stone-200 text-stone-600 px-4 py-2 rounded-xl text-xs font-bold transition-all"
            >
              Sign out
            </button>
          </div>
        {:else}
          <a
            href="/login"
            class="bg-gradient-to-r from-pink-400 to-orange-300 text-white px-6 py-2.5 rounded-2xl text-sm font-bold shadow-lg hover:shadow-pink-200/50 hover:scale-105 active:scale-95 transition-all duration-300"
          >
            Sign in
          </a>
        {/if}
      </nav>
    </div>
  </header>

  <!-- Page Content -->
  <main class="flex-grow z-10">
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
