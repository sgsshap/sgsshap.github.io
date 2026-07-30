<script setup lang="ts">
import OtherConfig from '@/features/diy-card/components/config/OtherConfig.vue'
import {
  resolveSkillsDescAutoSizeFlag,
  SKILL_DESC_AUTO_SIZE_MAX_FONT_PT,
  SKILL_DESC_AUTO_SIZE_MIN_FONT_PT,
  SKILL_DESC_AUTO_SIZE_STEP_PT,
  SKILL_DESC_MAX_FONT_PT,
  SKILL_DESC_MIN_FONT_PT,
} from '@/features/diy-card/components/templates/new-ui-zhuoyue/composables/constants/skills'
import { applySkillsDescFontSizePt } from '@/features/diy-card/components/templates/new-ui-zhuoyue/composables/layout/skills-area/layout'
import { clampSkillsDescEditableFontSizePt } from '@/features/diy-card/components/templates/new-ui-zhuoyue/composables/layout/skills-area/scale'
import { isKingdomGlyphCode } from '@/features/diy-card/composables/doubleKingdom'
import {
  adjustCanvasItemScaleOrFontSize,
  CANVAS_MOVE_STEP_MM,
  nudgeCanvasItemPosition,
  nudgeCanvasItemRotation,
} from '@/features/diy-card/composables/preview/diyCanvasElementAdjust'
import { useDiyDrawerRoute } from '@/features/diy-card/composables/useDiyDrawerRoute'
import { useDiyStore, useInfoStore } from '@/features/diy-card/stores'
import type { LayoutItem } from '@/features/diy-card/types/diy/base'
import type { LegendInfo } from '@/features/diy-card/types/diy/legend'
import { applyFieldChange } from '@/features/diy-card/utils/diyHistoryField'
import {
  record,
  resetCanvasAndHistoryCompletely,
  resetCanvasToInitial,
} from '@/features/diy-card/utils/diyHistoryRecord'
import { hasLayoutFontSize } from '@/features/diy-card/utils/layoutItem'
import { usePhysicalKeyboardDetection } from '@/shared/composables/usePhysicalKeyboardDetection'
import { bindHoldRepeatAction } from '@/shared/composables/useHoldRepeatAction'
import {
  dismissDiyTutorialBanner,
  DIY_TUTORIAL_BANNER_DESC,
  DIY_TUTORIAL_BANNER_TITLE,
  isDiyTutorialBannerDismissed,
  openDiyTutorialVideo,
} from '@/shared/constants/site'
import {
  ArrowBackRound,
  ArrowDownwardRound,
  ArrowForwardRound,
  ArrowUpwardRound,
  CloseRound,
  OndemandVideoRound,
  RotateLeftRound,
  RotateRightRound,
  SettingsRound,
  VisibilityOffRound,
  VisibilityRound,
  ZoomInRound,
  ZoomOutRound,
} from '@/shared/icons'
import { useSystemStore } from '@/shared/stores/system'
import { isTouchDevice } from '@/shared/utils/naive/touchDevice'
import { toFixed } from '@/shared/utils/object'
import { useDialog } from 'naive-ui'
import { computed, h, ref } from 'vue'

/* 参数定义 */
const emit = defineEmits<{
  'update:selected-item-property': []
  'sync:selected-item-layout': []
}>()

/* 依赖注入 */
const diyStore = useDiyStore()
const infoStore = useInfoStore()
const legend = computed(() => infoStore.info as LegendInfo)
const systemStore = useSystemStore()
const dialog = useDialog()
const { isSettingsOpen, openSettings, handleDrawerShowUpdate } = useDiyDrawerRoute()
const { physicalKeyboardDetected } = usePhysicalKeyboardDetection()

const selectedItem = computed(() => diyStore.selectedItem)

/** 手机 / 平板，或未检测到物理键盘的触控端 → 图标快速操作栏 */
const showTouchQuickActions = computed(() => {
  if (!selectedItem.value) return false
  if (!systemStore.isDiyPcLayout) return true
  if (isTouchDevice() && !physicalKeyboardDetected.value) return true
  return false
})

