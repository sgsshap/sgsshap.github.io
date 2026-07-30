<script setup lang="ts">
import { useDiyHistoryStore } from '@/features/diy-card/stores'
import {
  DIY_HISTORY_CATEGORY_LABELS,
  DIY_HISTORY_MAX_ENTRIES,
} from '@/features/diy-card/types/diy/history'
import { isDiyCanvasShortcutBlocked } from '@/features/diy-card/utils/historyShortcuts'
import { CloseRound, HistoryRound, PushPinRound, RedoRound, UndoRound } from '@vicons/material'
import { computed, onMounted, onUnmounted, ref } from 'vue'

/* 依赖注入 */
const historyStore = useDiyHistoryStore()

/* 状态定义 */
const showHistoryPanel = ref(false)
/** 固定后点击外部、跳转步骤不会自动关闭面板 */
const historyPanelPinned = ref(false)

/* 计算属性 */
const historyPanelTitle = computed(() => {
  const kindLabel =
    historyStore.activeInfoKind === 'legend'
      ? '武将牌'
      : historyStore.activeInfoKind === 'game'
        ? '游戏牌'
        : '标记牌'
  return `${kindLabel}操作历史`
})

const historyLimitHint = computed(
  () =>
    `最多保留 ${DIY_HISTORY_MAX_ENTRIES} 条历史`,
)

