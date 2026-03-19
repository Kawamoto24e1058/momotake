<script lang="ts">
  import { locations } from '$lib/constants/locations';
  import { calculateDistance, calculateReward } from '$lib/utils/distance';
  import { createQuest } from '$lib/firebase/questStore';
  import { fade, fly } from 'svelte/transition';

  let pickupId = '';
  let dropoffId = '';
  let itemPrice = 0;
  let isSubmitting = false;
  let showSuccess = false;

  // 選択された場所自体のオブジェクト
  $: pickup = locations.find((l) => l.id === pickupId);
  $: dropoff = locations.find((l) => l.id === dropoffId);

  // 距離と報酬の計算
  $: distance = (pickup && dropoff) ? calculateDistance(pickup.lat, pickup.lng, dropoff.lat, dropoff.lng) : 0;
  $: reward = distance > 0 ? calculateReward(distance) : 0;

  /**
   * クエストを依頼（Firestoreに一時保存し、Stripeへリダイレクト）します。
   */
  async function handleSubmit() {
    if (!pickupId || !dropoffId || isSubmitting) return;

    isSubmitting = true;
    try {
      // 1. まずはステータス「支払い待ち」でクエストを作成
      const questData = {
        clientId: 'test-user-client-123', // 本来は認証ユーザーID
        walkerId: null,
        status: 'pending_payment' as const,
        pickupLocationId: pickupId,
        dropoffLocationId: dropoffId,
        reward: reward,
        itemPrice: itemPrice
      };
      
      const newQuestId = await createQuest(questData);

      // 2. Stripe Checkout セッションを作成
      const response = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          questId: newQuestId,
          title: `クエスト報酬: ${pickup?.name} ➔ ${dropoff?.name}`,
          amount: reward // 日本円（整数）
        })
      });

      const { url, error } = await response.json();
      
      if (error) throw new Error(error);

      // 3. Stripe 決済画面へ遷移
      if (url) {
        window.location.href = url;
      }
    } catch (err) {
      console.error(err);
      alert('契約魔法の儀式（決済準備）に失敗しました。魔力が不足している可能性があります。');
    } finally {
      isSubmitting = false;
    }
  }

  function resetForm() {
    pickupId = '';
    dropoffId = '';
    itemPrice = 0;
  }
</script>

