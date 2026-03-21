<script lang="ts">
  import { onMount } from 'svelte';
  import { fade, fly, slide } from 'svelte/transition';
  import { user } from '$lib/firebase/authStore';

  // カテゴリー定義
  const categories = [
    { id: 'canteen', label: '学食・売店', placeholder: '例：カトルセの日替わり弁当、お茶' },
    { id: 'lost_found', label: '学内便・忘れ物', placeholder: '例：1号館302教室に忘れた青い筆箱' },
    { id: 'other', label: 'その他', placeholder: '例：近くのドラッグストアでマスク' }
  ];

  // 学内プリセット
  const campusPresets = [
    'カトルセ', '聖ペテロ館', 'まなびのプラザ', 'ファミリーマート 和泉中央店', 
    'セブンイレブン 桃山学院大学前店', '1号館', '2号館', '3号館', '図書館', '体育館'
  ];

  let selectedCategory = 'canteen';
  let pickupLocation = '';
  let dropoffLocation = '';
  let itemDescription = '';
  let rewardAmount = 500;
  let isSubmitting = false;
  let errorMessage = '';

  // 期限設定 (デフォルト1時間後)
  let expirationDate = new Date(Date.now() + 60 * 60 * 1000).toISOString().slice(0, 16);

  // サジェスト関連
  let pickupSuggestions: string[] = [];
  let dropoffSuggestions: string[] = [];
  let activeSuggester: 'pickup' | 'dropoff' | null = null;

  $: currentPlaceholder = categories.find(c => c.id === selectedCategory)?.placeholder || '';

  // 入力監視してサジェスト生成
  async function handleInput(val: string, target: 'pickup' | 'dropoff') {
    activeSuggester = target;
    const presets = campusPresets.filter(p => p.includes(val) && val.length > 0);
    
    let osmResults: string[] = [];
    if (val.length >= 3) {
      try {
        const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${val}&format=json&addressdetails=1&limit=5`);
        const data = await res.json();
        osmResults = data.map((item: any) => item.display_name);
      } catch (e) {
        console.error('OSM Fetch error', e);
      }
    }

    const combined = [...new Set([...presets, ...osmResults])];
    if (target === 'pickup') pickupSuggestions = combined;
    else dropoffSuggestions = combined;
  }

  function selectSuggestion(val: string, target: 'pickup' | 'dropoff') {
    if (target === 'pickup') {
      pickupLocation = val;
      pickupSuggestions = [];
    } else {
      dropoffLocation = val;
      dropoffSuggestions = [];
    }
    activeSuggester = null;
  }

  async function getCurrentLocation(target: 'pickup' | 'dropoff') {
    if (!navigator.geolocation) {
      errorMessage = 'お使いのブラウザは現在地取得に対応していません。';
      return;
    }
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        const locationString = `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
        if (target === 'pickup') pickupLocation = locationString;
        else dropoffLocation = locationString;
      },
      (error) => {
        errorMessage = '現在地の取得に失敗しました。詳細を入力してください。';
      }
    );
  }

  async function handleOrder() {
    if (!$user) return;
    isSubmitting = true;
    errorMessage = '';

    try {
      const tempOrderId = `ord_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      
      const orderData = {
        clientId: $user.uid,
        title: itemDescription || 'おつかい依頼',
        description: `【${categories.find(c => c.id === selectedCategory)?.label}】集荷: ${pickupLocation} / お届け: ${dropoffLocation}`,
        reward: rewardAmount,
        pickupLocationId: 'custom',
        dropoffLocationId: 'custom',
        pickupLocationName: pickupLocation,
        dropoffLocationName: dropoffLocation,
        expiresAt: new Date(expirationDate).getTime(),
      };

      const response = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: tempOrderId,
          title: `Campus Hub 依頼: ${itemDescription}`,
          amount: rewardAmount,
          orderData: orderData
        })
      });

      const { url, error } = await response.json();
      if (error) throw new Error(error);
      if (url) window.location.href = url;
    } catch (err: any) {
      console.error('Order Error:', err);
      errorMessage = '依頼の作成に失敗しました。再度お試しください。';
    } finally {
      isSubmitting = false;
    }
  }
</script>

<div class="min-h-screen p-4 sm:p-8 flex items-center justify-center">
  <div class="max-w-2xl w-full space-y-8 mt-10 relative z-20">
    <header class="text-center space-y-2">
      <h1 class="text-3xl font-black text-stone-800 tracking-tight">依頼を作成</h1>
      <p class="text-stone-500 font-bold">Campus Hub // 和泉キャンパス</p>
    </header>

    <main class="campus-card space-y-6">
      <!-- Category Selection -->
      <div class="space-y-2">
        <span class="block text-xs font-black text-stone-400 uppercase tracking-widest ml-1">カテゴリー</span>
        <div class="grid grid-cols-3 gap-2">
          {#each categories as cat}
            <button 
              on:click={() => selectedCategory = cat.id}
              class="py-3 px-2 rounded-xl text-xs font-bold transition-all border {selectedCategory === cat.id ? 'bg-pink-100 border-pink-200 text-pink-600 shadow-sm' : 'bg-white/50 border-stone-100 text-stone-500 hover:border-pink-100'}"
            >
              {cat.label}
            </button>
          {/each}
        </div>
      </div>

      <div class="space-y-4">
        <div class="space-y-2">
          <label for="item" class="text-xs font-black text-stone-400 uppercase tracking-widest ml-1">何を頼みますか？</label>
          <input 
            id="item"
            type="text" 
            bind:value={itemDescription}
            placeholder={currentPlaceholder}
            class="w-full p-4 rounded-xl border border-stone-100 bg-white/50 focus:ring-2 focus:ring-pink-300 focus:outline-none transition-all"
          />
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <!-- Pickup -->
          <div class="space-y-2 relative">
            <label for="pickup" class="text-xs font-black text-stone-400 uppercase tracking-widest ml-1">どこで買う？</label>
            <div class="relative">
              <input 
                id="pickup"
                type="text" 
                bind:value={pickupLocation}
                on:input={(e) => handleInput(e.currentTarget.value, 'pickup')}
                placeholder="場所名を入力..."
                class="w-full p-4 pr-12 rounded-xl border border-stone-100 bg-white/50 focus:ring-2 focus:ring-pink-300 focus:outline-none transition-all"
              />
              <button 
                on:click={() => getCurrentLocation('pickup')}
                class="absolute right-3 top-1/2 -translate-y-1/2 p-2 text-stone-300 hover:text-pink-500 transition-colors"
                title="現在地を取得"
                aria-label="集荷場所の現在地を取得"
              >
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fill-rule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clip-rule="evenodd" />
                </svg>
              </button>
            </div>
            {#if activeSuggester === 'pickup' && pickupSuggestions.length > 0}
              <div class="suggester-dropdown" in:slide>
                {#each pickupSuggestions as sug}
                  <button on:click={() => selectSuggestion(sug, 'pickup')} class="suggester-item w-full text-left">
                    {sug}
                  </button>
                {/each}
              </div>
            {/if}
          </div>

          <!-- Dropoff -->
          <div class="space-y-2 relative">
            <label for="dropoff" class="text-xs font-black text-stone-400 uppercase tracking-widest ml-1">どこに届ける？</label>
            <div class="relative">
              <input 
                id="dropoff"
                type="text" 
                bind:value={dropoffLocation}
                on:input={(e) => handleInput(e.currentTarget.value, 'dropoff')}
                placeholder="教室名やラウンジ..."
                class="w-full p-4 pr-12 rounded-xl border border-stone-100 bg-white/50 focus:ring-2 focus:ring-pink-300 focus:outline-none transition-all"
              />
              <button 
                on:click={() => getCurrentLocation('dropoff')}
                class="absolute right-3 top-1/2 -translate-y-1/2 p-2 text-stone-300 hover:text-pink-500 transition-colors"
                title="現在地を取得"
                aria-label="お届け先の現在地を取得"
              >
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fill-rule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clip-rule="evenodd" />
                </svg>
              </button>
            </div>
            {#if activeSuggester === 'dropoff' && dropoffSuggestions.length > 0}
              <div class="suggester-dropdown" in:slide>
                {#each dropoffSuggestions as sug}
                  <button on:click={() => selectSuggestion(sug, 'dropoff')} class="suggester-item w-full text-left">
                    {sug}
                  </button>
                {/each}
              </div>
            {/if}
          </div>
        </div>

        <div class="space-y-2">
          <label for="reward" class="text-xs font-black text-stone-400 uppercase tracking-widest ml-1">謝礼金額 (¥)</label>
          <input 
            id="reward"
            type="number" 
            bind:value={rewardAmount}
            min="300"
            step="100"
            class="w-full p-4 rounded-xl border border-stone-100 bg-white/50 focus:ring-2 focus:ring-pink-300 focus:outline-none transition-all text-xl font-black"
          />
        </div>

        <div class="space-y-2">
          <label for="expires" class="text-xs font-black text-stone-400 uppercase tracking-widest ml-1">依頼の有効期限</label>
          <input 
            id="expires"
            type="datetime-local" 
            bind:value={expirationDate}
            class="w-full p-4 rounded-xl border border-stone-100 bg-white/50 focus:ring-2 focus:ring-pink-300 focus:outline-none transition-all"
          />
          <p class="text-[10px] text-stone-400 ml-1">※この時刻までに配達員が決まらない場合、自動的にキャンセルされます。</p>
        </div>
      </div>

      {#if errorMessage}
        <p class="text-red-500 text-sm font-bold text-center" transition:fade>{errorMessage}</p>
      {/if}

      <button 
        on:click={handleOrder}
        disabled={isSubmitting || !pickupLocation || !dropoffLocation || !itemDescription}
        class="campus-button-primary w-full py-5 text-xl flex items-center justify-center space-x-2 disabled:opacity-50"
      >
        {#if isSubmitting}
          <svg class="animate-spin h-6 w-6 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <span class="tracking-widest">依頼を確定中...</span>
        {:else}
          <span>決済に進む</span>
        {/if}
      </button>
    </main>
  </div>
</div>