const showKeyboardShortcutHint = computed(
  () => Boolean(selectedItem.value) && !showTouchQuickActions.value,
)

const showMoveShortcut = computed(() => Boolean(selectedItem.value?.editable?.movable))
const showScaleShortcut = computed(() => Boolean(selectedItem.value?.editable?.scalable))
const showRotateShortcut = computed(() => Boolean(selectedItem.value?.editable?.rotatable))
const showNoCanvasAdjustHint = computed(
  () =>
    Boolean(selectedItem.value) &&
    !showMoveShortcut.value &&
    !showScaleShortcut.value &&
    !showRotateShortcut.value,
)

const skillsDescAutoSizeEnabled = computed(() =>
  resolveSkillsDescAutoSizeFlag(
    legend.value.renderConfig.items.skillsDesc.autoOptimizeSizeFlag,
    legend.value.renderConfig.items.skillsDesc.autoOptimizeFlag,
  ),
)

const selectedFontSizeMin = computed(() => {
  if (selectedItem.value?.code !== 'skillsDesc') return 0.5
  return skillsDescAutoSizeEnabled.value ? SKILL_DESC_AUTO_SIZE_MIN_FONT_PT : SKILL_DESC_MIN_FONT_PT
})
const selectedFontSizeMax = computed(() => {
  if (selectedItem.value?.code !== 'skillsDesc') return 100
  return skillsDescAutoSizeEnabled.value ? SKILL_DESC_AUTO_SIZE_MAX_FONT_PT : SKILL_DESC_MAX_FONT_PT
})
const selectedFontSizeStep = computed(() => {
  if (selectedItem.value?.code === 'skillsDesc' && skillsDescAutoSizeEnabled.value) {
    return SKILL_DESC_AUTO_SIZE_STEP_PT
  }
  return 0.5
})

/* 状态定义 */
const showSelectedDetails = ref(true)
const showOtherConfig = computed({
  get: () => isSettingsOpen.value,
  set: (visible: boolean) => {
    if (visible) {
      openSettings()
      return
    }
    handleDrawerShowUpdate(false)
  },
})

/* 核心逻辑 */
const selectedItemName = () => diyStore.selectedItem?.name

/**
 * 同步位置/旋转/缩放（不重新加载图片）
 */
const syncSelectedItemLayout = () => {
  emit('sync:selected-item-layout')
}

const syncAndRecordMove = () => {
  syncSelectedItemLayout()
  record({ operation: 'move', itemName: selectedItemName() })
}

const scaleToPercent = (scale: number) => toFixed(scale * 100, 2)

/** 势力字改字号需重载图层；官方 PNG 仅改 scale 时同步布局即可 */
const customKingdomTextNeedsReload = (item: LayoutItem) =>
  (item.code === 'kingdom' || isKingdomGlyphCode(item.code)) && hasLayoutFontSize(item)

const onScalePercentUpdate = (value: number | null) => {
  const item = selectedItem.value
  if (value === null || !item || hasLayoutFontSize(item)) return

  const prevPct = scaleToPercent(item.scale)
  if (value === prevPct) return

  const afterScale = customKingdomTextNeedsReload(item)
    ? reloadSelectedItem
    : syncSelectedItemLayout

  applyFieldChange(
    `${selectedItemName() ?? '画布元素'}缩放`,
    prevPct,
    value,
    (percent) => {
      item.scale = toFixed(percent / 100, 2)
    },
    { category: 'renderConfig', after: afterScale },
  )
}

const syncAndRecordRotate = () => {
  syncSelectedItemLayout()
  record({ operation: 'rotate', itemName: selectedItemName() })
}

const onQuickMove = (dx: number, dy: number) => {
  const item = selectedItem.value
  if (!item) return
  nudgeCanvasItemPosition(item, dx, dy, syncSelectedItemLayout)
}

