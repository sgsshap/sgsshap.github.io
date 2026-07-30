import { nextTick, type Ref } from 'vue'

/** 详细设置等场景：Naive UI 点确认后会自动关面板，调用后保持打开 */
export function keepNaiveColorPickerOpen(picker: Ref<{ showFlag: boolean }>) {
  nextTick(() => {
    picker.value.showFlag = true
  })
}
