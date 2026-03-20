<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { user } from '$lib/firebase/authStore';
  import { subscribeToOrder, updateOrderStatus, updateOrderReimbursement, approveOrderCost } from '$lib/firebase/orderStore';
  import { storage } from '$lib/firebase/firebase';
  import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
  import type { Order } from '$lib/types/order';
  import { fade, fly } from 'svelte/transition';
  import QRCode from 'qrcode';
  import { createWorker } from 'tesseract.js';
  import { calculatePlatformFee } from '$lib/utils/feeCalculator';

  let orderId = $page.params.id || '';
  let order: Order | null = null;
  let qrCodeUrl = '';
  let isLoading = true;

  // Reimbursement state
  let receiptFile: File | null = null;
  let isUploading = false;
  let isScanning = false;
  let inputActualCost = 0;
  let uploadError = '';

  onMount(() => {
    if (!orderId) return;
    return subscribeToOrder(orderId, (data) => {
      order = data;
      isLoading = false;
      if (order?.costApproved) {
        generateQR();
      }
    });
  });

  async function generateQR() {
    try {
      qrCodeUrl = await QRCode.toDataURL(`order_complete:${orderId}`);
    } catch (err) {
      console.error(err);
    }
  }

  async function handleTakeOrder() {
    if (!$user || !order || !orderId) return;
    await updateOrderStatus(orderId, 'active');
  }

  async function handleFileUpload(e: Event) {
    const target = e.target as HTMLInputElement;
    if (!target.files || target.files.length === 0) return;
    receiptFile = target.files[0];
    
    isUploading = true;
    isScanning = true;
    uploadError = '';

    try {
      // 1. Upload to Storage
      const storageRef = ref(storage, `orders/${orderId}/receipt_${Date.now()}.jpg`);
      await uploadBytes(storageRef, receiptFile);
      const url = await getDownloadURL(storageRef);

      // 2. OCR with Tesseract
      const worker = await createWorker('jpn');
      const { data: { text } } = await worker.recognize(receiptFile);
      await worker.terminate();

      // 3. Simple price extraction (regex for numbers)
      const matches = text.match(/[0-9,]{3,}/g);
      if (matches) {
        // Try to find the largest number which is often the total
        const prices = matches.map(m => parseInt(m.replace(/,/g, ''))).filter(p => p > 0);
        if (prices.length > 0) {
          inputActualCost = Math.max(...prices);
        }
      }

      // 4. Update Store
      await updateOrderReimbursement(orderId, inputActualCost, url);
    } catch (err: any) {
      uploadError = 'ファイルのアップロードまたはスキャンに失敗しました。';
      console.error(err);
    } finally {
      isUploading = false;
      isScanning = false;
    }
  }

  async function handleReimbursementSubmit() {
    if (!order || !order.receiptUrl) return;
    await updateOrderReimbursement(orderId, inputActualCost, order.receiptUrl);
  }

  async function handleApproveCost() {
    await approveOrderCost(orderId);
  }

  async function handleCapture() {
    if (!confirm('配達完了（決済確定）として処理しますか？')) return;
    
    isLoading = true;
    try {
      const res = await fetch('/api/stripe/capture', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId })
      });
      
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || '決済確定に失敗しました');
      }
      
      // ステータス更新は subscribeToOrder で検知されるが、念のため
      window.location.reload();
    } catch (err: any) {
      alert(err.message);
    } finally {
      isLoading = false;
    }
  }
</script>