<div class="min-h-screen bg-[#2d0a0a] text-stone-900 font-serif p-4 sm:p-8 relative overflow-hidden flex items-center justify-center">
  <!-- Decorative Elements: St. Peter's Crosses (Gold Crosses) -->
  <div class="absolute top-10 left-10 text-amber-700/10 pointer-events-none transform -rotate-12">
    <svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
  </div>
  <div class="absolute bottom-10 right-10 text-amber-700/10 pointer-events-none transform rotate-12">
    <svg xmlns="http://www.w3.org/2000/svg" width="160" height="160" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
  </div>
  <div class="absolute top-1/2 left-1/4 text-amber-700/5 pointer-events-none">
    <svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
  </div>

  <div class="max-w-md w-full relative z-10">
    <!-- Header -->
    <header class="mb-8 text-center">
      <h1 class="text-4xl font-black tracking-tight text-amber-100 uppercase italic drop-shadow-[0_2px_2px_rgba(0,0,0,0.8)]">
        クエスト発行所
      </h1>
      <p class="text-[10px] text-amber-700 mt-2 font-mono tracking-[0.4em] uppercase opacity-80 decoration-double underline underline-offset-4">Guild of St. Andrew</p>
    </header>

    <!-- Parchment Guild Board -->
    <main class="bg-[#fdf6e3] border-[6px] border-[#8b5a2b] shadow-[0_30px_60px_rgba(0,0,0,0.6)] rounded-sm p-6 sm:p-10 relative overflow-hidden">
      <!-- Old Paper Texture effect overlay -->
      <div class="absolute inset-0 opacity-[0.03] pointer-events-none bg-[url('https://www.transparenttextures.com/patterns/pinstriped-suit.png')]"></div>
      
      <!-- Decorative Nails -->
      <div class="absolute top-2 left-2 w-3 h-3 bg-[#5d3a1a] rounded-full shadow-inner ring-1 ring-amber-900/50"></div>
      <div class="absolute top-2 right-2 w-3 h-3 bg-[#5d3a1a] rounded-full shadow-inner ring-1 ring-amber-900/50"></div>
      <div class="absolute bottom-2 left-2 w-3 h-3 bg-[#5d3a1a] rounded-full shadow-inner ring-1 ring-amber-900/50"></div>
      <div class="absolute bottom-2 right-2 w-3 h-3 bg-[#5d3a1a] rounded-full shadow-inner ring-1 ring-amber-900/50"></div>

      <div class="space-y-10 relative z-10">
        <!-- Location Selection -->
        <div class="space-y-8">
          <div class="group">
            <label for="pickup" class="block text-[10px] font-black text-amber-900/60 mb-2 uppercase tracking-[0.2em] border-l-2 border-amber-800 pl-2">
              【 買い出し地 】
            </label>
            <div class="relative">
              <select
                id="pickup"
                bind:value={pickupId}
                class="w-full bg-transparent border-b-2 border-stone-300 py-2 text-stone-900 focus:border-amber-700 focus:outline-none transition-all appearance-none cursor-pointer text-lg font-bold italic"
              >
                <option value="" disabled selected>聖なる地を選択せよ</option>
                {#each locations as loc}
                  <option value={loc.id}>{loc.name}</option>
                {/each}
              </select>
              <div class="absolute right-0 top-1/2 -translate-y-1/2 pointer-events-none opacity-40">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>
          </div>

          <div class="group">
            <label for="dropoff" class="block text-[10px] font-black text-amber-900/60 mb-2 uppercase tracking-[0.2em] border-l-2 border-amber-800 pl-2">
              【 配送先 】
            </label>
            <div class="relative">
              <select
                id="dropoff"
                bind:value={dropoffId}
                class="w-full bg-transparent border-b-2 border-stone-300 py-2 text-stone-900 focus:border-amber-700 focus:outline-none transition-all appearance-none cursor-pointer text-lg font-bold italic"
              >
                <option value="" disabled selected>届け先を記せ</option>
                {#each locations as loc}
                  <option value={loc.id}>{loc.name}</option>
                {/each}
              </select>
              <div class="absolute right-0 top-1/2 -translate-y-1/2 pointer-events-none opacity-40">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>
          </div>
        </div>

        <!-- Price Input -->
        <div class="bg-stone-100/50 p-4 rounded-lg border border-stone-200 shadow-inner">
          <label for="price" class="block text-[10px] font-black text-stone-500 mb-2 uppercase tracking-[0.2em]">
            【 想定代金（金貨換算） 】
          </label>
          <div class="flex items-center space-x-3">
            <span class="text-3xl font-bold text-stone-400">¥</span>
            <input
              id="price"
              type="number"
              inputmode="numeric"
              bind:value={itemPrice}
              placeholder="0"
              class="w-full bg-transparent border-b border-stone-300 text-stone-900 focus:border-amber-700 focus:outline-none transition-all text-4xl font-bold font-mono tracking-tighter"
            />
          </div>
        </div>

        <!-- Contract Details -->
        <div class="pt-2 border-t border-amber-900/10 mb-2">
          <div class="flex justify-between items-baseline mb-4">
            <span class="text-[10px] font-black text-stone-400 uppercase tracking-widest italic">旅路の距離</span>
            <span class="text-2xl font-black italic border-b-4 border-amber-700/20">{distance.toFixed(2)} <span class="text-xs non-italic font-normal">km</span></span>
          </div>
          <div class="flex justify-between items-center bg-amber-900/5 p-4 rounded-xl border border-amber-900/10">
            <span class="text-[10px] font-black text-amber-900/60 uppercase tracking-widest">提供される報酬</span>
            <span class="text-4xl font-black text-[#7b1818] tracking-tight drop-shadow-sm italic">
              <span class="text-lg mr-1 not-italic font-bold">¥</span>{reward.toLocaleString()}
            </span>
          </div>
        </div>

        <!-- Issue Button -->
        <div class="pt-4 relative">
          <button
            on:click={handleSubmit}
            disabled={!pickupId || !dropoffId || isSubmitting}
            class="group relative w-full bg-[#8b0000] hover:bg-[#a00000] active:bg-[#6b0000] p-6 rounded-sm text-amber-100 font-bold text-xl uppercase tracking-[0.1em] shadow-[0_10px_30px_rgba(0,0,0,0.4)] hover:shadow-[0_15px_40px_rgba(139,0,0,0.3)] hover:-translate-y-1 active:translate-y-1 transition-all duration-200 disabled:opacity-30 disabled:grayscale disabled:translate-y-0"
          >
            {#if isSubmitting}
              <span class="flex items-center justify-center space-x-3">
                <svg class="animate-spin h-5 w-5 text-amber-100" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span class="tracking-widest">刻印中...</span>
              </span>
            {:else}
              ギルドに依頼 (クエスト発行)
            {/if}

            <!-- Sealing Wax Impression (Visual) -->
            <div class="absolute -right-4 -bottom-4 w-14 h-14 bg-[#8b0000] rounded-full border-[3px] border-amber-900 shadow-2xl flex items-center justify-center rotate-[15deg] group-hover:rotate-[25deg] transition-transform duration-500 ring-2 ring-black/10">
              <div class="w-10 h-10 rounded-full border border-amber-900/30 flex items-center justify-center">
                <span class="text-amber-900/80 font-black text-2xl tracking-tighter mt-1">StP</span>
              </div>
            </div>
          </button>
        </div>
      </div>
    </main>

    <!-- Footer Decoration -->
    <footer class="mt-12 text-center">
      <div class="flex items-center justify-center space-x-4 opacity-30">
        <div class="h-px w-10 bg-amber-100"></div>
        <p class="text-[9px] uppercase font-mono tracking-[0.3em] text-amber-100 italic">Momotake Guild Protocol v1.0.4</p>
        <div class="h-px w-10 bg-amber-100"></div>
      </div>
    </footer>
  </div>

  <!-- Success Announcement (Sealed Letter Visual) -->
  {#if showSuccess}
    <div 
      class="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-6 backdrop-blur-sm"
      in:fade={{ duration: 300 }}
      out:fade={{ duration: 400 }}
    >
      <div 
        class="bg-[#fdf6e3] border-[10px] border-double border-amber-800 p-10 max-w-sm w-full text-center shadow-[0_0_100px_rgba(251,191,36,0.1)] relative"
        in:fly={{ y: 100, duration: 800, easing: (t) => t * (2 - t) }}
      >
        <!-- Corner decorations -->
        <div class="absolute top-2 left-2 text-amber-800/20"><svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0l3 9h9l-7 5 3 9-8-6-8 6 3-9-7-5h9z"/></svg></div>
        
        <div class="text-amber-900 mb-6">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-20 w-20 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        </div>
        <h2 class="text-3xl font-black mb-2 text-[#7b1818] uppercase tracking-tighter">依頼受理</h2>
        <div class="h-px w-20 bg-amber-800 mx-auto mb-4"></div>
        <p class="text-stone-700 leading-relaxed italic font-bold">
          神の導きにより、あなたの依頼が<br>
          ギルドの掲示板に刻まれました。
        </p>
        <div class="mt-8 text-[10px] text-amber-900/40 uppercase font-mono tracking-widest">Peace be with you.</div>
      </div>
    </div>
  {/if}
</div>

<style>
  /* 数値選択フィールドの矢印を非表示にする */
  input::-webkit-outer-spin-button,
  input::-webkit-inner-spin-button {
    -webkit-appearance: none;
    margin: 0;
  }
  input[type=number] {
    -moz-appearance: textfield;
    appearance: textfield;
  }

  /* セレクトボックスのデフォルトスタイルを上書き */
  select {
    -webkit-appearance: none;
    -moz-appearance: none;
    appearance: none;
    background-image: none;
  }
</style>
