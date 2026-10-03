<script setup lang="ts">
/**
 * 画布右键菜单
 * - 分组展示，带分隔线
 * - 根据上下文（单选/多选/空白处/是否锁定）动态显隐与置灰
 * - 通过菜单项 action 事件通知外部处理
 */
import { computed, onMounted, onBeforeUnmount, ref } from 'vue'
import type { ContextMenuStateData } from '../composables/useContextMenu'
import { useCanvasStore } from '../stores/canvasStore'

const props = defineProps<{
  state: ContextMenuStateData
}>()

const emit = defineEmits<{
  (e: 'action', action: string): void
  (e: 'close'): void
}>()

const store = useCanvasStore()

const isEditMode = computed(() => store.instance.value?.isEditMode?.() ?? true)

const menuStyle = computed(() => ({
  left: props.state.x + 'px',
  top: props.state.y + 'px',
}))

/** 处理菜单项点击 */
const run = (action: string) => {
  emit('action', action)
  emit('close')
}

/** 菜单根元素引用（用于判断点击是否在菜单内部） */
const menuRef = ref<HTMLElement | null>(null)

/** 点击外部关闭 */
const onGlobalClick = (e: MouseEvent) => {
  const target = e.target as Node | null
  if (menuRef.value && target && menuRef.value.contains(target)) return
  emit('close')
}

const onEsc = (e: KeyboardEvent) => {
  if (e.key === 'Escape') emit('close')
}

onMounted(() => {
  window.addEventListener('mousedown', onGlobalClick)
  window.addEventListener('contextmenu', onGlobalClick)
  window.addEventListener('keydown', onEsc)
})

onBeforeUnmount(() => {
  window.removeEventListener('mousedown', onGlobalClick)
  window.removeEventListener('contextmenu', onGlobalClick)
  window.removeEventListener('keydown', onEsc)
})

// 锁定状态
const locked = computed(() => props.state.locked)
</script>