/* 核心逻辑 */
const formatTime = (timestamp: number) => {
  const date = new Date(timestamp)
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}:${String(date.getSeconds()).padStart(2, '0')}`
}

const handleUndo = () => {
  void historyStore.undo()
}

const handleRedo = () => {
  void historyStore.redo()
}

const handleJump = (index: number) => {
  void historyStore.jumpTo(index)
  if (!historyPanelPinned.value) {
    showHistoryPanel.value = false
  }
}

const toggleHistoryPanelPin = () => {
  historyPanelPinned.value = !historyPanelPinned.value
}

const closeHistoryPanel = () => {
  showHistoryPanel.value = false
}

const onHistoryPanelShowUpdate = (show: boolean) => {
  if (!show && historyPanelPinned.value) return
  showHistoryPanel.value = show
}

const onKeyDown = (event: KeyboardEvent) => {
  if (!(event.ctrlKey || event.metaKey)) return
  if (isDiyCanvasShortcutBlocked()) return

  const key = event.key.toLowerCase()
  if (key === 'z' && !event.shiftKey) {
    event.preventDefault()
    void historyStore.undo()
    return
  }
  if (key === 'y' || (key === 'z' && event.shiftKey)) {
    event.preventDefault()
    void historyStore.redo()
  }
}

onMounted(() => globalThis.addEventListener('keydown', onKeyDown))
onUnmounted(() => globalThis.removeEventListener('keydown', onKeyDown))
</script>

<template>
  <div class="diy-history-bar">
    <n-button-group>
      <n-tooltip trigger="hover">
        <template #trigger>
          <n-button :disabled="!historyStore.canUndo" @click="handleUndo">
            <template #icon>
              <n-icon><UndoRound /></n-icon>
            </template>
            上一步
          </n-button>
        </template>
        Ctrl+Z
      </n-tooltip>
      <n-tooltip trigger="hover">
        <template #trigger>
          <n-button :disabled="!historyStore.canRedo" @click="handleRedo">
            <template #icon>
              <n-icon><RedoRound /></n-icon>
            </template>
            下一步
          </n-button>
        </template>
        Ctrl+Y / Ctrl+Shift+Z
      </n-tooltip>
    </n-button-group>

    <n-popover
      :show="showHistoryPanel"
      trigger="click"
      placement="bottom-start"
      :width="320"
      display-directive="show"
      @update:show="onHistoryPanelShowUpdate"
    >
      <template #trigger>
        <n-button secondary type="primary">
          <template #icon>
            <n-icon><HistoryRound /></n-icon>
          </template>
          操作历史
        </n-button>
      </template>
      <div class="diy-history-bar__panel">
        <div class="diy-history-bar__panel-head">
          <span class="diy-history-bar__panel-title">{{ historyPanelTitle }}</span>
          <div class="diy-history-bar__panel-actions">
            <n-tooltip trigger="hover">
              <template #trigger>
                <n-button
                  quaternary
                  circle
                  size="small"
                  :type="historyPanelPinned ? 'warning' : 'default'"
                  @click="toggleHistoryPanelPin"
                >
                  <template #icon>
                    <n-icon :size="18"><PushPinRound /></n-icon>
                  </template>
                </n-button>
              </template>
              {{ historyPanelPinned ? '取消固定' : '固定面板' }}
            </n-tooltip>
            <n-tooltip trigger="hover">
              <template #trigger>
                <n-button quaternary circle size="small" @click="closeHistoryPanel">
                  <template #icon>
                    <n-icon :size="18"><CloseRound /></n-icon>
                  </template>
                </n-button>
              </template>
              关闭
            </n-tooltip>
          </div>
        </div>
        <n-scrollbar style="max-height: 360px">
          <div v-if="historyStore.recentEntriesDesc.length === 0" class="diy-history-bar__empty">
            暂无记录
          </div>
          <button
            v-for="{ entry, index } in historyStore.recentEntriesDesc"
            :key="entry.id"
            type="button"
            class="diy-history-bar__item"
            :class="{
              'diy-history-bar__item--active': index === historyStore.activeStack.index,
              'diy-history-bar__item--anchor': entry.isAnchor,
            }"
            @click="handleJump(index)"
          >
            <span class="diy-history-bar__item-label">{{ entry.label || '未命名操作' }}</span>
            <span class="diy-history-bar__item-meta">
              <span class="diy-history-bar__item-tag">{{
                entry.isAnchor ? '初始' : DIY_HISTORY_CATEGORY_LABELS[entry.category]
              }}</span>
              <span class="diy-history-bar__item-time">{{ formatTime(entry.createdAt) }}</span>
            </span>
          </button>
        </n-scrollbar>
        <p class="diy-history-bar__hint">点击任一步骤可撤回到该状态</p>
        <p
          class="diy-history-bar__limit"
          :class="{ 'diy-history-bar__limit--warn': historyStore.isHistoryAtLimit }"
        >
          {{ historyLimitHint }}
        </p>
      </div>
    </n-popover>
  </div>
</template>

<style scoped>
.diy-history-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  justify-content: center;
  width: 100%;
  max-width: var(--diy-card-max-width);
}

.diy-history-bar__panel {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 4px 0;
}

.diy-history-bar__panel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 0 4px 8px;
  border-bottom: 1px solid var(--divider-color);
}

.diy-history-bar__panel-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-color-base);
  line-height: 1.35;
}

.diy-history-bar__panel-actions {
  display: flex;
  align-items: center;
  gap: 2px;
  flex-shrink: 0;
}

.diy-history-bar__empty {
  padding: 16px 8px;
  text-align: center;
  color: var(--text-color-3);
  font-size: 13px;
}

.diy-history-bar__item {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
  width: 100%;
  padding: 10px 12px;
  border: none;
  border-radius: 8px;
  background: transparent;
  cursor: pointer;
  text-align: left;
  transition: background 0.15s ease;
}

.diy-history-bar__item:hover {
  background: color-mix(in srgb, var(--primary-color) 8%, transparent);
}

.diy-history-bar__item--active {
  background: color-mix(in srgb, var(--primary-color) 14%, transparent);
  box-shadow: inset 3px 0 0 var(--primary-color);
}

.diy-history-bar__item--anchor .diy-history-bar__item-label {
  color: var(--text-color-2);
}

.diy-history-bar__item-label {
  font-size: 14px;
  color: var(--text-color-base);
  line-height: 1.35;
}

.diy-history-bar__item-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 11px;
  color: var(--text-color-3);
}

.diy-history-bar__item-tag {
  padding: 1px 6px;
  border-radius: 4px;
  background: color-mix(in srgb, var(--text-color-3) 12%, transparent);
}

.diy-history-bar__hint {
  margin: 0;
  padding: 4px;
  font-size: 11px;
  color: var(--text-color-3);
}

.diy-history-bar__limit {
  margin: 0;
  padding: 4px 4px 0;
  font-size: 11px;
  line-height: 1.45;
  color: var(--text-color-3);
}

.diy-history-bar__limit--warn {
  color: var(--warning-color);
}
</style>
