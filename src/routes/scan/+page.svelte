<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { Html5QrcodeScanner } from 'html5-qrcode';
  import { fade, fly } from 'svelte/transition';

  let scanner: Html5QrcodeScanner | null = null;
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
    if (decodedText.startsWith('order_complete:') && !isLoading && !showSuccess) {
      const orderId = decodedText.split(':')[1];
      if (scanner) scanner.pause(true);
      await handleComplete(orderId);
    }
  }

  function onScanFailure(error: any) {}

  async function handleComplete(id: string) {
    isLoading = true;
    errorMessage = '';
    try {
      const response = await fetch('/api/orders/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: id })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Server error');
      }

      showSuccess = true;
    } catch (err: any) {
      errorMessage = err.message || '配達完了の報告に失敗しました。QRコードを確認してください。';
      if (scanner) scanner.resume();
    } finally {
      isLoading = false;
    }
  }

  function resetScanner() {
    showSuccess = false;
    if (scanner) scanner.resume();
  }
</script>

<div class="min-h-screen bg-pink-50/30 p-4 sm:p-8 animate-mesh flex items-center justify-center">
  <div class="max-w-md w-full space-y-8">
    <header class="text-center">
      <h1 class="text-3xl font-black text-stone-800 tracking-tight">配達完了スキャン</h1>
      <p class="text-stone-500 mt-2">受取人のQRコードをスキャンして完了報告を行ってください</p>
    </header>

    <main class="campus-card relative">
      <div id="reader" class="overflow-hidden rounded-xl border-2 border-stone-100"></div>
      
      {#if isLoading}
        <div class="absolute inset-0 bg-white/80 backdrop-blur-sm flex items-center justify-center rounded-2xl z-20">
          <div class="text-center space-y-3">
            <svg class="animate-spin h-10 w-10 text-pink-500 mx-auto" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <p class="text-sm font-bold text-stone-600">処理中...</p>
          </div>
        </div>
      {/if}

      {#if errorMessage}
        <p class="mt-4 text-red-500 text-xs font-bold text-center" transition:fade>{errorMessage}</p>
      {/if}
    </main>
  </div>

  {#if showSuccess}
    <div class="fixed inset-0 bg-stone-900/60 backdrop-blur-md flex items-center justify-center z-50 p-6" in:fade>
      <div class="campus-card max-w-sm w-full text-center space-y-6" in:fly={{ y: 20 }}>
        <div class="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <div>
          <h2 class="text-2xl font-black text-stone-800">配達完了！</h2>
          <p class="text-stone-500 mt-2">お疲れ様でした。謝礼の支払いが確定しました。</p>
        </div>
        <button on:click={resetScanner} class="campus-button-primary w-full">
          閉じる
        </button>
      </div>
    </div>
  {/if}
</div>

<style>
  :global(#reader) {
    border: none !important;
  }
  :global(#reader video) {
    width: 100% !important;
    border-radius: 12px;
  }
</style>