<div class="min-h-screen p-4 sm:p-8 flex items-center justify-center relative overflow-hidden">
  <div class="max-w-xl w-full relative z-20">
    {#if isLoading}
      <div class="campus-card text-center py-20 animate-pulse">
        <p class="text-stone-400 font-bold uppercase tracking-widest">Loading order info...</p>
      </div>
    {:else if !order}
      <div class="campus-card text-center py-20">
        <h2 class="text-2xl font-black text-stone-800">404</h2>
        <p class="text-stone-500">依頼が見つかりませんでした。</p>
        <a href="/" class="text-pink-500 font-bold underline mt-4 block">トップに戻る</a>
      </div>
    {:else}
      <main class="campus-card space-y-8" in:fade>
        <header class="border-b border-stone-100 pb-6">
          <div class="flex justify-between items-start mb-2">
            <span class="text-[10px] font-black text-pink-400 uppercase tracking-[0.3em]">Order Details</span>
            <span class="text-xs px-2 py-1 rounded-full bg-stone-100 font-bold uppercase">{order.status}</span>
          </div>
          <h1 class="text-3xl font-black text-stone-800 tracking-tight leading-tight">{order.title}</h1>
        </header>

        <section class="grid grid-cols-2 gap-6">
          <div class="space-y-1">
            <p class="text-[9px] font-black text-stone-400 uppercase tracking-widest">謝礼金額</p>
            <p class="text-3xl font-black text-stone-800">¥{order.reward.toLocaleString()}</p>
          </div>
          {#if order.actualCost}
            <div class="space-y-1 text-right">
              <p class="text-[9px] font-black text-pink-400 uppercase tracking-widest">実費請求</p>
              <p class="text-3xl font-black text-pink-500">¥{order.actualCost.toLocaleString()}</p>
            </div>
          {/if}
        </section>

        <section class="space-y-4">
          <div class="bg-stone-50 p-4 rounded-xl space-y-3">
            <div class="flex items-center space-x-3">
              <div class="w-2 h-2 rounded-full bg-pink-400"></div>
              <p class="text-sm font-bold text-stone-700">集荷: <span class="font-normal text-stone-500">{order.pickupLocationName || '指定なし'}</span></p>
            </div>
            <div class="flex items-center space-x-3">
              <div class="w-2 h-2 rounded-full bg-orange-400"></div>
              <p class="text-sm font-bold text-stone-700">お届け: <span class="font-normal text-stone-500">{order.dropoffLocationName || '指定なし'}</span></p>
            </div>
          </div>
          
          <div class="p-4 border border-stone-100 rounded-xl bg-white/50">
            <p class="text-[9px] font-black text-stone-400 uppercase tracking-widest mb-2">詳細内容</p>
            <p class="text-sm text-stone-600 leading-relaxed">{order.description}</p>
          </div>
        </section>

        <footer class="pt-6 space-y-6">
          {#if order.clientId === $user?.uid}
            <!-- Client View -->
            {#if order.status === 'pending_payment'}
              <div class="p-6 bg-orange-50 rounded-2xl border border-orange-100 space-y-4">
                <p class="text-orange-600 text-sm font-bold text-center">決済が確定（キャプチャ）されていません。</p>
                <button 
                  on:click={handleCapture}
                  class="campus-button-primary w-full py-4 bg-emerald-500 hover:bg-emerald-600 shadow-emerald-200"
                >
                  配達完了を確認（売上を確定する）
                </button>
              </div>
            {:else if order.status === 'open'}
              <div class="p-8 bg-pink-50 rounded-2xl text-center space-y-4 border border-pink-100">
                <p class="text-sm text-pink-600 font-bold">配達員がこれを見つけるのをお待ち下さい。</p>
                <div class="animate-pulse flex justify-center space-x-2">
                  <div class="w-2 h-2 bg-pink-200 rounded-full"></div>
                  <div class="w-2 h-2 bg-pink-200 rounded-full"></div>
                  <div class="w-2 h-2 bg-pink-200 rounded-full"></div>
                </div>
              </div>
            {:else if order.status === 'active'}
              {#if order.actualCost && !order.costApproved}
                <div class="space-y-4" in:fly={{ y: 20 }}>
                  <div class="p-6 bg-white border-2 border-pink-200 rounded-2xl shadow-xl space-y-4">
                    <h3 class="text-lg font-black text-stone-800">実費の承認</h3>
                    <p class="text-sm text-stone-500">配達員が商品を立て替えました。内容を確認して承認してください。</p>
                    
                    <div class="aspect-[4/3] bg-stone-100 rounded-xl overflow-hidden shadow-inner">
                      <img src={order.receiptUrl} alt="Receipt" class="w-full h-full object-contain" />
                    </div>

                    <div class="space-y-2 border-t border-stone-100 pt-4">
                      <div class="flex justify-between text-sm text-stone-500">
                        <span>依頼謝礼</span>
                        <span>¥{order.reward.toLocaleString()}</span>
                      </div>
                      <div class="flex justify-between text-sm text-stone-500">
                        <span>システム利用料</span>
                        <span>¥{calculatePlatformFee(order.reward).toLocaleString()}</span>
                      </div>
                      <div class="flex justify-between text-sm text-stone-500">
                        <span>買い物実費</span>
                        <span>¥{order.actualCost.toLocaleString()}</span>
                      </div>
                      <div class="flex justify-between items-center bg-stone-50 p-4 rounded-xl mt-2">
                        <span class="font-bold text-stone-600">最終合計金額</span>
                        <span class="text-2xl font-black text-pink-500">¥{(order.reward + calculatePlatformFee(order.reward) + order.actualCost).toLocaleString()}</span>
                      </div>
                    </div>

                    <button on:click={handleApproveCost} class="campus-button-primary w-full py-4">
                      金額を承認する
                    </button>
                  </div>
                </div>
              {:else if order.costApproved}
                <div class="p-6 bg-white border-2 border-pink-100 rounded-2xl text-center space-y-4 shadow-lg">
                  <p class="text-xs font-bold text-stone-500 uppercase tracking-widest">受取時に提示してください</p>
                  {#if qrCodeUrl}
                    <img src={qrCodeUrl} alt="Order QR Code" class="mx-auto w-48 h-48 drop-shadow-md" />
                  {/if}
                  <p class="text-[10px] text-stone-400">配達員がこのコードをスキャンすると完了します。</p>
                </div>
              {:else}
                <div class="p-6 bg-stone-50 rounded-2xl text-center border border-stone-100">
                  <p class="text-sm text-stone-400 font-bold">配達員が商品を準備中です...</p>
                </div>
              {/if}
            {:else if order.status === 'completed'}
              <div class="p-6 bg-emerald-50 rounded-2xl text-center border border-emerald-100">
                <p class="text-emerald-600 font-black uppercase tracking-widest">この依頼は完了しました</p>
              </div>
            {/if}
          {:else}
            <!-- Delivery Crew View -->
            {#if order.status === 'open'}
              <button 
                on:click={handleTakeOrder}
                class="campus-button-primary w-full py-5 text-xl"
              >
                この依頼を引き受ける
              </button>
            {:else if order.status === 'active' && order.deliveryId === $user?.uid}
              <div class="space-y-6">
                <!-- Reimbursement Form -->
                <div class="p-6 bg-white border border-stone-100 rounded-2xl shadow-sm space-y-4">
                  <div class="flex justify-between items-center">
                    <h3 class="text-lg font-black text-stone-800">実費請求</h3>
                    <div class="text-right">
                      <p class="text-[9px] font-black text-stone-400 uppercase tracking-widest">獲得予定報酬</p>
                      <p class="text-sm font-black text-emerald-500">¥{(order.reward - calculatePlatformFee(order.reward)).toLocaleString()} (手数料引去後)</p>
                    </div>
                  </div>
                  
                  {#if !order.receiptUrl}
                    <div class="space-y-4">
                      <label class="block w-full cursor-pointer">
                        <div class="border-2 border-dashed border-stone-200 rounded-2xl p-8 text-center hover:border-pink-300 transition-colors group">
                          <svg xmlns="http://www.w3.org/2000/svg" class="h-10 w-10 mx-auto text-stone-300 group-hover:text-pink-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                          <p class="mt-2 text-sm text-stone-400 font-bold">レシートを撮影・選択</p>
                        </div>
                        <input type="file" accept="image/*" capture="environment" class="hidden" on:change={handleFileUpload} disabled={isUploading} />
                      </label>
                    </div>
                  {:else}
                    <div class="space-y-4">
                      <div class="aspect-[4/3] bg-stone-100 rounded-xl overflow-hidden relative">
                        <img src={order.receiptUrl} alt="Preview" class="w-full h-full object-contain" />
                        {#if isScanning}
                          <div class="absolute inset-0 bg-pink-500/20 backdrop-blur-sm flex items-center justify-center">
                            <div class="text-center text-white space-y-2">
                              <div class="animate-spin h-8 w-8 border-4 border-white border-t-transparent rounded-full mx-auto"></div>
                              <p class="text-xs font-black uppercase tracking-widest">Scanning Receipt...</p>
                            </div>
                          </div>
                        {/if}
                      </div>
                      
                      <div class="space-y-2">
                        <label for="actualCost" class="text-[9px] font-black text-stone-400 uppercase tracking-widest ml-1">購入金額 (実費)</label>
                        <div class="flex items-center space-x-2">
                          <span class="text-2xl font-black text-stone-300">¥</span>
                          <input 
                            id="actualCost"
                            type="number" 
                            bind:value={inputActualCost}
                            class="w-full p-4 rounded-xl border border-stone-100 bg-stone-50 focus:ring-2 focus:ring-pink-300 focus:outline-none transition-all text-xl font-black"
                          />
                        </div>
                      </div>

                      <button on:click={handleReimbursementSubmit} class="campus-button-secondary w-full py-3 text-sm">
                        金額を更新する
                      </button>
                    </div>
                  {/if}

                  {#if uploadError}
                    <p class="text-xs text-red-500 font-bold">{uploadError}</p>
                  {/if}
                </div>

                {#if order.costApproved}
                  <div class="p-6 bg-emerald-50 border border-emerald-100 rounded-2xl space-y-4">
                    <p class="text-emerald-600 font-bold text-center flex items-center justify-center space-x-2">
                      <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l5-5z" clip-rule="evenodd" />
                      </svg>
                      <span>実費金額が承認されました</span>
                    </p>
                    <a href="/scan" class="campus-button-primary w-full block text-center py-5">
                      完了スキャンへ進む
                    </a>
                  </div>
                {:else if order.actualCost}
                  <div class="p-6 bg-stone-50 border border-stone-100 rounded-2xl text-center">
                    <p class="text-sm text-stone-400 font-bold">依頼主の承認を待っています...</p>
                  </div>
                {/if}
              </div>
            {:else if order.status === 'completed'}
              <div class="p-6 bg-emerald-50 rounded-2xl text-center border border-emerald-100">
                <p class="text-emerald-600 font-black">配達完了済み</p>
              </div>
            {:else}
              <p class="text-center text-stone-400 italic">この依頼は他の方が対応中か、完了しています。</p>
            {/if}
          {/if}
        </footer>

        <nav class="pt-4 text-center">
          <a href="/" class="text-xs font-bold text-stone-400 hover:text-stone-600 transition-colors uppercase tracking-[0.2em]">一覧へ戻る</a>
        </nav>
      </main>
    {/if}
  </div>
</div>
