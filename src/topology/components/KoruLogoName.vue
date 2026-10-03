<template>
  <div class="koru-logo-name">
    <img :src="logo || defaultLogo" class="koru-logo-name__logo" alt="" />
    <div class="koru-logo-name__name">{{ name || 'Mollu-Koru' }}</div>
  </div>
</template>

<script setup lang="ts">
import defaultLogo from '../../assets/logo.png'

withDefaults(
  defineProps<{
    logo: string
    name: string
  }>(),
  {
    logo: '',
    name: '',
  },
)
</script>

<style lang="scss">
.koru-logo-name {
  width: 195px;
  display: flex;
  flex-shrink: 0;
  align-items: center;
  gap: 8px;

  &__logo {
    height: 36px;
    max-width: 50px;
    border-radius: 3px;
  }

  &__name {
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
    font-size: 14px;
    color: #333;
  }
}
</style>
