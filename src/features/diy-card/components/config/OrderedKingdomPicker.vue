<script setup lang="ts">
import { CloseRound, SwapHorizRound } from '@/shared/icons'
import { getKingdomLabel, sortKingdomsByDisplayOrder } from '@/shared/utils/kingdom'
import { NButton, NIcon } from 'naive-ui'
import { computed, watch } from 'vue'

const SHEN_KINGDOM = 'shen'
const SLOT_PLACEHOLDERS = ['势力1', '势力2'] as const

/* 参数定义 */
const props = withDefaults(
  defineProps<{
    options: string[]
    disabled?: boolean
    max?: number
    /** 传入时新选势力按该表自动排序；用户可手动对调，重新选择后恢复默认排序 */
    displayOrder?: readonly string[]
  }>(),
  {
    disabled: false,
    max: 2,
  },
)

const model = defineModel<string[]>({ default: () => [] })

/* 状态定义 */
const orderedList = computed(() => model.value ?? [])
const isFull = computed(() => orderedList.value.length >= props.max)

/* 核心逻辑 */
const applyDisplayOrder = (list: string[]) => {
  if (!props.displayOrder?.length) return list
  return sortKingdomsByDisplayOrder(list, props.displayOrder)
}

const commitList = (next: string[], options?: { applyDisplayOrder?: boolean }) => {
  const filtered = next.filter((k) => k !== SHEN_KINGDOM).slice(0, props.max)
  const shouldSort = options?.applyDisplayOrder ?? Boolean(props.displayOrder?.length)
  model.value = shouldSort ? applyDisplayOrder(filtered) : filtered
}

const updateList = (next: string[]) => {
  commitList(next)
}

const canSwapOrder = computed(
  () => !props.disabled && orderedList.value.length === props.max && props.max >= 2,
)

const slotKingdom = (index: number) => orderedList.value[index]

const isSelected = (kingdom: string) => orderedList.value.includes(kingdom)

const isOptionDisabled = (kingdom: string) => {
  if (props.disabled || kingdom === SHEN_KINGDOM) return true
  if (isSelected(kingdom)) return false
  return isFull.value
}

const onOptionClick = (kingdom: string) => {
  if (props.disabled || kingdom === SHEN_KINGDOM) return
  const idx = orderedList.value.indexOf(kingdom)
  if (idx >= 0) {
    const next = [...orderedList.value]
    next.splice(idx, 1)
    updateList(next)
    return
  }
  if (isFull.value) return
  updateList([...orderedList.value, kingdom])
}

const clearSlot = (index: number) => {
  if (props.disabled || !slotKingdom(index)) return
  const next = [...orderedList.value]
  next.splice(index, 1)
  updateList(next)
}

const swapOrder = () => {
  if (!canSwapOrder.value) return
  const [first, second] = orderedList.value
  if (!first || !second) return
  commitList([second, first], { applyDisplayOrder: false })
}

watch(
  orderedList,
  (list) => {
    if (!list.includes(SHEN_KINGDOM)) return
    updateList(list.filter((k) => k !== SHEN_KINGDOM))
  },
  { deep: true },
)
</script>

<template>
  <div class="ordered-kingdom-picker" :class="{ 'ordered-kingdom-picker--disabled': disabled }">
    <div class="ordered-kingdom-picker__slots">
      <button
        v-for="index in max"
        :key="index"
        type="button"
        class="ordered-kingdom-picker__slot"
        :class="{
          'ordered-kingdom-picker__slot--empty': !slotKingdom(index - 1),
          'ordered-kingdom-picker__slot--filled': Boolean(slotKingdom(index - 1)),
          [`ordered-kingdom-picker__slot--${slotKingdom(index - 1)}`]: Boolean(
            slotKingdom(index - 1),
          ),
        }"
        :disabled="disabled || !slotKingdom(index - 1)"
        :aria-label="
          slotKingdom(index - 1) ? `移除${getKingdomLabel(slotKingdom(index - 1)!)}` : undefined
        "
        @click="clearSlot(index - 1)"
      >
        <span class="ordered-kingdom-picker__slot-index">{{ index }}</span>
        <span v-if="slotKingdom(index - 1)" class="ordered-kingdom-picker__slot-label">
          {{ getKingdomLabel(slotKingdom(index - 1)!) }}
        </span>
        <span v-else class="ordered-kingdom-picker__slot-placeholder">
          {{ SLOT_PLACEHOLDERS[index - 1] ?? '待选' }}
        </span>
        <span
          v-if="slotKingdom(index - 1)"
          class="ordered-kingdom-picker__slot-remove-icon"
          aria-hidden="true"
        >
          <n-icon :size="12"><CloseRound /></n-icon>
        </span>
      </button>

      <n-button
        v-if="canSwapOrder"
        class="ordered-kingdom-picker__swap"
        text
        type="primary"
        size="small"
        :disabled="disabled"
        @click="swapOrder"
      >
        <template #icon>
          <n-icon :size="17"><SwapHorizRound /></n-icon>
        </template>
        交换
      </n-button>
    </div>

    <div class="ordered-kingdom-picker__options kingdom-option-buttons">
      <n-button
        v-for="kingdom in options"
        :key="kingdom"
        size="small"
        :disabled="isOptionDisabled(kingdom)"
        :class="[
          'kingdom-option',
          `kingdom-option--${kingdom}`,
          { 'kingdom-option--selected': isSelected(kingdom) },
        ]"
        @click="onOptionClick(kingdom)"
      >
        {{ getKingdomLabel(kingdom) }}
      </n-button>
    </div>
  </div>
