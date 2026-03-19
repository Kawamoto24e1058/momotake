<script lang="ts">
  import { user } from '$lib/firebase/authStore';
  import { fade, fly, scale } from 'svelte/transition';
  import { elasticOut } from 'svelte/easing';
</script>

<svelte:head>
  <title>桃山学院 冒険者ギルド | ギルド本部</title>
</svelte:head>

<div class="min-h-[calc(100vh-80px)] flex items-center justify-center p-6 sm:p-12 relative font-sans">
  <div class="max-w-3xl w-full relative z-10 text-center space-y-12">
    <!-- Main Title Section -->
    <div class="space-y-4" in:fade={{ duration: 1200 }}>
      <p class="text-pink-600 font-bold tracking-[0.4em] uppercase text-[10px] sm:text-xs">Exploring the Twilight City</p>
      <h1 class="text-6xl sm:text-8xl font-black text-stone-800 tracking-tighter">
        MOMOTAKE<br><span class="text-transparent bg-clip-text bg-gradient-to-r from-pink-500 to-orange-400">PORTAL</span>
      </h1>
    </div>

    <!-- Content Panel -->
    {#if $user}
      <div 
        class="bg-white/50 backdrop-blur-md border border-white/30 p-10 sm:p-14 shadow-2xl rounded-[2rem] relative overflow-hidden"
        in:fly={{ y: 50, duration: 1000, easing: elasticOut }}
      >
        <div class="absolute -top-10 -right-10 w-40 h-40 bg-pink-200/30 rounded-full blur-3xl"></div>
        <div class="absolute -bottom-10 -left-10 w-40 h-40 bg-orange-200/30 rounded-full blur-3xl"></div>

        <h2 class="text-2xl font-bold text-stone-800 mb-8 relative z-10">
          Welcome back, <span class="text-pink-600 italic">{$user.displayName}</span>
        </h2>
        
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-8 relative z-10">
          <a 
            href="/quests" 
            class="group flex flex-col items-center justify-center bg-white/40 border border-white/50 p-8 rounded-2xl hover:bg-white/60 transition-all hover:scale-105 shadow-sm"
          >
            <div class="w-14 h-14 bg-stone-100 rounded-2xl mb-4 shadow-inner flex items-center justify-center group-hover:bg-pink-50 transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8 text-pink-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </div>
            <span class="font-bold text-stone-800 text-lg">Find Quests</span>
            <span class="text-[10px] text-stone-400 mt-1 font-bold uppercase tracking-widest">Portal Board</span>
          </a>

          <a 
            href="/order" 
            class="group flex flex-col items-center justify-center bg-gradient-to-br from-pink-400 to-orange-300 p-8 rounded-2xl hover:scale-105 shadow-xl transition-all text-white"
          >
            <div class="w-14 h-14 bg-white/20 rounded-2xl mb-4 flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
              </svg>
            </div>
            <span class="font-bold text-lg">Request Order</span>
            <span class="text-[10px] text-white/70 mt-1 font-bold uppercase tracking-widest">Post a Job</span>
          </a>
        </div>
      </div>
    {:else}
      <div 
        class="bg-white/50 backdrop-blur-md border border-white/30 p-10 sm:p-14 shadow-2xl rounded-[2rem] text-center"
        in:fly={{ y: 50, duration: 1000 }}
      >
        <h2 class="text-3xl font-bold text-stone-800 mb-6">Join the Community</h2>
        <p class="text-stone-500 font-medium mb-10 text-lg leading-relaxed max-w-sm mx-auto">
          Sign in with your Momotake credentials to access the guild's secret portal.
        </p>
        
        <a 
          href="/login" 
          class="inline-block bg-gradient-to-r from-pink-400 to-orange-300 text-white py-5 px-14 rounded-2xl font-bold shadow-lg hover:shadow-pink-200/50 hover:scale-105 active:scale-95 transition-all duration-300"
        >
          Sign in with Portal
        </a>
      </div>
    {/if}

    <p class="text-stone-400 text-[10px] font-bold tracking-[0.4em] uppercase" in:fade={{ delay: 1800 }}>
      Twilight Portal Infrastructure // Node Alpha
    </p>
  </div>
</div>

<style>
  /* Standard modern sans-serif */
  :global(body) {
    font-family: 'Inter', 'Noto Sans JP', -apple-system, sans-serif;
  }
  
  div {
    font-family: 'Times New Roman', Times, serif;
  }
</style>
