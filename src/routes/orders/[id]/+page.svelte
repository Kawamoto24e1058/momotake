<script lang="ts">
  import { onMount, tick, onDestroy } from 'svelte';
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
  import { calculatePlatformFee } from '$lib/utils/feeCalculator';

  let { data } = $props();
  const orderId = $derived($page.params.id || '');
  let order = $state<Order | null>(null);
  let qrCodeUrl = $state('');
  let isLoading = $state(true);
  let loadError = $state(false);
  let retryCount = $state(0);

  // Reimbursement state
  let receiptFile = $state<File | null>(null);
  let isUploading = $state(false);
  let isScanning = $state(false);
  let inputActualCost = $state(0);
  let isOverBudget = $derived(inputActualCost > (order?.estimatedItemCost || 0));
  let uploadError = $state('');
  let localReceiptPreview = $state('');
  let timeLeft = $state('');
  let expirationTime = $state('');
  let countdownInterval: any;
  let isDebugOpen = $state(false);

  // Chat State
  let messages = $state<Message[]>([]);
  let newMessage = $state('');
  let chatUnsubscribe: (() => void) | null = null;
  let chatContainer = $state<HTMLElement | null>(null);

  function formatTime(ts: number) {
    return new Date(ts).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
  }

  async function verifySession(id: string) {
    isLoading = true;
    try {
      const res = await fetch('/api/stripe/verify-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: id })
      });
      const result = await res.json();
      if (result.success) {
        console.log('[Verify] Session verified and Firestore updated.');
      } else {
        console.warn('[Verify] Session not paid yet or update failed.', result);
      }
    } catch (err) {
      console.error('[Verify] Error calling verify-session:', err);
    } finally {
      isLoading = false;
    }
  }

  onMount(() => {
    isUploading = false;
    isScanning = false;
    localReceiptPreview = '';
    
    if (!orderId) return;
    
    // Countdown logic
    countdownInterval = setInterval(() => {
      if (order?.expiresAt) {
        const diff = order.expiresAt - Date.now();
        if (diff <= 0) {
          timeLeft = '期限切れ';
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
      const isSuccessRedirect = $page.url.searchParams.get('success') === 'true';
      
      // 成功リダイレクト (?success=true) かつ、決済情報がまだ未反映の場合のみ同期をかける
      if (isSuccessRedirect && data && data.status === 'pending_payment' && !data.paymentIntentId && retryCount === 0) {
        console.log(`[Sync] Success redirect detected. Triggering authoritative verify-session...`);
        retryCount = 1; // 多重実行防止
        verifySession(orderId);
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

  /**
   * AI解析用に画像をリサイズする (キャンバスを使用)
   */
  async function resizeImageForAI(file: File, maxWidth = 1200, maxHeight = 1200, quality = 0.8): Promise<string> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > maxWidth) {
              height *= maxWidth / width;
              width = maxWidth;
            }
          } else {
            if (height > maxHeight) {
              width *= maxHeight / height;
              height = maxHeight;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) return reject(new Error('Could not get canvas context'));
          ctx.drawImage(img, 0, 0, width, height);
          
          const dataUrl = canvas.toDataURL('image/jpeg', quality);
          console.log('[Resize] Success. Dimensions:', width, 'x', height);
          resolve(dataUrl);
        } catch (e) {
          reject(e);
        }
      };
      img.onerror = () => reject(new Error('Image failed to load in resizeImageForAI'));
      img.src = URL.createObjectURL(file);
    });
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
    console.log('[Upload] Handler started');
    const target = e.target as HTMLInputElement;
    if (!target.files || target.files.length === 0) {
      console.log('[Upload] No files selected');
      return;
    }
    
    let file = target.files[0];
    if (!file) return;
    
    // HEIC (iPhone) Support
    if (file.type === 'image/heic' || file.name.toLowerCase().endsWith('.heic')) {
      console.log('[Upload] HEIC detected. Converting to JPEG...');
      try {
        isScanning = true; // Show loading early
        const heic2any = (await import('heic2any')).default;
        const convertedBlob = await heic2any({ 
          blob: file, 
          toType: 'image/jpeg',
          quality: 0.8 
        });
        const resultBlob = Array.isArray(convertedBlob) ? convertedBlob[0] : convertedBlob;
        file = new File([resultBlob], file.name.replace(/\.[^.]+$/, '.jpg'), { type: 'image/jpeg' });
        console.log('[Upload] HEIC Conversion Success:', file.name, (file.size / 1024 / 1024).toFixed(2), 'MB');
      } catch (err) {
        console.error('[Upload] HEIC Conversion Failed:', err);
        alert('画像の変換に失敗しました。別の形式でお試しください。');
        isScanning = false;
        return;
      }
    }

    // Validate File Type
    console.log('[Upload] File validation:', file.name, file.type, (file.size / 1024 / 1024).toFixed(2), 'MB');
    if (!file.type.startsWith('image/')) {
      alert('画像ファイルを選択してください。');
      isScanning = false;
      return;
    }

    receiptFile = file;
    
    // TEMPORARY: NO REVOKE to debug Failed to load issues
    /*
    if (localReceiptPreview && localReceiptPreview.startsWith('blob:')) {
      URL.revokeObjectURL(localReceiptPreview);
    }
    */

    localReceiptPreview = URL.createObjectURL(file);
    console.log('[Preview] New Blob URL created:', localReceiptPreview);
    await tick();

    isScanning = true;
    isUploading = true;
    uploadError = '';

    try {
      // 2. Resize and Convert to Base64 for Gemini API (Avoid 5MB+ payloads)
      console.log('[Upload] Resizing image for AI analysis...');
      const imageBase64 = await resizeImageForAI(file);
      console.log('[Upload] Resize complete. Base64 length:', imageBase64.length);

      // 3. AI Extraction & Server-side Upload with Gemini
      console.log(`[OCR] Calling Gemini API (Order: ${orderId})...`);
      const res = await fetch('/api/extract-amount', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64, orderId })
      });
      
      const result = await res.json();
      const url = result.receiptUrl;
      
      if (res.ok && result.success) {
        if (result.amount !== null) {
          console.log(`[OCR] Amount: ¥${result.amount}`);
          inputActualCost = result.amount;
        } else {
          alert('レシートから金額を読み取れませんでした。手動入力してください。');
        }
      } else {
        console.warn(`[OCR] API Error:`, result.error);
      }

      if (url) {
        await updateOrderReimbursement(orderId, inputActualCost || 0, url);
      }
    } catch (err: any) {
      uploadError = 'ファイルのアップロードまたはスキャンに失敗しました。';
      console.error('[Upload] CRITICAL ERROR:', err);
      alert('エラーが発生しました。時間を置いて再度お試しください。');
    } finally {
      isUploading = false;
      isScanning = false;
      console.log('[Upload] Handler finished. States reset.');
    }
  }

  function handleResetReceipt() {
    /* 
    if (localReceiptPreview && localReceiptPreview.startsWith('blob:')) {
      URL.revokeObjectURL(localReceiptPreview);
    }
    */
    localReceiptPreview = '';
    receiptFile = null;
    isUploading = false;
    isScanning = false;
    inputActualCost = 0;
    uploadError = '';
    if (order) order.receiptUrl = '';
    console.log('[Upload] Receipt state reset (Revoke disabled)');
  }

  onDestroy(() => {
    // Temporary disable revoke for debugging
    /*
    if (localReceiptPreview && localReceiptPreview.startsWith('blob:')) {
      URL.revokeObjectURL(localReceiptPreview);
    }
    */
  });

  async function handleReimbursementSubmit() {
    console.log('[Payment] Confirm button clicked. Amount:', inputActualCost);
    
    if (isOverBudget) {
      alert(`事前承認された上限額（¥${order?.estimatedItemCost}）を超えています。実費を調整するか、依頼主と相談してください。`);
      return;
    }

    if (!confirm(`実費 ¥${inputActualCost.toLocaleString()} で請求を確定し、配達完了を報告しますか？`)) return;

    isUploading = true;
    uploadError = '';
    
    try {
      // 1. Firestore を最新の入力値で更新 (Capture API は Firestore の値を参照するため)
      console.log(`[Payment] Syncing Firestore: actualCost = ¥${inputActualCost}...`);
      await updateOrderReimbursement(orderId, inputActualCost, order?.receiptUrl || '');

      // 2. Stripe Capture 実行
      const payload = { 
        orderId,
        paymentIntentId: order?.paymentIntentId,
        amountToCapture: (order?.reward || 0) + inputActualCost
      };
      
      console.log('[Payment] Triggering capture for order:', orderId);
      console.log('[Payment] Payload for API:', JSON.stringify(payload));
      
      const res = await fetch('/api/stripe/capture', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      console.log(`[Payment] API Response status: ${res.status}`);
      
      if (!res.ok) {
        const err = await res.json();
        console.error('[Payment] API Error response:', err);
        throw new Error(err.error || '決済の確定に失敗しました。');
      }

      console.log('[Payment] Capture success! Order completed.');
      alert('請求が確定し、依頼が完了しました。お疲れ様でした！');
      window.location.reload();
    } catch (err: any) {
      console.error('[Payment] Error during capture:', err);
      uploadError = err.message;
      alert(err.message);
    } finally {
      isUploading = false;
    }
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
          <button onclick={() => window.location.reload()} class="campus-button-primary w-full py-3 text-sm">
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

        <section class="grid grid-cols-2 gap-6 bg-stone-50/50 p-6 rounded-2xl border border-stone-100">
          <div class="space-y-1">
            <p class="text-[9px] font-black text-stone-400 uppercase tracking-widest">獲得謝礼</p>
            <p class="text-3xl font-black text-stone-800">¥{order.reward.toLocaleString()}</p>
          </div>
          <div class="space-y-1 text-right">
            <p class="text-[9px] font-black text-stone-400 uppercase tracking-widest">商品代の上限 (デポジット)</p>
            <p class="text-3xl font-black text-emerald-600">¥{order.estimatedItemCost?.toLocaleString() || 0}</p>
          </div>
        </section>

        {#if order.actualCost}
          <div class="flex justify-between items-center px-6 py-3 bg-pink-50 rounded-xl border border-pink-100" in:fade>
            <p class="text-[10px] font-black text-pink-500 uppercase tracking-widest">実際の実費請求額</p>
            <p class="text-xl font-black text-pink-600">¥{order.actualCost.toLocaleString()}</p>
          </div>
        {/if}

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
            {#if order.status === 'active' && order.clientId === $user?.uid}
              <div class="p-6 bg-emerald-50 rounded-2xl border border-emerald-100 space-y-4 shadow-sm" in:fade>
                <div class="flex items-center space-x-2 text-emerald-600">
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l5-5z" clip-rule="evenodd" />
                  </svg>
                  <span class="text-sm font-bold">配達完了（スキャン）後の確認</span>
                </div>
                <p class="text-xs text-stone-500">配達員が到着し、商品の受け渡しが完了したら下のボタンを押して決済を確定させてください。</p>
                <button 
                  onclick={handleCapture}
                  class="campus-button-primary w-full py-4 bg-emerald-500 hover:bg-emerald-600 shadow-emerald-200"
                >
                  受取完了を確認（売上を確定する）
                </button>
              </div>
            {:else if order.status === 'pending_payment'}
              <div class="p-8 bg-stone-50 rounded-2xl text-center space-y-4 border border-stone-100">
                <p class="text-sm text-stone-500 font-bold">お支払いの確認を待機中...</p>
                <div class="animate-spin h-6 w-6 border-2 border-stone-300 border-t-stone-800 rounded-full mx-auto"></div>
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

                      <button onclick={handleApproveCost} class="campus-button-primary w-full py-4">
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
                          onclick={handleCapture}
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
                        onclick={handleReportNoShow}
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
                onclick={handleTakeOrder}
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
                      <p class="text-sm font-black text-emerald-500">
                        {#if order}
                          ¥{(order.reward - calculatePlatformFee(order.reward)).toLocaleString()} (手数料引去後)
                        {/if}
                      </p>
                    </div>
                  </div>
                  
                   {#if !order.receiptUrl && !localReceiptPreview}
                    <div class="space-y-4 p-4 border-2 border-dashed border-stone-200 rounded-2xl text-center">
                      <p class="text-sm text-stone-400 font-bold mb-4">レシートを添付してください</p>
                      <input 
                        type="file" 
                        accept="image/*" 
                        capture="environment" 
                        onchange={handleFileUpload} 
                        class="block w-full text-sm text-stone-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-pink-50 file:text-pink-700 hover:file:bg-pink-100"
                      />
                    </div>
                  {:else}
                    <div class="space-y-4">
                      <div class="aspect-[4/3] bg-stone-100 rounded-xl overflow-hidden relative">
                        {#key localReceiptPreview}
                          <img 
                            src={localReceiptPreview || order?.receiptUrl} 
                            alt="Receipt Preview" 
                            class="w-full h-full object-contain"
                            onerror={(e) => {
                              const img = e.currentTarget as HTMLImageElement;
                              console.error('[Image] Preview error. Length:', img.src.length, 'Source:', img.src.substring(0, 50));
                            }}
                          />
                        {/key}
                        
                        <!-- Reset Button Overlay -->
                        {#if !isScanning && !isUploading}
                          <button 
                            onclick={handleResetReceipt}
                            class="absolute top-2 right-2 bg-black/50 hover:bg-black/70 text-white text-[10px] font-black py-1 px-3 rounded-full backdrop-blur-sm transition-all shadow-lg active:scale-95"
                          >
                            画像を切り替え
                          </button>
                        {/if}

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
                        <div class="flex justify-between items-end ml-1">
                          <label for="actualCost" class="text-[9px] font-black text-stone-400 uppercase tracking-widest">購入金額 (実費)</label>
                          <span class="text-[9px] font-bold {isOverBudget ? 'text-red-500' : 'text-stone-400'}">
                            デポジット上限: ¥{order?.estimatedItemCost?.toLocaleString() || 0}
                          </span>
                        </div>
                        <div class="flex items-center space-x-2">
                          <span class="text-2xl font-black {isOverBudget ? 'text-red-300' : 'text-stone-300'}">¥</span>
                          <input 
                            id="actualCost"
                            type="number" 
                            bind:value={inputActualCost}
                            class="w-full p-4 rounded-xl border transition-all text-xl font-black {isOverBudget ? 'border-red-200 bg-red-50 text-red-600 focus:ring-red-300' : 'border-stone-100 bg-stone-50 focus:ring-pink-300 font-black text-stone-800'}"
                          />
                        </div>
                        {#if isOverBudget}
                          <p class="text-[10px] text-red-500 font-bold ml-1 animate-pulse" in:fade>
                            ⚠️ 承認された上限額を超えています。差額は請求できません。
                          </p>
                        {/if}
                      </div>

                      <button 
                        onclick={handleReimbursementSubmit} 
                        disabled={!inputActualCost || isScanning || isUploading || isOverBudget}
                        class="campus-button-secondary w-full py-3 text-sm disabled:opacity-50 shadow-xl active:scale-[0.98] transition-all"
                      >
                        {#if isUploading}
                          <div class="flex items-center justify-center space-x-2">
                            <div class="animate-spin h-4 w-4 border-2 border-white/30 border-t-white rounded-full"></div>
                            <span>処理中...</span>
                          </div>
                        {:else}
                          {isOverBudget ? '上限超過のため請求不可' : '金額を確定して請求する'}
                        {/if}
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
              <div class="space-y-6" in:fade>
                <div class="p-8 bg-emerald-50 rounded-3xl border-2 border-emerald-100 text-center space-y-6 shadow-sm">
                  <div class="space-y-2">
                    <div class="inline-flex items-center px-3 py-1 bg-emerald-100 text-emerald-600 rounded-full text-[10px] font-black uppercase tracking-widest">
                      Transaction Completed
                    </div>
                    <h3 class="text-2xl font-black text-emerald-700">決済完了</h3>
                  </div>

                  <div class="p-6 bg-white rounded-2xl border border-emerald-100 space-y-4 text-left shadow-inner">
                    <div class="flex justify-between items-center border-b border-stone-50 pb-3">
                        <span class="text-xs font-bold text-stone-400">依頼主からの引き落とし総額</span>
                        <span class="text-lg font-black text-stone-800">¥{(order.reward + (order.actualCost || 0)).toLocaleString()}</span>
                    </div>

                    <div class="space-y-3 pt-2">
                        <p class="text-[9px] font-black text-stone-300 uppercase tracking-widest">あなたの受け取り内訳</p>
                        
                        <div class="flex justify-between items-center bg-stone-50 p-3 rounded-xl border border-stone-100">
                            <span class="text-xs font-bold text-stone-500">立て替え分の回収</span>
                            <span class="text-sm font-black text-stone-700">¥{(order.actualCost || 0).toLocaleString()}</span>
                        </div>

                        <div class="flex justify-between items-center bg-emerald-100/30 p-4 rounded-xl border border-emerald-100/50">
                            <span class="text-xs font-black text-emerald-600">今回の純利益（お駄賃）</span>
                            <div class="text-right">
                                <span class="text-xl font-black text-emerald-700">¥{(order.reward - calculatePlatformFee(order.reward)).toLocaleString()}</span>
                                <p class="text-[8px] font-bold text-emerald-500/70 ml-1">※手数料引去後</p>
                            </div>
                        </div>
                    </div>
                  </div>

                  <p class="text-[10px] text-stone-400 font-bold italic">
                    ※売上はマイページのウォレットから確認・引き出し可能です。
                  </p>
                </div>
              </div>
            {:else}
              <p class="text-center text-stone-400 italic">この依頼は他の方が対応中か、完了しています。</p>
            {/if}
          {/if}
        </footer>

        {#if order.clientId === $user?.uid && (order.status === 'open' || order.status === 'pending_payment')}
          <div class="pt-12 border-t border-stone-50 text-center">
            <button 
              onclick={handleCancelOrder}
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
                  onkeydown={(e) => e.key === 'Enter' && handleSendMessage()}
                  placeholder="メッセージを入力..."
                  class="flex-1 bg-transparent border-none outline-none px-2 text-sm text-stone-800 placeholder:text-stone-300"
                />
                <button 
                  onclick={handleSendMessage}
                  disabled={!newMessage.trim()}
                  aria-label="送信"
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
      onclick={() => isDebugOpen = !isDebugOpen}
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
          onclick={debugAdvanceTime}
          class="w-full text-left p-2 rounded-lg bg-stone-800 hover:bg-stone-700 text-xs text-stone-300 font-bold transition-all"
        >
          時間を1時間進める ( acceptedAt )
        </button>

        <button 
          onclick={debugExpire}
          class="w-full text-left p-2 rounded-lg bg-stone-800 hover:bg-stone-700 text-xs text-stone-300 font-bold transition-all"
        >
          期限切れにする ( expiresAt )
        </button>

        <button 
          onclick={debugForceComplete}
          class="w-full text-left p-2 rounded-lg bg-pink-900/50 hover:bg-pink-900 text-xs text-pink-300 font-bold transition-all border border-pink-800/30"
        >
          完了（強制キャプチャ）
        </button>

        <p class="text-[9px] text-stone-600 italic">※デモ用の実験ツールです。商用環境では削除してください。</p>
      </div>
    {/if}
  </div>
</div>
