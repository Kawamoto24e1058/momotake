<script lang="ts">
  import { onMount } from 'svelte';
  import { user } from '$lib/firebase/authStore';
  import { subscribeMyOrders, subscribeOpenOrders } from '$lib/firebase/orderStore';
  import type { Order } from '$lib/types/order';
  import { fade, fly } from 'svelte/transition';
  import { env } from '$env/dynamic/public';

  let activeTab: 'order' | 'deliver' = 'order';
  let myOrders: Order[] = [];
  let availableOrders: Order[] = [];
  let isLoading = true;
  let unsubscribe: (() => void) | null = null;

  const statusMap: Record<string, { label: string, color: string }> = {
    'pending_payment': { label: 'お支払い待ち', color: 'bg-stone-100 text-stone-500' },
    'open': { label: '配達員募集中！', color: 'bg-pink-100 text-pink-600 animate-pulse border-pink-200' },
    'active': { label: '配達中...', color: 'bg-orange-100 text-orange-600 border-orange-200' },
    'completed': { label: '配達完了', color: 'bg-emerald-100 text-emerald-600 border-emerald-200' },
    'expired': { label: '期限切れ', color: 'bg-red-100 text-red-600 border-red-200' },
    'cancelled': { label: 'キャンセル', color: 'bg-stone-200 text-stone-600' }
  };

  function sortOrders(orders: Order[]) {
    const priority: Record<string, number> = {
      'open': 0,
      'active': 1,
      'pending_payment': 2,
      'completed': 3,
      'expired': 4,
      'cancelled': 5
    };

    return [...orders].sort((a, b) => {
      const pA = priority[a.status] ?? 99;
      const pB = priority[b.status] ?? 99;
      if (pA !== pB) return pA - pB;
      return b.createdAt - a.createdAt;
    });
  }

  function handleSubscription() {
    if (unsubscribe) {
      unsubscribe();
      unsubscribe = null;
    }

    if (!$user) return;
    
    isLoading = true;
    if (activeTab === 'order') {
      unsubscribe = subscribeMyOrders($user.uid, 'client', (orders) => {
        myOrders = sortOrders(orders);
        isLoading = false;
      });
    } else {
      unsubscribe = subscribeOpenOrders((orders) => {
        availableOrders = sortOrders(orders);
        isLoading = false;
      });
    }
  }

  function formatTime(ts: number) {
    if (!ts) return '';
    return new Date(ts).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
  }

  $: if ($user || activeTab) {
    handleSubscription();
  }

  onMount(() => {
    return () => {
      if (unsubscribe) unsubscribe();
    };
  });
</script>

