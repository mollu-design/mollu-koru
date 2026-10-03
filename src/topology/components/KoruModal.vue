<template>
  <teleport to="body">
    <transition name="koru-modal-fade">
      <div v-if="visible" class="koru-modal-overlay" @click.self="handleOverlayClick">
        <div class="koru-modal" :style="{ width: width + 'px' }">
          <div class="koru-modal-header">
            <span class="koru-modal-title">{{ title }}</span>
            <button class="koru-modal-close" @click="handleCancel">&times;</button>
          </div>
          <div class="koru-modal-body">
            <slot />
          </div>
          <div v-if="$slots.footer" class="koru-modal-footer">
            <slot name="footer" />
          </div>
          <div v-else-if="showFooter" class="koru-modal-footer">
            <button class="k-btn" @click="handleCancel">{{ cancelText }}</button>
            <button class="k-btn k-btn--primary" @click="handleOk">{{ okText }}</button>
          </div>
        </div>
      </div>
    </transition>
  </teleport>
</template>

<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    visible: boolean
    title: string
    width?: number
    showFooter?: boolean
    okText?: string
    cancelText?: string
  }>(),
  {
    width: 520,
    showFooter: false,
    okText: '确定',
    cancelText: '取消',
  },
)

const emit = defineEmits<{
  (e: 'update:visible', v: boolean): void
  (e: 'ok'): void
  (e: 'cancel'): void
}>()

const handleOk = () => {
  emit('ok')
}

const handleOverlayClick = () => {
  handleCancel()
}

const handleCancel = () => {
  emit('update:visible', false)
  emit('cancel')
}
</script>

<style lang="scss">
.koru-modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 1000;
  background: rgba(0, 0, 0, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
}

.koru-modal {
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
  max-height: 85vh;
  display: flex;
  flex-direction: column;
}

.koru-modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 24px;
  border-bottom: 1px solid #e8e8e8;
}

.koru-modal-title {
  font-size: 16px;
  font-weight: 600;
  color: #1d2129;
}

.koru-modal-close {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: none;
  font-size: 20px;
  color: #86909c;
  cursor: pointer;
  border-radius: 4px;
  transition: all 0.2s;
}

.koru-modal-close:hover {
  background: #f2f3f5;
  color: #1d2129;
}

.koru-modal-body {
  flex: 1;
  overflow-y: auto;
  padding: 16px 24px;
}

.koru-modal-footer {
  padding: 12px 24px;
  border-top: 1px solid #e8e8e8;
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.koru-modal-fade-enter-active,
.koru-modal-fade-leave-active {
  transition: opacity 0.2s ease;
}

.koru-modal-fade-enter-from,
.koru-modal-fade-leave-to {
  opacity: 0;
}
</style>
