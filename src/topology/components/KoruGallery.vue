<template>
  <KoruModal
    :visible="visible"
    title="图库管理"
    :width="960"
    @update:visible="(v: boolean) => emit('update:visible', v)"
    @cancel="handleCancel"
  >
    <div class="koru-gallery-body">
      <div class="koru-gallery-header">
        <span class="koru-gallery-count">共 {{ totalCount }} 个图元</span>
        <div class="koru-gallery-header-actions">
          <button class="k-btn k-btn--sm" @click="showAll">全部显示</button>
          <button class="k-btn k-btn--sm" @click="hideAll">全部隐藏</button>
        </div>
      </div>

      <div class="koru-gallery-layout">
        <div class="koru-gallery-groups">
          <div
            v-for="group in groupedByStencilGroup"
            :key="group.name"
            class="koru-gallery-group-nav"
            :class="{ active: expandedGroupKey === group.name }"
            @click="toggleGroupExpand(group.name)"
          >
            <span class="koru-gallery-arrow" :class="{ expanded: expandedGroupKey === group.name }"
              >&#9654;</span
            >
            <span class="koru-gallery-group-name">{{ group.title }}</span>
            <span class="koru-gallery-group-count"
              >{{ visibleCount(group.items) }}/{{ group.items.length }}</span
            >
            <label class="k-switch" @click.stop>
              <input
                type="checkbox"
                :checked="group.allVisible"
                @change="(e: Event) => onToggleGroup(group.name, (e.target as HTMLInputElement).checked)"
              />
              <span class="k-switch-track"></span>
            </label>
          </div>
        </div>

        <div class="koru-gallery-content">
          <div
            v-for="group in groupedByStencilGroup"
            v-show="expandedGroupKey === group.name"
            :key="group.name"
            class="koru-gallery-list"
          >
            <div v-for="item in group.items" :key="item.key" class="koru-gallery-item">
              <div v-if="item.thumbnail" class="koru-gallery-thumb">
                <img :src="item.thumbnail" alt="" />
              </div>
              <div class="koru-gallery-name" :title="item.name">{{ item.name }}</div>
              <span class="koru-gallery-type" :class="item.type">
                {{ item.type === 'image' ? '图片' : item.type === 'node' ? '节点' : 'SVG' }}
              </span>
            </div>
          </div>
          <div
            v-if="totalCount === 0 || !expandedGroupKey"
            class="k-empty"
          >
            {{ totalCount === 0 ? '暂无图元资源' : '点击左侧大类查看图元' }}
          </div>
        </div>
      </div>
    </div>
  </KoruModal>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import KoruModal from './KoruModal.vue'

export interface GalleryResourceItem {
  key: string
  name: string
  type: 'svg' | 'image' | 'node'
  groupName: string
  groupKey: string
  visible: boolean
  thumbnail?: string
}

const props = withDefaults(
  defineProps<{
    visible: boolean
    items: GalleryResourceItem[]
  }>(),
  {
    items: () => [],
  },
)

const emit = defineEmits<{
  (e: 'update:visible', v: boolean): void
  (e: 'toggleGroup', groupKey: string, visible: boolean): void
  (e: 'showAll'): void
  (e: 'hideAll'): void
}>()

const totalCount = computed(() => props.items.length)

const groupedByStencilGroup = computed(() => {
  const map: Record<
    string,
    { name: string; title: string; items: GalleryResourceItem[]; allVisible: boolean }
  > = {}
  props.items.forEach((item) => {
    if (!map[item.groupKey]) {
      map[item.groupKey] = {
        name: item.groupKey,
        title: item.groupName,
        items: [],
        allVisible: true,
      }
    }
    map[item.groupKey].items.push(item)
  })
  Object.keys(map).forEach((key) => {
    map[key].allVisible = map[key].items.every((i) => i.visible)
  })
  return Object.keys(map).map((key) => map[key])
})

const visibleCount = (list: GalleryResourceItem[]) => list.filter((i) => i.visible).length

const expandedGroupKey = ref<string | null>(null)

const toggleGroupExpand = (groupKey: string) => {
  expandedGroupKey.value = groupKey
}

const onToggleGroup = (groupKey: string, val: boolean) => {
  emit('toggleGroup', groupKey, val)
}

const showAll = () => emit('showAll')
const hideAll = () => emit('hideAll')

const handleCancel = () => {
  emit('update:visible', false)
}

watch(
  () => props.visible,
  (val) => {
    if (val && groupedByStencilGroup.value.length > 0 && expandedGroupKey.value === null) {
      expandedGroupKey.value = groupedByStencilGroup.value[0].name
    }
  },
)
</script>

<style scoped>
.koru-gallery-body {
  display: flex;
  flex-direction: column;
  gap: 16px;
  max-height: 70vh;
  overflow-y: auto;
}

.koru-gallery-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
}

.koru-gallery-header-actions {
  display: flex;
  gap: 8px;
}

.koru-gallery-count {
  font-size: 13px;
  color: #86909c;
}

.koru-gallery-layout {
  display: flex;
  gap: 16px;
  min-height: 300px;
}

.koru-gallery-groups {
  width: 180px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
  border-right: 1px solid #e5e6eb;
  padding-right: 12px;
}

.koru-gallery-group-nav {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 10px;
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.2s;
}

.koru-gallery-group-nav:hover {
  background: #f2f3f5;
}

.koru-gallery-group-nav.active {
  background: #e8f3ff;
}

.koru-gallery-arrow {
  font-size: 10px;
  color: #86909c;
  transition: transform 0.2s;
  display: inline-block;
}

.koru-gallery-arrow.expanded {
  transform: rotate(90deg);
}

.koru-gallery-group-name {
  flex: 1;
  font-size: 13px;
  font-weight: 500;
  color: #1d2129;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.koru-gallery-group-count {
  font-size: 12px;
  color: #86909c;
}

.koru-gallery-content {
  flex: 1;
  min-width: 0;
  overflow-y: auto;
  padding-top: 20px;
}

.koru-gallery-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
  gap: 8px;
}

.koru-gallery-item {
  width: 100px;
  text-align: center;
  padding: 8px 10px;
  border: 1px solid #e5e6eb;
  border-radius: 6px;
  background: #fff;
  position: relative;
}

.koru-gallery-thumb {
  width: 48px;
  height: 48px;
  margin: 0 auto;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  overflow: hidden;
  background: #fff;
  padding: 4px;

  img {
    width: 100%;
    height: 100%;
    object-fit: contain;
  }
}

.koru-gallery-name {
  flex: 1;
  min-width: 0;
  font-size: 13px;
  color: #1d2129;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-top: 10px;
}

.koru-gallery-type {
  font-size: 11px;
  padding: 1px 5px;
  border-radius: 3px;
  margin-left: 4px;
  position: absolute;
  top: -15px;
  right: 0;

  &.image {
    background: #e8f3ff;
    color: #165dff;
  }

  &.svg {
    background: #e8ffea;
    color: #00b42a;
  }

  &.node {
    background: #fff7e8;
    color: #ff7d00;
  }
}
</style>
