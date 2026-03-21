<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { user } from '$lib/firebase/authStore';
  import { 
    subscribeToOrder, updateOrderStatus, updateOrderReimbursement, approveOrderCost,
    sendMessage, subscribeToMessages 
  } from '$lib/firebase/orderStore';
  import { storage } from '$lib/firebase/firebase';
  import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
  import type { Order, Message } from '$lib/types/order';
  import { fade, fly } from 'svelte/transition';
  import QRCode from 'qrcode';
  import { createWorker } from 'tesseract.js';
  import { calculatePlatformFee } from '$lib/utils/feeCalculator';

  let orderId = $page.params.id || '';
  let order: Order | null = null;
  let qrCodeUrl = '';
  let isLoading = true;
  let loadError = false;
  let retryCount = 0;

  // Reimbursement state
  let receiptFile: File | null = null;
  let isUploading = false;
  let isScanning = false;
  let inputActualCost = 0;
  let uploadError = '';
  let timeLeft = '';
  let expirationTime = '';
  let countdownInterval: any;
  let isDebugOpen = false;

  // Chat State
  let messages: Message[] = [];
  let newMessage = '';
  let chatUnsubscribe: (() => void) | null = null;
  let chatContainer: HTMLElement;

  function formatTime(ts: number) {
    return new Date(ts).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
  }

  onMount(() => {
    if (!orderId) return;
    
    // Countdown logic
    countdownInterval = setInterval(() => {
      if (order?.expiresAt) {
        const diff = order.expiresAt - Date.now();
        if (diff <= 0) {
          timeLeft = '期限切れ';
          // 期限切れかつ募集中の場合、クライアントサイドからクリーンアップをトリガー（デモ用）
          if (order?.status === 'open') {
            triggerCleanup();
          }
        } else {
          const mins = Math.floor(diff / 60000);
          const secs = Math.floor((diff % 60000) / 1000);
          timeLeft = `${mins}分${secs}秒`;
        }
      }
    }, 1000);

    // Order subscription
    const unsubscribe = subscribeToOrder(orderId, (data) => {
      // 成功リダイレクト時は paymentIntentId が降ってくるまで待機する（ポーリング）
      const isSuccessRedirect = $page.url.searchParams.get('success') === 'true';
      if (isSuccessRedirect && data && !data.paymentIntentId && retryCount < 10) {
        console.log(`Waiting for paymentIntentId propagation... (${retryCount + 1}/10)`);
        isLoading = true;
        setTimeout(() => {
          retryCount++;
        }, 1000);
        return;
      }

      if (data) {
        order = data;
        isLoading = false;
        loadError = false;
        if (order?.expiresAt) {
          expirationTime = formatTime(order.expiresAt);
        }
        if (order?.costApproved) {
          generateQR();
        }

        // Initialize chat if status allows
        if (order && (order.status === 'active' || order.status === 'completed') && !chatUnsubscribe) {
          chatUnsubscribe = subscribeToMessages(orderId, (newMessages) => {
            messages = newMessages;
            scrollToBottom();
          });
        }
      } else {
        // もしデータそのものが見つからない場合のリトライ
        if (retryCount < 5) {
          setTimeout(() => {
            retryCount++;
          }, 1000);
        } else {
          isLoading = false;
          loadError = true;
        }
      }
    });

    return () => {
      if (countdownInterval) clearInterval(countdownInterval);
      if (unsubscribe) unsubscribe();
      if (chatUnsubscribe) chatUnsubscribe();
    };
  });

  function scrollToBottom() {
    setTimeout(() => {
      if (chatContainer) {
        chatContainer.scrollTop = chatContainer.scrollHeight;
      }
    }, 100);
  }

  async function handleSendMessage() {
    if (!newMessage.trim() || !$user || !orderId) return;
    const text = newMessage;
    newMessage = '';
    await sendMessage(orderId, text, $user.uid);
  }

  async function generateQR() {
    try {
      qrCodeUrl = await QRCode.toDataURL(`order_complete:${orderId}`);
    } catch (err) {
      console.error(err);
    }
  }

  async function handleTakeOrder() {
    if (!$user || !order || !orderId) return;
    await updateOrderStatus(orderId, 'active', {
      deliveryId: $user.uid,
      acceptedAt: Date.now()
    });
  }

  async function handleReportNoShow() {
    if (!confirm('配達員が現れないため、この依頼をキャンセルしますか？')) return;
    
    isLoading = true;
    try {
      const res = await fetch('/api/stripe/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, reason: 'no-show' })
      });
      
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'キャンセルの実行に失敗しました');
      }
      
      alert('未着報告を受け付け、決済をキャンセルしました。');
      window.location.reload();
    } catch (err: any) {
      alert(err.message);
    } finally {
      isLoading = false;
    }
  }

  async function handleCancelOrder() {
    if (!confirm('この依頼を完全に取り消しますか？\n決済の仮押さえも即座に解除（返金）されます。')) return;
    
    isLoading = true;
    try {
      const res = await fetch('/api/stripe/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, reason: 'user_cancelled' })
      });
      
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'キャンセルの実行に失敗しました');
      }
      
      alert('依頼を取り消しました。決済は解除されます。');
      window.location.reload();
    } catch (err: any) {
      alert(err.message);
    } finally {
      isLoading = false;
    }
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

  async function triggerCleanup() {
    try {
      await fetch('/api/orders/cleanup-expired');
    } catch (e) {
      console.error('Cleanup trigger failed', e);
    }
  }

  const statusMap: Record<string, { label: string, color: string }> = {
    'pending_payment': { label: '決済待ち', color: 'bg-stone-100 text-stone-500' },
    'open': { label: '募集中', color: 'bg-pink-100 text-pink-600 animate-pulse' },
    'active': { label: '配達中', color: 'bg-orange-100 text-orange-600' },
    'completed': { label: '完了', color: 'bg-emerald-100 text-emerald-600' },
    'expired': { label: '期限切れ', color: 'bg-red-100 text-red-600' },
    'cancelled': { label: 'キャンセル', color: 'bg-stone-200 text-stone-600' }
  };

  // --- Debug Functions ---
  async function debugAdvanceTime() {
    if (!order) return;
    const newAcceptedAt = Date.now() - 3601000; // 1時間1秒前
    await updateOrderStatus(orderId, 'active', { acceptedAt: newAcceptedAt });
    alert('受諾時刻を1時間前に変更しました。未着報告ボタンが表示されるはずです。');
  }

  async function debugExpire() {
    if (!order) return;
    const newExpiresAt = Date.now() - 60000; // 1分前
    await updateOrderStatus(orderId, order.status, { expiresAt: newExpiresAt });
    alert('有効期限を1分前に変更しました。まもなく自動キャンセルがトリガーされます。');
  }

  async function debugForceComplete() {
    if (!confirm('相手の操作を待たずに強制的に売上を確定させますか？')) return;
    await handleCapture();
  }
