<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { Html5QrcodeScanner } from 'html5-qrcode';
  import { completeQuest } from '$lib/firebase/questStore';
  import { fade, fly } from 'svelte/transition';

  let scanner: Html5QrcodeScanner | null = null;
  let scanResult = '';
  let isLoading = false;
  let showSuccess = false;
  let errorMessage = '';

  onMount(() => {
    scanner = new Html5QrcodeScanner("reader", { 
      fps: 10, 
      qrbox: { width: 250, height: 250 },
      aspectRatio: 1.0
    }, false);
    
    scanner.render(onScanSuccess, onScanFailure);
  });

  onDestroy(() => {
    if (scanner) {
      scanner.clear().catch(error => console.error("Failed to clear scanner", error));
    }
  });

  async function onScanSuccess(decodedText: string) {
    if (decodedText.startsWith('quest_complete:') && !isLoading && !showSuccess) {
      const questId = decodedText.split(':')[1];
      scanResult = questId;
      
      if (scanner) {
        scanner.pause(true); // スキャンを一時停止
      }
      
      await handleComplete(questId);
    }
  }

  function onScanFailure(error: any) {
    // スキャン失敗時は何もしない（頻繁に発生するため）
  }

  async function handleComplete(id: string) {
    isLoading = true;
    errorMessage = '';
    try {
      const response = await fetch('/api/quests/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questId: id })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Server error');
      }

      showSuccess = true;
    } catch (err: any) {
      console.error(err);
      errorMessage = err.message || 'ギルドへの報告に失敗しました。紋章が正しいか確認してください。';
      if (scanner) scanner.resume();
    } finally {
      isLoading = false;
    }
  }

  function resetScanner() {
    showSuccess = false;
    scanResult = '';
    if (scanner) scanner.resume();
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
    <header class="mb-8 text-center uppercase tracking-tighter italic">
      <h1 class="text-3xl font-black text-amber-100 shadow-black drop-shadow-md">
        真実の眼 (スキャナー)
      </h1>
      <p class="text-[10px] text-amber-700 mt-2 font-mono tracking-[0.3em] uppercase opacity-80">Quest Verification Protocol</p>
    </header>

    <main class="bg-[#fdf6e3] border-[6px] border-[#8b5a2b] shadow-[0_30px_60px_rgba(0,0,0,0.6)] rounded-sm p-4 sm:p-6 relative text-center">
      <!-- Decorative Nails -->
      <div class="absolute top-1 left-1 w-3 h-3 bg-[#5d3a1a] rounded-full shadow-inner ring-1 ring-amber-900/50"></div>
      <div class="absolute top-1 right-1 w-3 h-3 bg-[#5d3a1a] rounded-full shadow-inner ring-1 ring-amber-900/50"></div>
      <div class="absolute bottom-1 left-1 w-3 h-3 bg-[#5d3a1a] rounded-full shadow-inner ring-1 ring-amber-900/50"></div>
      <div class="absolute bottom-1 right-1 w-3 h-3 bg-[#5d3a1a] rounded-full shadow-inner ring-1 ring-amber-900/50"></div>

      <div class="space-y-6">
        <p class="text-xs font-bold text-amber-900/70 uppercase tracking-widest italic">
          依頼主の紋章（QRコード）を読み取れ
        </p>

        <!-- Scanner Container -->
        <div class="relative overflow-hidden rounded-lg bg-black border-4 border-[#8b5a2b] shadow-inner">
          <div id="reader"></div>
          
          {#if isLoading}
            <div class="absolute inset-0 bg-black/60 flex items-center justify-center z-20" in:fade>
              <div class="text-white flex flex-col items-center space-y-3">
                <svg class="animate-spin h-10 w-10 text-amber-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span class="text-xs uppercase tracking-widest font-black">検証中...</span>
              </div>
            </div>
          {/if}
        </div>

        {#if errorMessage}
          <div class="p-3 bg-red-100 text-red-900 text-xs font-bold rounded border border-red-200" transition:fade>
            {errorMessage}
          </div>
        {/if}

        <div class="text-[9px] text-amber-900/40 uppercase font-mono tracking-widest">
          Node Alpha // Camera Access Required
        </div>
      </div>
    </main>
  </div>

  <!-- Success Announcement -->
  {#if showSuccess}
    <div 
      class="fixed inset-0 bg-black/95 flex items-center justify-center z-50 p-6 backdrop-blur-md"
      in:fade
      out:fade
    >
      <div 
        class="bg-[#fdf6e3] border-[10px] border-double border-amber-800 p-10 max-w-md w-full text-center shadow-[0_0_100px_rgba(251,191,36,0.1)] relative"
        in:fly={{ y: 50 }}
      >
        <div class="text-emerald-700 mb-6">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-24 w-24 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 class="text-3xl font-black mb-2 text-[#7b1818] uppercase tracking-tighter italic">クエスト完了！</h2>
        <p class="text-stone-700 leading-relaxed font-bold italic mb-8">
          真実が照明されました。<br>
          あなたの報酬はギルド本部に予約されました。
        </p>
        
        <button 
          on:click={resetScanner}
          class="w-full bg-amber-900 text-amber-100 py-4 font-bold uppercase tracking-widest shadow-lg hover:bg-amber-800 transition-colors"
        >
          次なる冒険へ
        </button>
      </div>
    </div>
  {/if}
</div>

<style>
  /* id="reader" 内の html5-qrcode スタイルを強引に調整 */
  :global(#reader) {
    border: none !important;
  }
  :global(#reader video) {
    width: 100% !important;
    height: auto !important;
    object-fit: cover !important;
  }
  :global(#reader__dashboard_section_csr button) {
    background-color: #8b5a2b !important;
    color: white !important;
    border: none !important;
    padding: 8px 16px !important;
    font-family: serif !important;
    text-transform: uppercase !important;
    font-weight: bold !important;
    margin-top: 10px !important;
  }
</style>