const onQuickScale = (direction: 1 | -1) => {
  const item = selectedItem.value
  if (!item) return
  adjustCanvasItemScaleOrFontSize(
    item,
    direction,
    syncSelectedItemLayout,
    reloadSelectedItem,
    legend.value,
  )
}

const onQuickRotate = (direction: 1 | -1) => {
  const item = selectedItem.value
  if (!item) return
  nudgeCanvasItemRotation(item, direction, syncSelectedItemLayout)
}

const quickScaleInHold = bindHoldRepeatAction(() => onQuickScale(1))
const quickScaleOutHold = bindHoldRepeatAction(() => onQuickScale(-1))
const quickMoveUpHold = bindHoldRepeatAction(() => onQuickMove(0, -CANVAS_MOVE_STEP_MM))
const quickMoveDownHold = bindHoldRepeatAction(() => onQuickMove(0, CANVAS_MOVE_STEP_MM))
const quickMoveLeftHold = bindHoldRepeatAction(() => onQuickMove(-CANVAS_MOVE_STEP_MM, 0))
const quickMoveRightHold = bindHoldRepeatAction(() => onQuickMove(CANVAS_MOVE_STEP_MM, 0))
const quickRotateLeftHold = bindHoldRepeatAction(() => onQuickRotate(-1))
const quickRotateRightHold = bindHoldRepeatAction(() => onQuickRotate(1))

/**
 * 重载素材（如字号、图片源等需重新渲染）
 */
const reloadSelectedItem = () => {
  emit('update:selected-item-property')
}

const reloadAndRecordFontSize = (value: number | null) => {
  const item = diyStore.selectedItem
  if (value === null || !item || !hasLayoutFontSize(item)) return

  const prev = item.size as number
  const next =
    item.code === 'skillsDesc'
      ? clampSkillsDescEditableFontSizePt(value, skillsDescAutoSizeEnabled.value)
      : value
  if (next === prev) return

  if (item.code === 'skillsDesc') {
    applyFieldChange(
      `${selectedItemName() ?? '画布元素'}字号`,
      prev,
      next,
      (val) => {
        applySkillsDescFontSizePt(legend.value, val, {
          markManual: skillsDescAutoSizeEnabled.value,
        })
      },
      { category: 'renderConfig', after: reloadSelectedItem },
    )
    return
  }

  applyFieldChange(
    `${selectedItemName() ?? '画布元素'}字号`,
    prev,
    next,
    (val) => {
      item.size = val
    },
    { category: 'renderConfig', after: reloadSelectedItem },
  )
}

const resetCanvas = async () => {
  await resetCanvasToInitial()
}

const wipeCanvasAndHistory = async () => {
  await resetCanvasAndHistoryCompletely()
}

const showTutorialBanner = ref(!isDiyTutorialBannerDismissed())

const confirmDismissTutorialBanner = () => {
  dialog.info({
    title: '关闭教学提示',
    content:
      '关闭后，制图页将不再显示该提示。如需再次观看，请前往「系统设置 → 帮助与反馈 → 观看教学视频」。',
    positiveText: '确定关闭',
    negativeText: '取消',
    onPositiveClick: () => {
      showTutorialBanner.value = false
      dismissDiyTutorialBanner()
    },
  })
}

const confirmResetCanvas = () => {
  dialog.warning({
    title: '重置画布',
    content: '恢复默认数据，可撤销。确定继续吗？',
    positiveText: '确定',
    negativeText: '取消',
    onPositiveClick: () => {
      void resetCanvas()
    },
  })
}

const confirmStartFromScratch = () => {
  dialog.error({
    title: '从零开始',
    content: () =>
      h('span', null, [
        '恢复默认数据，',
        h('strong', { class: 'diy-preview-bar__scratch-highlight' }, '清空全部操作历史'),
        '，无法撤销。确定继续吗？',
      ]),
    positiveText: '确定',
    negativeText: '取消',
    onPositiveClick: () => {
      void wipeCanvasAndHistory()
    },
  })
}
</script>

