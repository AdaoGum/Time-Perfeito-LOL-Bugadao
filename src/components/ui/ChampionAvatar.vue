<script setup>
import { computed } from 'vue'
import { championImage } from '../../utils/helpers'

const props = defineProps({
  championName: {
    type: String,
    default: 'Aatrox',
  },
  sizeClass: {
    type: String,
    default: 'h-16 w-16',
  },
  selected: {
    type: Boolean,
    default: false,
  },
})

const avatarClass = computed(() =>
  props.selected
    ? 'border-lime-400 shadow-[0_0_18px_rgba(163,230,53,0.35)]'
    : 'border-stone-700',
)
</script>

<template>
  <img
    :src="championImage(championName)"
    :alt="championName"
    :class="[sizeClass, avatarClass, 'rounded-2xl border object-cover']"
    loading="lazy"
  />
</template>
