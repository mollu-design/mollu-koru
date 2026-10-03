<template>
  <teleport to="body">
    <transition name="koru-confirm-fade">
      <div v-if="visible" class="koru-confirm-overlay" @click.self="handleCancel">
        <div class="koru-confirm-dialog" :class="`koru-confirm--${type}`">
          <div class="koru-confirm-header">
            <div class="koru-confirm-icon">
              <!-- info -->
              <svg v-if="type === 'info'" viewBox="0 0 24 24" width="48" height="48">
                <circle cx="12" cy="12" r="10" fill="#e8f3ff"/>
                <path fill="#165dff" d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm1 15h-2v-6h2zm0-8h-2V7h2z"/>
              </svg>
              <!-- warning -->
              <svg v-else-if="type === 'warning'" viewBox="0 0 24 24" width="48" height="48">
                <path fill="#fff7e8" d="M12 2L1 21h22z"/>
                <path fill="#ff7d00" d="M12 2L1 21h22L12 2zm0 5l8.5 14h-17L12 7z"/>
                <path fill="#ff7d00" d="M12 10l-1 5h2l-1-5zm0 7a1 1 0 1 0 0 2 1 1 0 0 0 0-2z"/>
              </svg>
              <!-- danger -->
              <svg v-else viewBox="0 0 24 24" width="48" height="48">
                <circle cx="12" cy="12" r="10" fill="#ffece8"/>
                <path fill="#f53f3f" d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm1 15h-2v-2h2zm0-4h-2V7h2z"/>
              </svg>
            </div>
            <div class="koru-confirm-title">{{ title }}</div>
          </div>
          <div class="koru-confirm-message">{{ content }}</div>
          <div class="koru-confirm-footer">
            <button class="k-btn" @click="handleCancel">{{ cancelText }}</button>
            <button
              class="k-btn"
              :class="okBtnClass"
              :disabled="loading"
              @click="handleOk"
            >
              {{ loading ? '处理中...' : okText }}
            </button>
          </div>
        </div>
      </div>
    </transition>
  </teleport>
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{
    visible: boolean
    title: string
    content: string
    type?: 'info' | 'warning' | 'danger'
    okText?: string
    cancelText?: string
    loading?: boolean
  }>(),
  {
    type: 'info',
    okText: '确定',
    cancelText: '取消',
    loading: false,
  },
)

const emit = defineEmits<{
  (e: 'update:visible', v: boolean): void
  (e: 'ok'): void
  (e: 'cancel'): void
}>()

const okBtnClass = 'k-btn--primary'

function handleOk() {
  emit('ok')
  emit('update:visible', false)
}

function handleCancel() {
  emit('cancel')
  emit('update:visible', false)
}
</script>

<style scoped>
.koru-confirm-overlay {
  position: fixed;
  inset: 0;
  z-index: 2000;
  background: rgba(0, 0, 0, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
}

.koru-confirm-dialog {
  width: 420px;
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.18);
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.koru-confirm-header {
  display: flex;
  align-items: center;
  gap: 12px;
}

.koru-confirm-icon {
  width: 48px;
  height: 48px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.koru-confirm-title {
  font-size: 16px;
  font-weight: 600;
  color: #1d2129;
}

.koru-confirm-message {
  font-size: 13px;
  color: #4e5969;
  line-height: 1.6;
  word-break: break-word;
}

.koru-confirm-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 8px;
}

/* type → ok 按钮颜色 */
.koru-confirm--warning .koru-confirm-footer .k-btn--primary {
  background: #ff7d00;
  border-color: #ff7d00;
}
.koru-confirm--warning .koru-confirm-footer .k-btn--primary:hover {
  background: #ff9a2e;
  border-color: #ff9a2e;
}

.koru-confirm--danger .koru-confirm-footer .k-btn--primary {
  background: #f53f3f;
  border-color: #f53f3f;
}
.koru-confirm--danger .koru-confirm-footer .k-btn--primary:hover {
  background: #ff6b6b;
  border-color: #ff6b6b;
}

/* transition */
.koru-confirm-fade-enter-active,
.koru-confirm-fade-leave-active {
  transition: opacity 0.2s ease;
}
.koru-confirm-fade-enter-from,
.koru-confirm-fade-leave-to {
  opacity: 0;
}
</style>