<template>
  <n-drawer
    :show="showOtherConfig"
    display-directive="show"
    :width="systemStore.isDiyPcLayout ? '50%' : '100%'"
    :z-index="systemStore.isDiyPcLayout ? undefined : 1400"
    placement="right"
    :trap-focus="false"
    @update:show="handleDrawerShowUpdate"
  >
    <div class="diy-drawer-shell">
      <n-el tag="div" class="diy-drawer-shell__header diy-preview-bar__drawer-header">
        <div class="diy-drawer-bar">
          <h2 class="diy-drawer-title">详细设置</h2>
          <div class="diy-drawer-bar__trailing">
            <n-button quaternary circle @click="showOtherConfig = false">
              <template #icon>
                <n-icon><CloseRound /></n-icon>
              </template>
            </n-button>
          </div>
        </div>
      </n-el>
      <div class="diy-drawer-shell__body">
        <OtherConfig />
      </div>
    </div>
  </n-drawer>
  <div class="diy-preview-bar">
    <div class="diy-preview-bar__toolbar">
      <n-button type="warning" @click="showOtherConfig = true">
        <n-icon><SettingsRound /></n-icon>
        详细设置
      </n-button>
      <n-button type="error" @click="confirmResetCanvas">重置画布</n-button>
      <n-button type="error" secondary @click="confirmStartFromScratch">从零开始</n-button>
    </div>

    <div v-if="showTutorialBanner" class="diy-preview-bar__tutorial-shell">
      <button
        type="button"
        class="diy-preview-bar__tutorial"
        @click="openDiyTutorialVideo"
      >
        <span class="diy-preview-bar__tutorial-icon" aria-hidden="true">
          <n-icon :size="18"><OndemandVideoRound /></n-icon>
        </span>
        <span class="diy-preview-bar__tutorial-copy">
          <span class="diy-preview-bar__tutorial-title">{{ DIY_TUTORIAL_BANNER_TITLE }}</span>
          <span class="diy-preview-bar__tutorial-desc">{{ DIY_TUTORIAL_BANNER_DESC }}</span>
        </span>
      </button>
      <button
        type="button"
        class="diy-preview-bar__tutorial-dismiss"
        aria-label="关闭并不再显示"
        @click.stop="confirmDismissTutorialBanner"
      >
        <n-icon :size="16"><CloseRound /></n-icon>
      </button>
    </div>

    <n-card title="操作元素" class="diy-panel-card">
      <template #header-extra>
        <n-button
          circle
          type="primary"
          secondary
          size="small"
          @click="showSelectedDetails = !showSelectedDetails"
        >
          <n-icon>
            <VisibilityRound v-if="!showSelectedDetails" />
            <VisibilityOffRound v-else />
          </n-icon>
        </n-button>
      </template>

      <div class="diy-preview-bar__selector">
        <n-select
          v-model:value="diyStore.selectedItemValue"
          :options="diyStore.selectableOptions"
          size="large"
          placeholder="请选择元素"
          class="diy-preview-bar__selector-input"
        />

        <n-collapse-transition :show="showSelectedDetails && !!selectedItem">
          <div v-if="selectedItem" class="diy-preview-bar__panel-shell">
            <div class="diy-preview-bar__panel">
              <div v-if="showKeyboardShortcutHint" class="diy-preview-bar__shortcut-bar">
                <span class="diy-preview-bar__shortcut-bar-title">键盘快捷键</span>
                <div class="diy-preview-bar__shortcut-groups">
                  <div v-if="showMoveShortcut" class="diy-preview-bar__shortcut-group">
                    <span class="diy-preview-bar__shortcut-action">移动</span>
                    <span class="diy-preview-bar__shortcut-keys">
                      <kbd>↑</kbd><kbd>↓</kbd><kbd>←</kbd><kbd>→</kbd>
                    </span>
                  </div>
                  <div v-if="showScaleShortcut" class="diy-preview-bar__shortcut-group">
                    <span class="diy-preview-bar__shortcut-action">加减字号 / 缩放图片</span>
                    <span class="diy-preview-bar__shortcut-keys"> <kbd>+</kbd><kbd>−</kbd> </span>
                  </div>
                  <span v-if="showNoCanvasAdjustHint" class="diy-preview-bar__shortcut-empty">
                    当前元素不可键盘微调
                  </span>
                </div>
              </div>

              <div v-else-if="showTouchQuickActions" class="diy-preview-bar__quick-actions">
                <span class="diy-preview-bar__quick-actions-title">快速操作</span>
                <div v-if="showNoCanvasAdjustHint" class="diy-preview-bar__shortcut-empty">
                  当前元素不可微调
                </div>
                <div v-else class="diy-preview-bar__quick-actions-groups">
                  <div v-if="showScaleShortcut" class="diy-preview-bar__quick-actions-group">
                    <span class="diy-preview-bar__quick-actions-label">缩放</span>
                    <n-button-group class="diy-preview-bar__quick-segment" size="small">
                      <n-button type="primary" v-bind="quickScaleInHold">
                        <template #icon>
                          <n-icon :size="17"><ZoomInRound /></n-icon>
                        </template>
                      </n-button>
                      <n-button type="primary" v-bind="quickScaleOutHold">
                        <template #icon>
                          <n-icon :size="17"><ZoomOutRound /></n-icon>
                        </template>
                      </n-button>
                    </n-button-group>
                  </div>
                  <div v-if="showMoveShortcut" class="diy-preview-bar__quick-actions-group">
                    <span class="diy-preview-bar__quick-actions-label">移动</span>
                    <n-button-group class="diy-preview-bar__quick-segment" size="small">
                      <n-button type="primary" v-bind="quickMoveUpHold">
                        <template #icon>
                          <n-icon :size="17"><ArrowUpwardRound /></n-icon>
                        </template>
                      </n-button>
                      <n-button type="primary" v-bind="quickMoveDownHold">
                        <template #icon>
                          <n-icon :size="17"><ArrowDownwardRound /></n-icon>
                        </template>
                      </n-button>
                      <n-button type="primary" v-bind="quickMoveLeftHold">
                        <template #icon>
                          <n-icon :size="17"><ArrowBackRound /></n-icon>
                        </template>
                      </n-button>
                      <n-button type="primary" v-bind="quickMoveRightHold">
                        <template #icon>
                          <n-icon :size="17"><ArrowForwardRound /></n-icon>
                        </template>
                      </n-button>
                    </n-button-group>
                  </div>
                  <div v-if="showRotateShortcut" class="diy-preview-bar__quick-actions-group">
                    <span class="diy-preview-bar__quick-actions-label">旋转</span>
                    <n-button-group class="diy-preview-bar__quick-segment" size="small">
                      <n-button type="primary" v-bind="quickRotateLeftHold">
                        <template #icon>
                          <n-icon :size="17"><RotateLeftRound /></n-icon>
                        </template>
                      </n-button>
                      <n-button type="primary" v-bind="quickRotateRightHold">
                        <template #icon>
                          <n-icon :size="17"><RotateRightRound /></n-icon>
                        </template>
                      </n-button>
                    </n-button-group>
                  </div>
                </div>
              </div>

              <div class="diy-preview-bar__details">
                <div class="diy-preview-bar__detail">
                  <div class="diy-preview-bar__detail-label">横轴</div>
                  <n-input-number
                    v-model:value="selectedItem.x as number"
                    size="medium"
                    button-placement="both"
                    :precision="2"
                    :step="0.1"
                    @update:value="syncAndRecordMove"
                    :disabled="!selectedItem.editable?.movable"
                  >
                    <template #suffix> mm </template>
                  </n-input-number>
                </div>
                <div class="diy-preview-bar__detail">
                  <div class="diy-preview-bar__detail-label">纵轴</div>
                  <n-input-number
                    v-model:value="selectedItem.y as number"
                    size="medium"
                    button-placement="both"
                    :precision="2"
                    :step="0.1"
                    @update:value="syncAndRecordMove"
                    :disabled="!selectedItem.editable?.movable"
                  >
                    <template #suffix> mm </template>
                  </n-input-number>
                </div>
                <div class="diy-preview-bar__detail" v-if="hasLayoutFontSize(selectedItem)">
                  <div class="diy-preview-bar__detail-label">字号</div>
                  <n-input-number
                    :value="selectedItem.size as number"
                    size="medium"
                    button-placement="both"
                    :precision="2"
                    :step="selectedFontSizeStep"
                    :min="selectedFontSizeMin"
                    :max="selectedFontSizeMax"
                    :disabled="!selectedItem.editable?.scalable"
                    @update:value="reloadAndRecordFontSize"
                  >
                    <template #suffix> pt </template>
                  </n-input-number>
                </div>
                <div class="diy-preview-bar__detail" v-else>
                  <div class="diy-preview-bar__detail-label">缩放</div>
                  <n-input-number
                    :value="scaleToPercent(selectedItem.scale)"
                    size="medium"
                    button-placement="both"
                    :precision="2"
                    :step="1"
                    :min="1"
                    :disabled="hasLayoutFontSize(selectedItem) || !selectedItem.editable?.scalable"
                    @update:value="onScalePercentUpdate"
                  >
                    <template #suffix> % </template>
                  </n-input-number>
                </div>
                <div class="diy-preview-bar__detail">
                  <div class="diy-preview-bar__detail-label">旋转</div>
                  <n-input-number
                    v-model:value="selectedItem.rotation as number"
                    size="medium"
                    button-placement="both"
                    :precision="2"
                    @update:value="syncAndRecordRotate"
                    :disabled="!selectedItem.editable?.rotatable"
                  />
                </div>
                <div class="diy-preview-bar__detail">
                  <div class="diy-preview-bar__detail-label">宽度</div>
                  <n-input-number
                    v-model:value="selectedItem.width as number"
                    size="medium"
                    button-placement="both"
                    :precision="2"
                    disabled
                  >
                    <template #suffix> mm </template>
                  </n-input-number>
                </div>
                <div class="diy-preview-bar__detail">
                  <div class="diy-preview-bar__detail-label">高度</div>
                  <n-input-number
                    v-model:value="selectedItem.height as number"
                    size="medium"
                    button-placement="both"
                    :precision="2"
                    disabled
                  >
                    <template #suffix> mm </template>
                  </n-input-number>
                </div>
              </div>
            </div>
          </div>
        </n-collapse-transition>
      </div>
    </n-card>
  </div>
