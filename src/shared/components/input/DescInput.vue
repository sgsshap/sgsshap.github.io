<script setup lang="ts">
import { COLOR_PICKER_HEX_MODES } from '@/shared/constants/colorPicker'
import { nextTick, ref } from 'vue'

/* 参数定义 */
const model = defineModel<string>({ required: true })
const { maxlength = 999, rows = 6, placeholder = '技能描述...' } = defineProps<{
  maxlength?: number
  rows?: number
  placeholder?: string
}>()

const emit = defineEmits<{
  focus: []
  blur: []
}>()

/* 状态定义 */
const descInput = ref()
const colorSelector = ref({
  showFlag: false,
  value: '#4C9717',
})

const styleTools = [
  {
    label: 'B',
    tooltip: '加粗（ctrl+b）',
    leftCode: '<b>',
    rightCode: '</b>',
    class: 'desc-input__tool--bold',
  },
  {
    label: 'I',
    tooltip: '斜体（ctrl+i）',
    leftCode: '<i>',
    rightCode: '</i>',
    class: 'desc-input__tool--italic',
  },
  {
    label: 'BI',
    tooltip: '加粗斜体（ctrl+shift+b）',
    leftCode: '<bi>',
    rightCode: '</bi>',
    class: 'desc-input__tool--bold desc-input__tool--italic',
  },
  {
    label: 'S',
    tooltip: '删除线（ctrl+shift+s）',
    leftCode: '<s>',
    rightCode: '</s>',
    class: 'desc-input__tool--strikethrough',
  },
  {
    label: 'U',
    tooltip: '下划线（ctrl+u）',
    leftCode: '<u>',
    rightCode: '</u>',
    class: 'desc-input__tool--underline',
  },
]

const spacingTools = [
  {
    label: '5',
    tooltip: '全角数字（ctrl+f）',
    leftCode: '<full>',
    rightCode: '</full>',
    class: 'desc-input__tool--full-width',
  },
  {
    label: 'Space',
    tooltip: '空格（ctrl+shift+space）',
    leftCode: '&nbsp;',
    rightCode: '',
    class: 'desc-input__tool--space',
  },
  {
    label: '↵',
    tooltip: '换行',
    leftCode: '<br>',
    rightCode: '',
    class: 'desc-input__tool--newline',
  },
]

const symbolTools = [
  { label: '♥', tooltip: '红桃', code: '♥' },
  { label: '♠', tooltip: '黑桃', code: '♠' },
  { label: '♣', tooltip: '草花', code: '♣' },
  { label: '♦', tooltip: '方片', code: '♦' },
]

/* 工具函数 */
/**
 * 向技能描述中追加代码
 * @param leftCode 左侧代码
 * @param endCode 右侧闭合标签；无闭合标签时插入后光标落在内容之后
 */
const appendDesc = (leftCode: string, endCode: string = '') => {
  const oldDesc = model.value
  const input = descInput.value?.$el.querySelector('textarea') as HTMLTextAreaElement
  if (!input) {
    return
  }
  const selectionStart = input.selectionStart
  const selectionEnd = input.selectionEnd
  const hasSelection = selectionStart !== selectionEnd
  let cursorStart: number
  let cursorEnd: number

  if (hasSelection) {
    const selectionStr = oldDesc.slice(selectionStart, selectionEnd)
    if (endCode) {
      model.value =
        oldDesc.slice(0, selectionStart) +
        leftCode +
        selectionStr +
        endCode +
        oldDesc.slice(selectionEnd)
      cursorStart = selectionStart
      cursorEnd = selectionEnd + leftCode.length + endCode.length
    } else {
      model.value =
        oldDesc.slice(0, selectionStart) + selectionStr + leftCode + oldDesc.slice(selectionEnd)
      const cursor = selectionEnd + leftCode.length
      cursorStart = cursor
      cursorEnd = cursor
    }
  } else if (endCode) {
    model.value =
      oldDesc.slice(0, selectionStart) + leftCode + endCode + oldDesc.slice(selectionStart)
    const cursor = selectionStart + leftCode.length
    cursorStart = cursor
    cursorEnd = cursor
  } else {
    model.value = oldDesc.slice(0, selectionStart) + leftCode + oldDesc.slice(selectionStart)
    const cursor = selectionStart + leftCode.length
    cursorStart = cursor
    cursorEnd = cursor
  }

  input.focus()
  nextTick(() => {
    input.setSelectionRange(cursorStart, cursorEnd)
  })
}

