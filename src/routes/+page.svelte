<script lang="ts">
  import { fade, fly } from 'svelte/transition';
</script>

<svelte:head>
  <title>Momotake Guild | 聖ペテロのギルド掲示板</title>
</svelte:head>

<div class="min-h-[calc(100vh-80px)] bg-[#2d0a0a] flex items-center justify-center p-6 sm:p-12 relative overflow-hidden">
  <!-- Decorative Background Elements -->
  <div class="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none bg-[url('https://www.transparenttextures.com/patterns/pinstriped-suit.png')]"></div>
  
  <div class="max-w-2xl w-full relative z-10 text-center space-y-12">
    <div class="space-y-4" in:fade={{ duration: 1000 }}>
      <p class="text-amber-700 font-mono tracking-[0.5em] uppercase text-xs opacity-80">Ancient Order of St. Andrew</p>
      <h1 class="text-5xl sm:text-7xl font-black text-amber-100 italic tracking-tighter drop-shadow-[0_10px_10px_rgba(0,0,0,0.5)]">
        MOMOTAKE<br>GUILD
      </h1>
      <div class="w-24 h-1 bg-amber-800 mx-auto rounded-full mt-6"></div>
    </div>

    <div class="bg-[#fdf6e3] border-[10px] border-double border-[#8b5a2b] p-8 sm:p-12 shadow-[0_30px_60px_rgba(0,0,0,0.7)] rounded-sm transform -rotate-1" in:fly={{ y: 50, delay: 500, duration: 800 }}>
      <h2 class="text-2xl font-black text-[#7b1818] uppercase italic mb-6">冒険の地、桃山へ</h2>
      <p class="text-stone-700 leading-relaxed font-bold italic mb-10 text-lg">
        「何かを買ってきてほしい」「重い荷物を運んでほしい」<br class="hidden sm:block">
        ギルドは、あなたの依頼と、勇敢なる冒険者たちを繋ぐ場所。
      </p>
      
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <a 
          href="/order" 
          class="bg-amber-900 text-amber-100 py-5 px-8 font-black uppercase tracking-widest text-sm shadow-xl hover:bg-amber-800 transition-all hover:-translate-y-1 active:translate-y-0"
        >
          クエストを依頼する
        </a>
        <a 
          href="/quests" 
          class="bg-stone-200 text-stone-900 border-4 border-amber-900/20 py-5 px-8 font-black uppercase tracking-widest text-sm shadow-xl hover:bg-white transition-all hover:-translate-y-1 active:translate-y-0"
        >
          掲示板を見る
        </a>
      </div>
    </div>

    <p class="text-amber-100/30 text-[10px] font-mono tracking-widest uppercase" in:fade={{ delay: 1500 }}>
      Momotake Guild System // Final Version 1.0.0
    </p>
  </div>
</div>

<style>
  /* 異世界の羊皮紙風の背景パターンを少し追加 */
  div {
    font-family: 'Times New Roman', Times, serif;
  }
</style>