</template>

<style scoped>
.ordered-kingdom-picker {
  display: flex;
  flex-direction: column;
  gap: 10px;
  width: 100%;
}

.ordered-kingdom-picker--disabled {
  opacity: 0.65;
  pointer-events: none;
}

.ordered-kingdom-picker__hint {
  margin: 0;
  font-size: 13px;
  color: var(--text-color-2);
}

.ordered-kingdom-picker__preview {
  margin-left: 6px;
  font-weight: 600;
  color: var(--text-color-1);
  letter-spacing: 0.08em;
}

.ordered-kingdom-picker__slots {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.ordered-kingdom-picker__swap {
  flex-shrink: 0;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 6px;
}

.ordered-kingdom-picker__swap:hover {
  background: color-mix(in srgb, var(--primary-color) 8%, transparent);
}

.ordered-kingdom-picker__slot {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-width: 90px;
  height: 35px;
  padding: 6px 8px 6px 10px;
  border-radius: 8px;
  border: 1px dashed var(--border-color);
  background: color-mix(in srgb, var(--card-color) 92%, var(--body-color));
  font: inherit;
  color: inherit;
}

.ordered-kingdom-picker__slot--empty {
  color: var(--text-color-3);
  padding-right: 12px;
  cursor: default;
}

.ordered-kingdom-picker__slot--filled {
  cursor: pointer;
  transition: filter 0.15s ease;
}

.ordered-kingdom-picker__slot--filled:hover:not(:disabled) {
  filter: brightness(0.92);
}

.ordered-kingdom-picker__slot-remove-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  margin-left: auto;
  opacity: 0.85;
  transition: opacity 0.15s ease;
}

.ordered-kingdom-picker__slot--filled:hover:not(:disabled)
  .ordered-kingdom-picker__slot-remove-icon {
  opacity: 0.72;
}

.ordered-kingdom-picker__slot-index {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  font-size: 11px;
  font-weight: 700;
  background: rgba(255, 255, 255, 0.25);
}

.ordered-kingdom-picker__slot--empty .ordered-kingdom-picker__slot-index {
  background: var(--primary-color-suppl);
  color: var(--primary-color);
}

.ordered-kingdom-picker__slot-placeholder {
  font-size: 13px;
}

.ordered-kingdom-picker__slot-label {
  font-size: 14px;
  font-weight: 700;
}

.ordered-kingdom-picker__slot--wei {
  border-style: solid;
  border-color: #4a87eb;
  background-color: #4a87eb;
  color: #fff;
}
.ordered-kingdom-picker__slot--shu {
  border-style: solid;
  border-color: #c25a3c;
  background-color: #c25a3c;
  color: #fff;
}
.ordered-kingdom-picker__slot--wu {
  border-style: solid;
  border-color: #82d048;
  background-color: #82d048;
  color: #fff;
}
.ordered-kingdom-picker__slot--qun {
  border-style: solid;
  border-color: #666;
  background-color: #666;
  color: #fff;
}
.ordered-kingdom-picker__slot--jin {
  border-style: solid;
  border-color: #c300ff;
  background-color: #c300ff;
  color: #fff;
}
</style>
