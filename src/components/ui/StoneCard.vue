<script setup>
defineProps({
  className: {
    type: String,
    default: '',
  },
})
</script>

<template>
  <div class="moldura-pedra" :class="className">
    <slot />
  </div>
</template>
