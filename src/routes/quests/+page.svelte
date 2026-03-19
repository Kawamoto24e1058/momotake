<script lang="ts">
  import { onMount } from 'svelte';
  import { getOpenQuests } from '$lib/firebase/questStore';
  import type { Quest } from '$lib/types/quest';
  import { locations } from '$lib/constants/locations';
  import { fade, fly } from 'svelte/transition';

  let quests: Quest[] = [];
  let isLoading = true;

  onMount(async () => {
    try {
      quests = await getOpenQuests();
    } catch (err) {
      console.error(err);
    } finally {
      isLoading = false;
    }
  });

  function getLocationName(id: string) {
    return locations.find(l => l.id === id)?.name || id;
  }
</script>

<svelte:head>
  <title>掲示板 | 聖ペテロのギルド</title>
</svelte:head>

<div class="min-h-screen bg-[#2d0a0a] p-4 sm:p-8">
  <div class="max-w-4xl mx-auto space-y-8">
    <header class="text-center space-y-2">
      <h1 class="text-4xl font-black text-amber-100 italic uppercase drop-shadow-md">
        ギルド掲示板
      </h1>
      <p class="text-[10px] text-amber-700 font-mono tracking-[0.3em] uppercase opacity-70">Active Quests Registry</p>
    </header>

    {#if isLoading}
      <div class="text-center py-20 text-amber-100/30 italic animate-pulse">
        古文書を読み解いています...
      </div>
    {:else if quests.length === 0}
      <div class="bg-[#fdf6e3] border-4 border-dashed border-[#8b5a2b] p-20 text-center rounded-sm">
        <p class="text-stone-400 font-bold italic">現在、依頼されているクエストはありません。</p>
      </div>
    {:else}
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        {#each quests as quest (quest.id)}
          <a 
            href="/quests/{quest.id}" 
            class="group block bg-[#fdf6e3] border-[6px] border-[#8b5a2b] p-6 shadow-xl hover:shadow-2xl transition-all hover:-translate-y-1 relative overflow-hidden"
            in:fly={{ y: 20 }}
          >
            <!-- Decorative Corners -->
            <div class="absolute top-0 right-0 w-12 h-12 bg-amber-900 text-amber-100 flex items-center justify-center translate-x-4 -translate-y-4 rotate-45 group-hover:bg-amber-800 transition-colors">
              <span class="text-[8px] font-black -rotate-45">VIEW</span>
            </div>

            <div class="space-y-4">
              <div class="flex items-center space-x-2">
                <span class="text-[10px] font-black text-amber-900/50 uppercase">From:</span>
                <span class="font-bold text-lg">{getLocationName(quest.pickupLocationId)}</span>
              </div>
              <div class="flex items-center space-x-2">
                <span class="text-[10px] font-black text-amber-900/50 uppercase">To:</span>
                <span class="font-bold text-lg">{getLocationName(quest.dropoffLocationId)}</span>
              </div>
              
              <div class="pt-4 border-t border-stone-200 flex justify-between items-end">
                <div>
                  <span class="block text-[8px] text-stone-400 uppercase font-black tracking-widest leading-none mb-1">達成報酬</span>
                  <span class="text-2xl font-black text-[#7b1818] italic">¥{quest.reward.toLocaleString()}</span>
                </div>
                <div class="text-right">
                  <span class="block text-[8px] text-stone-400 uppercase font-black tracking-widest leading-none mb-1">Date</span>
                  <span class="text-[10px] font-mono font-bold text-stone-500">{new Date(quest.createdAt).toLocaleDateString()}</span>
                </div>
              </div>
            </div>
          </a>
        {/each}
      </div>
    {/if}

    <div class="text-center pt-12">
      <a href="/order" class="inline-block border-2 border-amber-800 text-amber-700 px-8 py-3 text-xs font-black uppercase tracking-[0.2em] hover:bg-amber-900 hover:text-amber-100 transition-colors">
        ＋ クエストを依頼する
      </a>
    </div>
  </div>
</div>