</template>

<style scoped>
.diy-preview-bar {
  width: 100%;
  max-width: var(--diy-card-max-width);
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.diy-preview-bar__tutorial-shell {
  position: relative;
  width: 100%;
}

.diy-preview-bar__tutorial-dismiss {
  position: absolute;
  top: 50%;
  right: 8px;
  z-index: 3;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  padding: 0;
  border: none;
  border-radius: 50%;
  background: color-mix(in srgb, var(--card-color) 72%, transparent);
  color: var(--text-color-3);
  cursor: pointer;
  transform: translateY(-50%);
  transition:
    color 0.2s ease,
    background-color 0.2s ease;
}

@media (hover: hover) {
  .diy-preview-bar__tutorial-dismiss:hover {
    color: var(--text-color-2);
    background: color-mix(in srgb, var(--card-color) 88%, var(--text-color-base) 12%);
  }
}

.diy-preview-bar__tutorial {
  position: relative;
  overflow: hidden;
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  margin: 0;
  padding: 7px 36px 7px 10px;
  border-radius: 8px;
  --tutorial-accent: var(--info-color, #2080f0);
  background: linear-gradient(
    135deg,
    color-mix(in srgb, var(--tutorial-accent) 10%, var(--card-color)) 0%,
    color-mix(in srgb, var(--primary-color) 6%, var(--card-color)) 100%
  );
  color: var(--text-color-base);
  text-align: left;
  cursor: pointer;
  border: 1px solid color-mix(in srgb, var(--tutorial-accent) 35%, var(--border-color));
  box-shadow: 0 1px 6px color-mix(in srgb, var(--tutorial-accent) 8%, transparent);
  transition:
    border-color 0.2s ease,
    box-shadow 0.2s ease,
    background 0.2s ease;
}

@media (hover: hover) {
  .diy-preview-bar__tutorial:hover {
    border-color: color-mix(in srgb, var(--tutorial-accent) 50%, var(--border-color));
    box-shadow: 0 2px 10px color-mix(in srgb, var(--tutorial-accent) 14%, transparent);
  }
}

.diy-preview-bar__tutorial:active {
  opacity: 0.92;
}

.diy-preview-bar__tutorial-icon,
.diy-preview-bar__tutorial-copy {
  position: relative;
  z-index: 2;
}

.diy-preview-bar__tutorial-icon {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: color-mix(in srgb, var(--warning-color) 16%, var(--card-color));
  color: var(--warning-color);
}

.diy-preview-bar__tutorial-copy {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0;
}

.diy-preview-bar__tutorial-title {
  font-size: 14px;
  font-weight: 600;
  line-height: 1.2;
  color: var(--text-color-base);
}

.diy-preview-bar__tutorial-desc {
  font-size: 11px;
  line-height: 1.25;
  color: var(--text-color-2);
}

@media (max-width: 1023px) {
  .diy-preview-bar__tutorial {
    gap: 10px;
    padding: 10px 38px 10px 12px;
    border-color: color-mix(in srgb, var(--tutorial-accent) 48%, var(--border-color));
    background: linear-gradient(
      135deg,
      color-mix(in srgb, var(--tutorial-accent) 16%, var(--card-color)) 0%,
      color-mix(in srgb, var(--primary-color) 8%, var(--card-color)) 100%
    );
    box-shadow:
      0 2px 10px color-mix(in srgb, var(--tutorial-accent) 14%, transparent),
      inset 0 1px 0 color-mix(in srgb, #fff 10%, transparent);
  }

  .diy-preview-bar__tutorial-icon {
    width: 36px;
    height: 36px;
    background: color-mix(in srgb, var(--warning-color) 22%, var(--card-color));
  }

  .diy-preview-bar__tutorial-icon :deep(.n-icon) {
    font-size: 20px;
  }

  .diy-preview-bar__tutorial-title {
    font-size: 15px;
    font-weight: 700;
  }

  .diy-preview-bar__tutorial-desc {
    font-size: 12px;
    line-height: 1.3;
    color: color-mix(in srgb, var(--tutorial-accent) 55%, var(--text-color-2));
  }

  .diy-preview-bar__tutorial-copy {
    gap: 2px;
  }
}

@media (min-width: 480px) {
  .diy-preview-bar__tutorial {
    padding: 9px 40px 9px 12px;
    gap: 10px;
  }

  .diy-preview-bar__tutorial-copy {
    gap: 3px;
  }

  .diy-preview-bar__tutorial-title {
    line-height: 1.35;
  }

  .diy-preview-bar__tutorial-desc {
    line-height: 1.4;
  }
}

.diy-preview-bar__selector {
  display: flex;
  flex-direction: column;
  gap: 0;
  align-items: stretch;
  border-radius: 8px;
}

.diy-preview-bar__panel-shell {
  display: grid;
  grid-template-rows: 1fr;
  width: 100%;
  margin-top: 10px;
}

.diy-preview-bar__panel {
  width: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 0;
  padding: 0;
  border-radius: calc(var(--page-r, 12px) - 2px);
  background: color-mix(in srgb, var(--body-color) 48%, var(--card-color));
  border: 1px solid color-mix(in srgb, var(--primary-color) 14%, var(--border-color));
  overflow: hidden;
}

.diy-preview-bar__shortcut-bar,
.diy-preview-bar__quick-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 14px;
  padding: 10px 12px;
  background: transparent;
  border-bottom: 1px solid var(--border-color);
}

.diy-preview-bar__shortcut-bar-title,
.diy-preview-bar__quick-actions-title {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 0 0 auto;
  font-size: 14px;
  font-weight: 600;
  color: var(--text-color-base);
  white-space: nowrap;
  padding: 0;
}

.diy-preview-bar__shortcut-bar-title::before,
.diy-preview-bar__quick-actions-title::before {
  content: '';
  width: 4px;
  height: 1em;
  flex-shrink: 0;
  border-radius: 2px;
  background: linear-gradient(
    180deg,
    var(--primary-color) 0%,
    color-mix(in srgb, var(--primary-color) 50%, transparent) 100%
  );
}

.diy-preview-bar__quick-actions-groups {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px 18px;
  flex: 1;
  min-width: 0;
}

.diy-preview-bar__quick-actions-group {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.diy-preview-bar__quick-actions-label {
  font-size: 0.86em;
  color: var(--text-color-2);
  white-space: nowrap;
}

.diy-preview-bar__quick-segment {
  flex: 0 0 auto;
  border-radius: 8px;
  overflow: hidden;
}

.diy-preview-bar__quick-segment :deep(.n-button) {
  min-width: 34px;
  position: relative;
  touch-action: manipulation;
  user-select: none;
  -webkit-user-select: none;
}

.diy-preview-bar__quick-segment :deep(.n-button + .n-button)::before {
  content: '';
  position: absolute;
  left: 0;
  top: 24%;
  bottom: 24%;
  width: 1px;
  background: color-mix(in srgb, #fff 52%, transparent);
  pointer-events: none;
  z-index: 1;
}

.diy-preview-bar__shortcut-groups {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px 18px;
  flex: 1;
  min-width: 0;
}

.diy-preview-bar__shortcut-group {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.diy-preview-bar__shortcut-action {
  font-size: 0.86em;
  color: var(--text-color-2);
  white-space: nowrap;
}

.diy-preview-bar__shortcut-keys {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.diy-preview-bar__shortcut-keys kbd {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 1.75em;
  height: 1.78em;
  padding: 0 0.42em;
  font-family: inherit;
  font-size: 0.86em;
  font-weight: 700;
  line-height: 1;
  border-radius: 6px;
  border: 1px solid color-mix(in srgb, var(--primary-color) 28%, var(--border-color));
  background: color-mix(in srgb, var(--card-color) 80%, var(--action-color));
  color: var(--primary-color);
  box-shadow: none;
}

.diy-preview-bar__shortcut-empty {
  font-size: 0.86em;
  color: var(--text-color-3);
}

.diy-preview-bar__selector-input {
  width: 100%;
}

.diy-preview-bar__details {
  width: 100%;
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  justify-content: flex-start;
  padding: 10px 12px 12px;
}

.diy-preview-bar__detail {
  display: flex;
  align-items: center;
  flex: 1 1 160px;
  min-width: 160px;
  max-width: none;
}

.diy-preview-bar__detail :deep(.n-input-number) {
  flex: 1;
}

.diy-preview-bar__detail-label {
  width: fit-content;
  white-space: nowrap;
  padding: 0 6px;
  font-size: 0.9em;
}

/** 仅极窄屏强制单列；768 会误伤 ~750px 平板/分屏，导致 160px 换行规则失效 */
@media (max-width: 480px) {
  .diy-preview-bar__details {
    padding: 8px 4px;
  }

  .diy-preview-bar__detail {
    flex: 1 1 100%;
    min-width: 0;
  }
}

.diy-preview-bar__toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 10px 12px;
  justify-content: center;
}

.diy-preview-bar__drawer-header {
  position: sticky;
  top: 0;
  z-index: 1;
}
</style>

<!-- 从零开始确认框（Teleport 到 body，样式不可 scoped） -->
<style>
.diy-preview-bar__scratch-highlight {
  color: var(--error-color);
  font-weight: 700;
}
</style>