/**
 * 插入单个符号
 * @param code 符号代码
 */
const insertSymbol = (code: string) => {
  appendDesc(code)
}

/* 核心逻辑 */
/**
 * 切换颜色选择器显示状态
 */
const handleColorSelectorClick = () => {
  colorSelector.value.showFlag = !colorSelector.value.showFlag
}

/**
 * 颜色选择确认回调
 * @param value 颜色值
 */
const handleColorSelectorConfirm = (value: string) => {
  appendDesc(`<span style="color: ${value}">`, '</span>')
}

/**
 * 键盘快捷键处理
 * @param e 键盘事件
 */
const handleKeydown = (e: KeyboardEvent) => {
  if (e.ctrlKey && e.key === 'b') {
    e.preventDefault()
    appendDesc('<b>', '</b>')
  } else if (e.ctrlKey && e.key === 'i') {
    e.preventDefault()
    appendDesc('<i>', '</i>')
  } else if (e.ctrlKey && e.shiftKey && e.key === 'B') {
    e.preventDefault()
    appendDesc('<bi>', '</bi>')
  } else if (e.ctrlKey && e.key === 'u') {
    e.preventDefault()
    appendDesc('<u>', '</u>')
  } else if (e.ctrlKey && e.key === 'f') {
    e.preventDefault()
    appendDesc('<full>', '</full>')
  } else if (e.ctrlKey && e.shiftKey && e.key === ' ') {
    e.preventDefault()
    appendDesc('&nbsp;')
  } else if (e.ctrlKey && e.shiftKey && e.key === 's') {
    e.preventDefault()
    appendDesc('<s>', '</s>')
  }
}
</script>

<template>
  <div class="desc-input">
    <div class="desc-input__tools">
      <div class="desc-input__tools-bar">
        <span class="desc-input__tools-label">输入工具</span>
        <div class="desc-input__tools-row">
        <div class="desc-input__tools-chunk">
          <div class="desc-input__tool-group" role="group" aria-label="样式">
            <n-tooltip v-for="tool in styleTools" :key="tool.label">
              <template #trigger>
                <n-button quaternary class="desc-input__tool-btn" @click="appendDesc(tool.leftCode, tool.rightCode)">
                  <span :class="tool.class">{{ tool.label }}</span>
                </n-button>
              </template>
              {{ tool.tooltip }}
            </n-tooltip>
          </div>
        </div>

        <div class="desc-input__tools-chunk">
          <div class="desc-input__tool-group" role="group" aria-label="间距">
            <n-tooltip v-for="tool in spacingTools" :key="tool.label">
              <template #trigger>
                <n-button quaternary class="desc-input__tool-btn" @click="appendDesc(tool.leftCode, tool.rightCode)">
                  <span :class="tool.class">{{ tool.label }}</span>
                </n-button>
              </template>
              {{ tool.tooltip }}
            </n-tooltip>
          </div>
        </div>

        <div class="desc-input__tools-chunk">
          <div
            class="desc-input__tool-group desc-input__tool-group--color"
            role="group"
            aria-label="颜色"
          >
            <n-tooltip>
              <template #trigger>
                <n-button
                  quaternary
                  class="desc-input__tool-btn desc-input__tool-btn--color"
                  @click="handleColorSelectorClick()"
                >
                  <span
                    class="desc-input__color-swatch"
                    :style="{ backgroundColor: colorSelector.value || '#4c9717' }"
                  />
                </n-button>
              </template>
              文字颜色
            </n-tooltip>
            <n-color-picker
              v-model:show="colorSelector.showFlag"
              v-model:value="colorSelector.value"
              class="desc-input__color-picker"
              :modes="COLOR_PICKER_HEX_MODES"
              :show-alpha="false"
              :actions="['confirm']"
              @confirm="handleColorSelectorConfirm"
            />
          </div>
        </div>

        <div class="desc-input__tools-chunk">
          <div class="desc-input__tool-group" role="group" aria-label="花色">
            <n-tooltip v-for="symbol in symbolTools" :key="symbol.label">
              <template #trigger>
                <n-button quaternary class="desc-input__tool-btn" @click="insertSymbol(symbol.code)">
                  <span class="desc-input__symbol">{{ symbol.label }}</span>
                </n-button>
              </template>
              {{ symbol.tooltip }}
            </n-tooltip>
          </div>
        </div>
        </div>
      </div>
    </div>

    <n-input
      ref="descInput"
      v-model:value="model"
      type="textarea"
      :maxlength="maxlength"
      show-count
      :rows="rows"
      :placeholder="placeholder"
      @keydown="handleKeydown"
      @focus="emit('focus')"
      @blur="emit('blur')"
    />
  </div>
