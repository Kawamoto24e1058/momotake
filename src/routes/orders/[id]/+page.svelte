<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { user } from '$lib/firebase/authStore';
  import { subscribeToOrder, updateOrderStatus } from '$lib/firebase/orderStore';
  import type { Order } from '$lib/types/order';
  import { fade, fly } from 'svelte/transition';
  import QRCode from 'qrcode';

  let orderId = $page.params.id || '';
  let order: Order | null = null;
  let qrCodeUrl = '';
  let isLoading = true;

  onMount(() => {
    if (!orderId) return;
    return subscribeToOrder(orderId, (data) => {
      order = data;
      isLoading = false;
      if (order?.status === 'active' || order?.status === 'open') {
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
</script>

<div class="min-h-screen bg-pink-50/20 p-4 sm:p-8 animate-mesh flex items-center justify-center">
  <div class="max-w-xl w-full">
    {#if isLoading}
      <div class="campus-card text-center py-20 animate-pulse">
        <p class="text-stone-400">Loading order info...</p>
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
          <div class="space-y-1 text-right">
            <p class="text-[9px] font-black text-stone-400 uppercase tracking-widest">作成日</p>
            <p class="font-bold text-stone-600">{new Date(order.createdAt).toLocaleDateString()}</p>
          </div>
        </section>

        <section class="space-y-4">
          <div class="bg-stone-50 p-4 rounded-xl space-y-3">
            <div class="flex items-center space-x-3">
              <div class="w-2 h-2 rounded-full bg-pink-400"></div>
              <p class="text-sm font-bold text-stone-700">集荷: <span class="font-normal">{order.pickupLocationName || '指定なし'}</span></p>
            </div>
            <div class="flex items-center space-x-3">
              <div class="w-2 h-2 rounded-full bg-orange-400"></div>
              <p class="text-sm font-bold text-stone-700">お届け: <span class="font-normal">{order.dropoffLocationName || '指定なし'}</span></p>
            </div>
          </div>
          
          <div class="p-4 border border-stone-100 rounded-xl">
            <p class="text-[9px] font-black text-stone-400 uppercase tracking-widest mb-2">詳細内容</p>
            <p class="text-sm text-stone-600 leading-relaxed">{order.description}</p>
          </div>
        </section>

        <footer class="pt-6">
          {#if order.clientId === $user?.uid}
            <!-- Client View -->
            {#if order.status === 'pending_payment'}
              <p class="text-orange-500 text-sm font-bold text-center mb-4">決済が完了していません。</p>
            {:else if order.status === 'open'}
              <div class="p-6 bg-pink-50 rounded-2xl text-center space-y-4">
                <p class="text-sm text-pink-600 font-bold">配達員がこれを見つけるのをお待ち下さい。</p>
              </div>
            {:else if order.status === 'active'}
              <div class="p-6 bg-white border-2 border-pink-100 rounded-2xl text-center space-y-4">
                <p class="text-xs font-bold text-stone-500 uppercase tracking-widest">受取時に提示してください</p>
                {#if qrCodeUrl}
                  <img src={qrCodeUrl} alt="Order QR Code" class="mx-auto w-48 h-48" />
                {/if}
                <p class="text-[10px] text-stone-400">配達員がこのコードをスキャンすると完了します。</p>
              </div>
            {:else if order.status === 'completed'}
              <div class="p-6 bg-emerald-50 rounded-2xl text-center">
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
              <div class="space-y-4">
                <div class="p-6 bg-orange-50 rounded-2xl text-center">
                  <p class="text-orange-600 font-bold">集荷・お届けを行ってください</p>
                </div>
                <a href="/scan" class="campus-button-primary w-full block text-center py-5">
                  完了スキャンへ進む
                </a>
              </div>
            {:else if order.status === 'completed'}
              <div class="p-6 bg-emerald-50 rounded-2xl text-center">
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