</script>

<div class="min-h-screen p-4 sm:p-8 flex items-center justify-center relative overflow-hidden">
  <div class="max-w-xl w-full relative z-20">
    {#if isLoading}
      <div class="campus-card text-center py-20 bg-white/50 backdrop-blur-sm" in:fade>
        <div class="space-y-4">
          <div class="animate-spin h-10 w-10 border-4 border-pink-500 border-t-transparent rounded-full mx-auto"></div>
          <p class="text-stone-400 font-bold animate-pulse uppercase tracking-[0.2em] text-xs">情報を取得中...</p>
          {#if retryCount > 0}
            <p class="text-[10px] text-stone-300 font-bold">同期を試行中 ({retryCount}/5)...</p>
          {/if}
        </div>
      </div>
    {:else if loadError}
      <div class="campus-card text-center py-12 space-y-6" in:fade>
        <div class="w-16 h-16 bg-red-50 text-red-500 rounded-2xl flex items-center justify-center mx-auto">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <div class="space-y-2">
          <h2 class="text-xl font-black text-stone-800">依頼が見つかりません</h2>
          <p class="text-xs text-stone-500 leading-relaxed px-4">
            決済は正常に受理されましたが、データの反映に時間がかかっているか、URLが正しくない可能性があります。
          </p>
        </div>
        <div class="pt-4 space-y-3 px-6">
          <button on:click={() => window.location.reload()} class="campus-button-primary w-full py-3 text-sm">
            もう一度確認する
          </button>
          <a href="/" class="block text-xs text-stone-400 font-bold hover:text-stone-600 transition-colors">
            一覧に戻る
          </a>
        </div>
      </div>
    {:else if order}
      <main class="campus-card space-y-8" in:fade>
        <header class="border-b border-stone-100 pb-6">
          <div class="flex justify-between items-start mb-2">
            <span class="text-[10px] font-black text-pink-400 uppercase tracking-[0.3em]">Order Details</span>
            <div class="flex items-center space-x-2">
              {#if order.status === 'open' || order.status === 'active'}
                <div class="flex flex-col items-end">
                  <span class="text-[9px] font-bold text-orange-400 uppercase">期限：{expirationTime}まで</span>
                  <span class="text-[10px] font-bold text-stone-400">
                    残り: {timeLeft}
                  </span>
                </div>
              {/if}
              <span class="text-xs px-2 py-1 rounded-full font-black uppercase {statusMap[order.status]?.color || 'bg-stone-100'}">
                {statusMap[order.status]?.label || order.status}
              </span>
            </div>
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
              <div class="space-y-6">
                {#if order.reportedAt}
                  <div class="p-6 bg-red-50 rounded-2xl text-center border border-red-100">
                    <p class="text-red-600 font-bold text-sm">未着報告済みです。運営の介入をお待ちください。</p>
                  </div>
                {:else}
                  <!-- Action Card (Approval or Receipt) -->
                  {#if order.actualCost && !order.costApproved}
                    <div class="p-6 bg-white border-2 border-pink-200 rounded-2xl shadow-xl space-y-4" in:fly={{ y: 20 }}>
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
                  {:else}
                    <div class="p-6 bg-white border-2 border-pink-100 rounded-2xl text-center space-y-4 shadow-lg">
                      {#if order.costApproved}
                        <p class="text-xs font-bold text-stone-500 uppercase tracking-widest">受取時に提示してください</p>
                        {#if qrCodeUrl}
                          <img src={qrCodeUrl} alt="Order QR Code" class="mx-auto w-48 h-48 drop-shadow-md" />
                        {/if}
                        <p class="text-[10px] text-stone-400 mb-4">配達員がこのコードをスキャンすると完了します。</p>
                      {:else}
                        <div class="py-10">
                          <div class="animate-bounce mb-4">
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-10 w-10 mx-auto text-pink-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z" />
                              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0" />
                            </svg>
                          </div>
                          <p class="text-sm text-stone-400 font-bold">配達員がお届け先へ向かっています</p>
                        </div>
                      {/if}
                      
                      <div class="pt-4 border-t border-stone-100">
                        <button 
                          on:click={handleCapture}
                          class="campus-button-primary w-full py-4 bg-emerald-500 hover:bg-emerald-600 shadow-emerald-200"
                        >
                          受取完了を確認（売上を確定）
                        </button>
                        <p class="text-[9px] text-stone-400 mt-2">※商品を受け取ったら、このボタンを押して決済を完了してください。</p>
                      </div>
                    </div>
                  {/if}

                  <!-- No-show reporting -->
                  {#if order.acceptedAt && Date.now() - order.acceptedAt > 3600000}
                    <div class="p-4 bg-stone-50 rounded-xl border border-stone-100 text-center">
                      <p class="text-[10px] text-stone-400 mb-2">配達員が現れない場合はこちら</p>
                      <button 
                        on:click={handleReportNoShow}
                        class="text-xs text-red-400 hover:text-red-600 font-bold underline transition-colors"
                      >
                        未着のためキャンセル・返金
                      </button>
                    </div>
                  {/if}
                {/if}
              </div>
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

        {#if order.clientId === $user?.uid && (order.status === 'open' || order.status === 'pending_payment')}
          <div class="pt-12 border-t border-stone-50 text-center">
            <button 
              on:click={handleCancelOrder}
              class="px-8 py-3 rounded-xl border border-red-200 text-red-400 text-xs font-black uppercase tracking-widest hover:bg-red-50 hover:border-red-300 transition-all active:scale-95"
            >
              依頼を取り消す
            </button>
            <p class="text-[9px] text-stone-300 mt-2 italic">※配達員が受諾する前であれば、いつでもキャンセル可能です。</p>
          </div>
        {/if}

        <!-- Chat Section -->
        {#if order && (order.status === 'active' || order.status === 'completed')}
          <section class="mt-12 space-y-4" in:fade>
            <div class="flex items-center space-x-2 px-2">
              <div class="h-2 w-2 bg-pink-500 rounded-full animate-pulse"></div>
              <h2 class="text-sm font-black text-stone-800 uppercase tracking-widest">メッセージ</h2>
            </div>

            <div class="bg-stone-100 rounded-3xl p-4 shadow-inner border border-stone-200">
              <!-- Message List -->
              <div 
                bind:this={chatContainer}
                class="h-80 overflow-y-auto space-y-3 px-2 py-4 scroll-smooth"
              >
                {#if messages.length === 0}
                  <div class="h-full flex items-center justify-center">
                    <p class="text-[10px] text-stone-400 font-bold uppercase tracking-widest bg-white/50 px-4 py-2 rounded-full shadow-sm">
                      メッセージはまだありません
                    </p>
                  </div>
                {:else}
                  {#each messages as msg (msg.id)}
                    <div class="flex {msg.senderId === $user?.uid ? 'justify-end' : 'justify-start'}" in:fly={{ y: 10, duration: 300 }}>
                      <div class="max-w-[80%] space-y-1">
                        <div class="
                          px-4 py-2 rounded-2xl text-sm font-medium shadow-sm
                          {msg.senderId === $user?.uid 
                            ? 'bg-pink-500 text-white rounded-tr-none' 
                            : 'bg-white text-stone-700 rounded-tl-none border border-stone-200'}
                        ">
                          {msg.text}
                        </div>
                        <p class="text-[10px] text-stone-400 px-1 {msg.senderId === $user?.uid ? 'text-right' : 'text-left'}">
                          {new Date(msg.createdAt).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                  {/each}
                {/if}
              </div>

              <!-- Input Area -->
              <div class="mt-4 flex items-center space-x-2 bg-white p-2 rounded-2xl border border-stone-200 shadow-sm focus-within:ring-2 focus-within:ring-pink-300 transition-all">
                <input 
                  type="text" 
                  bind:value={newMessage}
                  on:keydown={(e) => e.key === 'Enter' && handleSendMessage()}
                  placeholder="メッセージを入力..."
                  class="flex-1 bg-transparent border-none outline-none px-2 text-sm text-stone-800 placeholder:text-stone-300"
                />
                <button 
                  on:click={handleSendMessage}
                  disabled={!newMessage.trim()}
                  class="bg-pink-500 text-white p-2 rounded-xl hover:bg-pink-600 disabled:opacity-30 disabled:scale-95 transition-all shadow-md active:scale-90"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 rotate-90" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
                  </svg>
                </button>
              </div>
            </div>
            <p class="text-[9px] text-stone-400 text-center italic">※マッチング後、このチャットで受け渡し場所などの詳細を相談できます。</p>
          </section>
        {/if}

        <nav class="pt-8 text-center pb-12">
          <a href="/" class="text-xs font-bold text-stone-400 hover:text-stone-600 transition-colors uppercase tracking-[0.2em]">一覧へ戻る</a>
        </nav>
      </main>
    {/if}
  </div>

  <!-- Admin Debug Panel -->
  <div class="fixed bottom-4 right-4 z-50">
    <button 
      on:click={() => isDebugOpen = !isDebugOpen}
      class="bg-stone-800 text-stone-400 p-2 rounded-full hover:text-white transition-colors shadow-lg"
      title="Debug Tools"
    >
      <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
        <path fill-rule="evenodd" d="M11.49 3.17c-.38-3.92-5.59-3.92-5.98 0l-.28 2.8c-1.12.19-2.17.58-3.13 1.14l-2.06-1.95c-2.73 2.82-2.73 7.37 0 10.19l2.06-1.95c.96.56 2.01.95 3.13 1.14l.28 2.8c.39 3.92 5.59 3.92 5.98 0l.28-2.8c1.12-.19 2.17-.58 3.13-1.14l2.06 1.95c2.73-2.82 2.73-7.37 0-10.19l-2.06 1.95c-.96-.56-2.01-.95-3.13-1.14l-.28-2.8zM8 12a2 2 0 100-4 2 2 0 000 4z" clip-rule="evenodd" />
      </svg>
    </button>

    {#if isDebugOpen}
      <div 
        class="absolute bottom-12 right-0 w-64 bg-stone-900 rounded-2xl p-4 shadow-2xl border border-stone-800 space-y-3"
        in:fly={{ y: 20 }}
      >
        <p class="text-[10px] font-black text-stone-500 uppercase tracking-widest border-b border-stone-800 pb-2 mb-2">Admin Debug Info</p>
        
        <button 
          on:click={debugAdvanceTime}
          class="w-full text-left p-2 rounded-lg bg-stone-800 hover:bg-stone-700 text-xs text-stone-300 font-bold transition-all"
        >
          時間を1時間進める ( acceptedAt )
        </button>

        <button 
          on:click={debugExpire}
          class="w-full text-left p-2 rounded-lg bg-stone-800 hover:bg-stone-700 text-xs text-stone-300 font-bold transition-all"
        >
          期限切れにする ( expiresAt )
        </button>

        <button 
          on:click={debugForceComplete}
          class="w-full text-left p-2 rounded-lg bg-pink-900/50 hover:bg-pink-900 text-xs text-pink-300 font-bold transition-all border border-pink-800/30"
        >
          完了（強制キャプチャ）
        </button>

        <p class="text-[9px] text-stone-600 italic">※デモ用の実験ツールです。商用環境では削除してください。</p>
      </div>
    {/if}
  </div>
</div>