</template>

<style scoped>
.desc-input {
  flex: 1;
  min-width: 220px;
  display: flex;
  flex-direction: column;
  gap: 5px;
  scroll-margin-top: 12px;
  scroll-margin-bottom: 24px;
}

.desc-input__tools {
  padding: 5px 8px;
  border-radius: 8px;
  background: color-mix(in srgb, var(--body-color) 40%, transparent);
}

.desc-input__tools-bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 6px;
}

.desc-input__tools-label {
  flex-shrink: 0;
  font-size: 12px;
  color: var(--text-color-3, #888);
  line-height: 32px;
}

/** 宽度够时一行排满；不够时按「类」整块换行，同类按钮始终同一行 */
.desc-input__tools-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0;
}

.desc-input__tools-chunk {
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
}

.desc-input__tools-chunk:not(:last-child)::after {
  content: '';
  flex-shrink: 0;
  align-self: center;
  width: 1px;
  height: 18px;
  margin: 0 5px;
  background: var(--divider-color, #e0e0e0);
}

.desc-input__tool-group {
  display: inline-flex;
  flex-wrap: nowrap;
  align-items: center;
  gap: 0;
}

.desc-input__tool-group--color {
  position: relative;
}

.desc-input__tool-group--color :deep(.desc-input__tool-btn--color) {
  min-width: 32px;
  padding: 0;
}

.desc-input__color-swatch {
  display: block;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  border: 1px solid color-mix(in srgb, var(--border-color, #ccc) 80%, transparent);
  box-shadow:
    inset 0 0 0 1px rgba(255, 255, 255, 0.35),
    0 1px 2px rgba(0, 0, 0, 0.12);
}

.desc-input__color-picker {
  position: absolute;
  left: 0;
  top: 0;
  opacity: 0;
  pointer-events: none;
}

.desc-input__tool-group :deep(.n-button.desc-input__tool-btn) {
  min-width: 30px;
  min-height: 32px;
  height: 32px;
  padding: 0 7px;
  font-size: 14px;
}

.desc-input__tool--bold {
  font-weight: bold;
}

.desc-input__tool--italic {
  font-style: italic;
}

.desc-input__tool--strikethrough {
  text-decoration: line-through;
}

.desc-input__tool--underline {
  text-decoration: underline;
}

.desc-input__tool--full-width {
  font-family: var(--site-font-family);
  font-size: 15px;
}

.desc-input__tool--space {
  font-size: 12px;
}

.desc-input__tool--newline {
  font-size: 16px;
  line-height: 1;
}

.desc-input__symbol {
  font-size: 18px;
  line-height: 1;
}
</style>