<template>
  <Teleport to="body">
    <div
      ref="menuRef"
      v-if="state.visible && isEditMode"
      class="koru-ctx-menu"
      :style="menuStyle"
      @contextmenu.prevent.stop
    >
      <!-- 业务入口：仅单选图元时显示 -->
      <!-- <template v-if="state.onNode && !state.multi">
        <div class="koru-ctx-group">
          <div class="koru-ctx-item" @click="run('openProperty')">编辑属性</div>
          <div class="koru-ctx-item" @click="run('editAnim')">编辑动效</div>
          <div class="koru-ctx-item" @click="run('editTrigger')">编辑事件</div>
          <div class="koru-ctx-item" @click="run('editBinding')">编辑绑定</div>
        </div>
      </template> -->

      <!-- 图层层级：选中图元时显示 -->
      <!-- <template v-if="state.onNode">
        <div class="koru-ctx-group">
          <div
            class="koru-ctx-item"
            :class="{ disabled: !state.onNode }"
            @click="state.onNode && run('toFront')"
          >
            置顶
          </div>
          <div
            class="koru-ctx-item"
            :class="{ disabled: !state.onNode }"
            @click="state.onNode && run('toBack')"
          >
            置底
          </div>
          <div
            class="koru-ctx-item"
            :class="{ disabled: !state.onNode }"
            @click="state.onNode && run('upLayer')"
          >
            上移一层
          </div>
          <div
            class="koru-ctx-item"
            :class="{ disabled: !state.onNode }"
            @click="state.onNode && run('downLayer')"
          >
            下移一层
          </div>
        </div>
      </template> -->

      <!-- 旋转 / 翻转 -->
      <template v-if="state.onNode">
        <div class="koru-ctx-group">
          <div
            class="koru-ctx-item"
            :class="{ disabled: !state.onNode }"
            @click="state.onNode && run('rotateCW')"
          >
            旋转 90°
          </div>
          <!-- <div
            class="koru-ctx-item"
            :class="{ disabled: !state.onNode }"
            @click="state.onNode && run('flipH')"
          >
            水平翻转
          </div>
          <div
            class="koru-ctx-item"
            :class="{ disabled: !state.onNode }"
            @click="state.onNode && run('flipV')"
          >
            垂直翻转
          </div> -->
        </div>
      </template>

      <!-- 组合 / 多状态 -->
      <div class="koru-ctx-group">
        <div
          class="koru-ctx-item"
          :class="{ disabled: !state.multi }"
          @click="state.multi && run('combine')"
        >
          组合
        </div>
        <div
          class="koru-ctx-item"
          :class="{ disabled: !state.canMultiState }"
          @click="state.canMultiState && run('combineState')"
        >
          组合为状态
        </div>
        <div
          class="koru-ctx-item"
          :class="{ disabled: !state.grouped }"
          @click="state.grouped && run('uncombine')"
        >
          取消组合
        </div>
        <div v-if="state.isMultiState" class="koru-ctx-item" @click="run('uncombineMultiState')">
          取消多状态组合
        </div>
      </div>

      <!-- 锁定 / 解锁 -->
      <div class="koru-ctx-group">
        <div v-if="state.onNode && !locked" class="koru-ctx-item" @click="run('lock')">锁定</div>
        <div v-else-if="state.onNode && locked" class="koru-ctx-item" @click="run('unlock')">
          解锁
        </div>
      </div>

      <!-- 删除 -->
      <div class="koru-ctx-group">
        <div
          class="koru-ctx-item koru-ctx-item--danger"
          :class="{ disabled: !state.onNode || locked }"
          @click="state.onNode && !locked && run('delete')"
        >
          删除 <span class="koru-ctx-shortcut">Delete</span>
        </div>
      </div>

      <!-- 历史 -->
      <div class="koru-ctx-group">
        <div class="koru-ctx-item" @click="run('undo')">
          撤销 <span class="koru-ctx-shortcut">Ctrl+Z</span>
        </div>
        <div class="koru-ctx-item" @click="run('redo')">
          重做 <span class="koru-ctx-shortcut">Ctrl+Shift+Z</span>
        </div>
      </div>

      <!-- 剪贴板 -->
      <div class="koru-ctx-group">
        <div
          class="koru-ctx-item"
          :class="{ disabled: !state.onNode || locked }"
          @click="state.onNode && !locked && run('cut')"
        >
          剪切 <span class="koru-ctx-shortcut">Ctrl+X</span>
        </div>
        <div
          class="koru-ctx-item"
          :class="{ disabled: !state.onNode }"
          @click="state.onNode && run('copy')"
        >
          复制 <span class="koru-ctx-shortcut">Ctrl+C</span>
        </div>
        <div
          class="koru-ctx-item"
          :class="{ disabled: !state.canPaste }"
          @click="state.canPaste && run('paste')"
        >
          粘贴 <span class="koru-ctx-shortcut">Ctrl+V</span>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.koru-ctx-menu {
  position: fixed;
  z-index: 10000;
  min-width: 180px;
  background: #fff;
  border: 1px solid #e5e6eb;
  border-radius: 6px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
  padding: 4px;
  font-size: 13px;
  user-select: none;
}

.koru-ctx-group + .koru-ctx-group {
  border-top: 1px solid #f2f3f5;
  margin-top: 4px;
  padding-top: 4px;
}

.koru-ctx-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 6px 10px;
  border-radius: 4px;
  color: #1d2129;
  cursor: pointer;
  white-space: nowrap;
}

.koru-ctx-item:hover:not(.disabled) {
  background: #e8f3ff;
  color: #165dff;
}

.koru-ctx-item.disabled {
  color: #c9cdd4;
  cursor: not-allowed;
}

.koru-ctx-item--danger:hover:not(.disabled) {
  background: #ffece8;
  color: #f53f3f;
}

.koru-ctx-shortcut {
  font-size: 11px;
  color: #86909c;
}
</style>