<div class="min-h-screen bg-pink-50/20 p-4 sm:p-8 animate-mesh">
  <div class="max-w-4xl mx-auto space-y-8">
    {#if !$user}
      <!-- Logged Out Hero -->
      <div class="flex flex-col items-center justify-center py-20 text-center space-y-8" in:fade>
        <div class="w-24 h-24 bg-white rounded-[2rem] shadow-2xl flex items-center justify-center text-pink-500 mb-4 animate-bounce">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        </div>
        <h1 class="text-5xl font-black text-stone-800 tracking-tighter leading-tight">
          キャンパスをもっと<br><span class="text-pink-500">スマート</span>に、もっと<br>助け合いで繋ごう。
        </h1>
        <p class="text-stone-500 max-w-md text-lg">
          大学内の「ちょっとしたおつかい」を依頼したり、<br>配達して謝礼を受け取れるプラットフォーム。
        </p>
        <a href="/login" class="campus-button-primary text-xl px-12 py-5 rounded-[2rem]">
          Googleでログインして始める
        </a>
      </div>
    {:else}
      <!-- Role Switcher -->
      <div class="flex p-1 bg-stone-200/50 backdrop-blur-md rounded-2xl w-full max-w-sm mx-auto shadow-inner">
        <button 
          on:click={() => activeTab = 'order'}
          class="flex-1 py-3 px-6 rounded-xl font-bold transition-all {activeTab === 'order' ? 'bg-white text-stone-800 shadow-md' : 'text-stone-500 hover:text-stone-700'}"
        >
          依頼する
        </button>
        <button 
          on:click={() => activeTab = 'deliver'}
          class="flex-1 py-3 px-6 rounded-xl font-bold transition-all {activeTab === 'deliver' ? 'bg-white text-stone-800 shadow-md' : 'text-stone-500 hover:text-stone-700'}"
        >
          配達する
        </button>
      </div>

      <!-- Tab Content -->
      <div class="space-y-6">
        {#if activeTab === 'order'}
          <!-- Order Tab -->
          <div class="flex justify-between items-center mb-4">
            <h2 class="text-2xl font-black text-stone-800">過去の依頼履歴</h2>
            <a href="/order" class="campus-button-primary text-sm flex items-center space-x-2">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path fill-rule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clip-rule="evenodd" />
              </svg>
              <span>新しく依頼する</span>
            </a>
          </div>

          {#if isLoading}
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              {#each Array(4) as _}
                <div class="bg-white/40 h-32 rounded-2xl animate-pulse"></div>
              {/each}
            </div>
          {:else if myOrders.length === 0}
            <div class="campus-card text-center py-20 space-y-4">
              <p class="text-stone-400">依頼履歴がありません。</p>
              <a href="/order" class="text-pink-500 font-bold underline">最初の依頼を作成してみましょう</a>
            </div>
          {:else}
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              {#each myOrders as order (order.id)}
                <a href="/orders/{order.id}" class="campus-card hover:translate-y-[-2px] transition-transform border border-stone-100 group relative overflow-hidden">
                  {#if order.status === 'open'}
                    <div class="absolute top-0 right-0 w-16 h-16 -mr-8 -mt-8 bg-pink-500/10 rounded-full blur-2xl group-hover:bg-pink-500/20 transition-all"></div>
                  {/if}
                  
                  <div class="flex justify-between items-start mb-4">
                    <div class="space-y-1">
                      <h3 class="font-black text-stone-800 line-clamp-1 group-hover:text-pink-500 transition-colors">{order.title}</h3>
                      {#if order.expiresAt && (order.status === 'open' || order.status === 'active')}
                        <p class="text-[9px] font-bold text-orange-400 uppercase tracking-tight">
                          期限: {formatTime(order.expiresAt)}まで
                        </p>
                      {/if}
                    </div>
                    <span class="text-[10px] px-2.5 py-1 rounded-full font-black border {statusMap[order.status]?.color || 'bg-stone-100 text-stone-500 border-stone-200'} shadow-sm">
                      {statusMap[order.status]?.label || order.status}
                    </span>
                  </div>
                  
                  <div class="flex justify-between items-end mt-auto">
                    <div class="text-[10px] text-stone-400 font-bold uppercase tracking-widest flex items-center space-x-1">
                      <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                        <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clip-rule="evenodd" />
                      </svg>
                      <span>{new Date(order.createdAt).toLocaleDateString()}</span>
                    </div>
                    <div class="text-2xl font-black text-stone-800 tabular-nums">¥{order.reward.toLocaleString()}</div>
                  </div>
                </a>
              {/each}
            </div>
          {/if}
        {:else}
          <!-- Deliver Tab -->
          <div class="space-y-6">
            <!-- Balance Card -->
            <div class="bg-gradient-to-br from-emerald-400 to-teal-500 rounded-2xl p-6 text-white shadow-lg space-y-1 relative overflow-hidden group" in:fly={{ y: 20 }}>
              <div class="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-20 w-20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <p class="text-xs font-black uppercase tracking-widest opacity-80">Connected Account Balance</p>
              <div class="flex items-baseline space-x-2">
                <span class="text-xs font-bold">¥</span>
                <span class="text-4xl font-black tabular-nums tracking-tighter">12,400</span>
              </div>
              <p class="text-[10px] items-center flex space-x-1 opacity-70">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                  <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l5-5z" clip-rule="evenodd" />
                </svg>
                <span>Stripe Connect: {env.PUBLIC_STRIPE_CONNECT_ACCOUNT_ID}</span>
              </p>
            </div>

            <div class="flex justify-between items-center mb-6">
              <h2 class="text-2xl font-black text-stone-800">募集中のお仕事</h2>
            <div class="text-xs font-bold text-stone-400 uppercase tracking-widest flex items-center space-x-2">
              <div class="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></div>
              <span>Live Updates</span>
            </div>
          </div>

          {#if isLoading}
            <div class="space-y-4">
              {#each Array(4) as _}
                <div class="bg-white/40 h-24 rounded-2xl animate-pulse"></div>
              {/each}
            </div>
          {:else if availableOrders.length === 0}
            <div class="campus-card text-center py-20">
              <p class="text-stone-400">現在募集中の依頼はありません。</p>
            </div>
          {:else}
            <div class="space-y-4">
              {#each availableOrders as order (order.id)}
                <a href="/orders/{order.id}" class="campus-card flex flex-col sm:flex-row sm:items-center justify-between hover:translate-x-1 transition-transform group">
                  <div class="space-y-1">
                    <div class="text-[10px] font-black text-pink-400 uppercase tracking-widest">New Opportunity</div>
                    <h3 class="text-lg font-black text-stone-800">{order.title}</h3>
                    <div class="text-xs text-stone-500 font-bold">
                      {order.pickupLocationName || '場所不明'} ➔ {order.dropoffLocationName || '場所不明'}
                    </div>
                    {#if order.expiresAt}
                      <p class="text-[9px] font-bold text-orange-400 uppercase">
                        期限: {formatTime(order.expiresAt)}まで
                      </p>
                    {/if}
                  </div>
                  <div class="mt-4 sm:mt-0 flex items-center space-x-6">
                    <div class="text-2xl font-black text-stone-800 group-hover:text-pink-500 transition-colors">
                      ¥{order.reward.toLocaleString()}
                    </div>
                    <div class="campus-button-secondary py-2 px-6 text-sm">
                      詳細
                    </div>
                  </div>
                </a>
              {/each}
            </div>
          {/if}
        </div>
      {/if}
      </div>
    {/if}
  </div>
</div>
