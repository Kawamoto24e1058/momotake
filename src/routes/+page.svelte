<script lang="ts">
  import { user } from '$lib/firebase/authStore';
  import { fade, fly, scale } from 'svelte/transition';
  import { elasticOut } from 'svelte/easing';
</script>

<svelte:head>
  <title>桃山学院 冒険者ギルド | ギルド本部</title>
</svelte:head>

<div class="min-h-[calc(100vh-80px)] bg-[#2d0a0a] flex items-center justify-center p-6 sm:p-12 relative overflow-hidden font-serif">
  <!-- Decorative Background Elements -->
  <div class="absolute inset-0 opacity-10 pointer-events-none bg-[url('https://www.transparenttextures.com/patterns/pinstriped-suit.png')]"></div>
  
  <div class="max-w-3xl w-full relative z-10 text-center space-y-16">
    <!-- Main Title Section -->
    <div class="space-y-4" in:fade={{ duration: 1200 }}>
      <p class="text-amber-700 font-mono tracking-[0.6em] uppercase text-[10px] opacity-80 decoration-double underline underline-offset-8 mb-4">Official Guild Hub</p>
      <h1 class="text-6xl sm:text-8xl font-black text-amber-100 italic tracking-tighter drop-shadow-[0_15px_15px_rgba(0,0,0,0.6)]">
        桃山学院<br><span class="text-4xl sm:text-5xl block mt-2 opacity-90">冒険者ギルド</span>
      </h1>
      <div class="w-32 h-1 bg-amber-800 mx-auto rounded-full mt-8 shadow-inner"></div>
    </div>

    <!-- Content Panel -->
    {#if $user}
      <div 
        class="bg-[#fdf6e3] border-[10px] border-double border-[#8b5a2b] p-10 sm:p-14 shadow-[0_40px_80px_rgba(0,0,0,0.8)] rounded-sm relative"
        in:fly={{ y: 50, duration: 1000, easing: elasticOut }}
      >
        <!-- Decorative Seal -->
        <div class="absolute -top-10 left-1/2 -translate-x-1/2 w-20 h-20 bg-[#8b0000] rounded-full border-4 border-amber-600 shadow-2xl flex items-center justify-center rotate-12 z-20" in:scale={{ duration: 800, delay: 800 }}>
          <span class="text-amber-100 font-black text-2xl">M</span>
        </div>

        <h2 class="text-2xl font-black text-[#7b1818] uppercase italic mb-8 border-b-2 border-stone-200 pb-4">
          歓迎、冒険者 {$user.displayName} 殿
        </h2>
        
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-8">
          <a 
            href="/quests" 
            class="group relative flex flex-col items-center justify-center bg-stone-100 border-4 border-amber-900/10 p-8 hover:bg-white transition-all hover:scale-105 shadow-md"
          >
            <div class="w-12 h-12 bg-[#8b0000] rounded-full mb-4 shadow-lg group-hover:bg-[#a00000] flex items-center justify-center transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-amber-100" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <span class="font-black text-stone-900 uppercase tracking-widest text-lg italic">クエストを探す</span>
            <span class="text-[9px] text-stone-400 mt-1 uppercase font-mono tracking-tighter">Guild Board</span>
          </a>

          <a 
            href="/order" 
            class="group relative flex flex-col items-center justify-center bg-amber-900 border-4 border-amber-700/50 p-8 hover:bg-amber-800 transition-all hover:scale-105 shadow-xl text-amber-100"
          >
            <div class="w-12 h-12 bg-amber-100 rounded-full mb-4 shadow-lg flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-[#8b0000]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
              </svg>
            </div>
            <span class="font-black uppercase tracking-widest text-lg italic">ギルドに依頼</span>
            <span class="text-[9px] text-amber-100/50 mt-1 uppercase font-mono tracking-tighter">New Quest Order</span>
          </a>
        </div>
      </div>
    {:else}
      <div 
        class="bg-[#fdf6e3] border-[10px] border-double border-[#8b5a2b] p-10 sm:p-14 shadow-[0_40px_80px_rgba(0,0,0,0.8)] rounded-sm text-center"
        in:fly={{ y: 50, duration: 1000 }}
      >
        <div class="mb-8">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-16 w-16 mx-auto text-amber-900/20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 00-2 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        </div>
        <h2 class="text-3xl font-black text-[#7b1818] uppercase italic mb-6 leading-tight">未入会の冒険者よ</h2>
        <p class="text-stone-700 font-bold italic mb-10 text-lg leading-relaxed">
          ギルドの掲示板を見るには、<br class="hidden sm:block">
          魔法印（Google）による契約の儀が必要です。
        </p>
        
        <a 
          href="/login" 
          class="inline-block bg-amber-900 text-amber-100 py-5 px-12 font-black uppercase tracking-[0.3em] text-sm shadow-2xl hover:bg-amber-800 transition-all hover:scale-105 active:scale-95"
        >
          ギルド入会 (Login)
        </a>
      </div>
    {/if}

    <p class="text-amber-100/30 text-[10px] font-mono tracking-[0.5em] uppercase" in:fade={{ delay: 1800 }}>
      Momotake Guild Administrative Hub // Node Alpha
    </p>
  </div>
</div>

<style>
  div {
    font-family: 'Times New Roman', Times, serif;
  }
</style>
