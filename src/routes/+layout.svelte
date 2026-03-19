<script lang="ts">
  import '../app.css';
  import { auth, user, loading } from '$lib/firebase/authStore';
  import { signOut } from 'firebase/auth';
  import { fade, fly } from 'svelte/transition';
  import { page } from '$app/stores';
  import { browser } from '$app/environment';
  import { goto } from '$app/navigation';

  // ログインループ防止: 認証初期化を待ってから未ログインなら飛ばす
  $: if (browser && !$loading && !$user && $page.url.pathname !== '/login') {
    goto('/login');
  }

  async function handleLogout() {
    await signOut(auth);
  }
</script>

{#if $loading}
  <div class="fixed inset-0 bg-white flex items-center justify-center z-[9999]">
    <div class="animate-pulse flex flex-col items-center space-y-4">
      <div class="w-12 h-12 bg-pink-200 rounded-full"></div>
      <p class="text-xs font-bold text-stone-400 uppercase tracking-widest">Initializing...</p>
    </div>
  </div>
{:else}
<div class="bg-blobs">
  <div class="blob w-[600px] h-[600px] -top-20 -left-20" style="--duration: 20s; --tx: 100px; --ty: 150px;"></div>
  <div class="blob w-[500px] h-[500px] top-1/2 -right-20" style="--duration: 25s; --tx: -120px; --ty: -100px;"></div>
  <div class="blob w-[400px] h-[400px] -bottom-20 left-1/4" style="--duration: 18s; --tx: 80px; --ty: -80px;"></div>
</div>

<div class="min-h-screen flex flex-col font-sans text-stone-800 relative z-10">
  <!-- Nav Header -->
  <header class="sticky top-0 z-50 bg-white/70 backdrop-blur-md border-b border-pink-100 px-6 py-4 flex justify-between items-center">
    <a href="/" class="flex items-center space-x-2 group">
      <div class="w-8 h-8 bg-gradient-to-br from-pink-400 to-orange-400 rounded-lg shadow-lg flex items-center justify-center text-white transform group-hover:rotate-12 transition-transform">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
          <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" />
        </svg>
      </div>
      <span class="text-xl font-black tracking-tighter text-stone-800">Campus Hub</span>
    </a>

    <nav class="flex items-center space-x-4">
      {#if $user}
        <button 
          on:click={handleLogout}
          class="text-xs font-bold text-stone-400 hover:text-stone-600 transition-colors uppercase tracking-widest"
        >
          Logout
        </button>
        <div class="w-10 h-10 rounded-full border-2 border-pink-100 overflow-hidden bg-white shadow-sm">
          <img src={$user.photoURL || `https://ui-avatars.com/api/?name=${$user.displayName}`} alt="Avatar" class="w-full h-full object-cover" />
        </div>
      {:else}
        <a href="/login" class="campus-button-primary py-2 px-5 text-sm">
          Login
        </a>
      {/if}
    </nav>
  </header>

  <main class="flex-grow">
    <slot />
  </main>

  <footer class="p-8 text-center text-stone-400 text-[10px] uppercase tracking-[0.3em]">
    &copy; 2026 Campus Hub // Support local student crew
  </footer>
</div>
{/if}
