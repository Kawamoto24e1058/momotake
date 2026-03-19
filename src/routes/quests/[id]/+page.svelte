<script lang="ts">
  import { page } from '$app/stores';
  import { subscribeToQuest, updateQuestStatus } from '$lib/firebase/questStore';
  import { locations } from '$lib/constants/locations';
  import { onDestroy, onMount } from 'svelte';
  import type { Quest } from '$lib/types/quest';
  import QRCode from 'qrcode';
  import { fade, fly } from 'svelte/transition';

  const questId = $page.params.id;
  let quest: Quest | null = null;
  let qrCodeDataUrl = '';
  let unsubscribe: () => void;
  let showPaymentSuccessToast = false;

  $: pickup = quest ? locations.find(l => l.id === quest?.pickupLocationId) : null;
  $: dropoff = quest ? locations.find(l => l.id === quest?.dropoffLocationId) : null;

  // 決済成功時の自動更新
  $: if (quest && quest.status === 'pending_payment' && $page.url.searchParams.get('success') === 'true') {
    handlePaymentSuccess();
  }

  async function handlePaymentSuccess() {
    if (!questId) return;
    try {
      await updateQuestStatus(questId, 'open');
      showPaymentSuccessToast = true;
      setTimeout(() => showPaymentSuccessToast = false, 5000);
    } catch (err) {
      console.error('Failed to update quest status after payment:', err);
    }
  }

  onMount(() => {
    if (questId) {
      unsubscribe = subscribeToQuest(questId, (data) => {
        quest = data;
        if (quest && (quest.status === 'active' || quest.status === 'submitted')) {
          generateQR();
        }
      });
    }
  });

  onDestroy(() => {
    if (unsubscribe) unsubscribe();
  });

  onDestroy(() => {
    if (unsubscribe) unsubscribe();
  });

  async function generateQR() {
    try {
      qrCodeDataUrl = await QRCode.toDataURL(`quest_complete:${questId}`, {
        width: 300,
        margin: 2,
        color: {
          dark: '#2d0a0a',
          light: '#fdf6e3'
        }
      });
    } catch (err) {
      console.error('QR generation failed:', err);
    }
  }

  function getStatusText(status: string) {
    const map: Record<string, string> = {
      open: '冒険者募集中',
      active: '進行中',
      submitted: '配達完了・確認待ち',
      completed: '達成済み',
      canceled: '中止'
    };
    return map[status] || status;
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

  <div class="max-w-md w-full relative z-10">
    <header class="mb-6 text-center">
      <h1 class="text-3xl font-bold text-amber-100 uppercase italic shadow-black drop-shadow-md">
        クエスト詳細
      </h1>
      <p class="text-[10px] text-amber-700 mt-2 font-mono tracking-widest uppercase opacity-80 decoration-double underline underline-offset-4">Guild of St. Andrew</p>
    </header>

    {#if quest}
      <main class="bg-[#fdf6e3] border-[6px] border-[#8b5a2b] shadow-[0_20px_50px_rgba(0,0,0,0.5)] rounded-sm p-6 sm:p-8 relative" in:fade>
        <!-- Decorative Nails -->
        <div class="absolute top-1 left-1 w-3 h-3 bg-[#5d3a1a] rounded-full shadow-inner ring-1 ring-amber-900/50"></div>
        <div class="absolute top-1 right-1 w-3 h-3 bg-[#5d3a1a] rounded-full shadow-inner ring-1 ring-amber-900/50"></div>
        <div class="absolute bottom-1 left-1 w-3 h-3 bg-[#5d3a1a] rounded-full shadow-inner ring-1 ring-amber-900/50"></div>
        <div class="absolute bottom-1 right-1 w-3 h-3 bg-[#5d3a1a] rounded-full shadow-inner ring-1 ring-amber-900/50"></div>

        <div class="space-y-6">
          <!-- Status Tag -->
          <div class="flex justify-center">
            <span class="bg-amber-900 text-amber-100 px-4 py-1 text-xs font-bold uppercase tracking-widest rounded-full ring-2 ring-amber-700/50">
              {getStatusText(quest.status)}
            </span>
          </div>

          <!-- Locations -->
          <div class="border-b border-stone-200 pb-4 space-y-3">
            <div class="flex items-start space-x-3">
              <span class="text-[10px] font-black text-amber-900/50 uppercase pt-1">From:</span>
              <span class="text-xl font-bold">{pickup?.name || '不明な場所'}</span>
            </div>
            <div class="flex items-start space-x-3">
              <span class="text-[10px] font-black text-amber-900/50 uppercase pt-1">To:</span>
              <span class="text-xl font-bold">{dropoff?.name || '不明な場所'}</span>
            </div>
          </div>

          <!-- Reward & Price -->
          <div class="flex justify-between items-center py-2">
            <div>
              <span class="block text-[8px] text-stone-400 uppercase font-black tracking-widest">報酬</span>
              <span class="text-2xl font-black text-amber-900 italic">¥{quest.reward.toLocaleString()}</span>
            </div>
            <div class="text-right">
              <span class="block text-[8px] text-stone-400 uppercase font-black tracking-widest">代金目安</span>
              <span class="text-lg font-bold text-stone-600">¥{quest.itemPrice.toLocaleString()}</span>
            </div>
          </div>

          <!-- QR Code Area -->
          {#if quest.status === 'active' || quest.status === 'submitted'}
            <div class="py-6 flex flex-col items-center space-y-4 border-t-2 border-dashed border-stone-200" in:fly={{ y: 20 }}>
              <p class="text-sm font-bold text-center italic text-stone-600">
                冒険者にこの紋章（証）を提示せよ
              </p>
              {#if qrCodeDataUrl}
                <div class="p-4 bg-white border-4 border-[#8b5a2b] shadow-xl rotate-1">
                  <img src={qrCodeDataUrl} alt="Quest Completion QR" class="w-48 h-48" />
                </div>
              {:else}
                <div class="w-48 h-48 bg-stone-200 animate-pulse border-4 border-[#8b5a2b]"></div>
              {/if}
              <p class="text-[9px] text-amber-900/40 uppercase font-mono tracking-widest">Official Guild Seal : {quest.id}</p>
            </div>
          {:else if quest.status === 'completed'}
            <div class="py-10 text-center space-y-4 border-t-2 border-dashed border-stone-200" in:fade>
              <div class="text-emerald-700">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-16 w-16 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h2 class="text-2xl font-black text-[#7b1818] italic uppercase">クエスト達成！</h2>
              <p class="text-sm text-stone-500">この冒険は歴史に刻まれ、報酬が確定しました。</p>
            </div>
          {/if}
        </div>
      </main>
    {:else}
      <div class="text-center py-20 text-amber-100/50 animate-pulse">
        <p class="italic">ギルド文書を解析中...</p>
      </div>
    {/if}

    <footer class="mt-12 text-center opacity-40">
      <p class="text-[10px] uppercase font-mono tracking-[0.2em] text-amber-100/50">Momotake Guild System // Node Alpha</p>
    </footer>
  </div>

  <!-- Payment Success Toast -->
  {#if showPaymentSuccessToast}
    <div 
      class="fixed top-24 left-1/2 -translate-x-1/2 z-[60] w-[90%] max-w-sm"
      in:fly={{ y: -20, duration: 500 }}
      out:fade
    >
      <div class="bg-amber-100 border-4 border-[#8b5a2b] p-4 shadow-2xl relative overflow-hidden">
        <div class="absolute inset-0 opacity-5 pointer-events-none bg-[url('https://www.transparenttextures.com/patterns/pinstriped-suit.png')]"></div>
        <div class="flex items-center space-x-3 text-amber-900 relative z-10">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p class="text-xs font-black italic">ギルドに依頼金が預託されました。<br>冒険者を待とう！</p>
        </div>
      </div>
    </div>
  {/if}
</div>
