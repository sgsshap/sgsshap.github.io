declare module 'vuedraggable' {
  import type { DefineComponent } from 'vue'

  const draggable: DefineComponent<{
    modelValue?: unknown[]
    list?: unknown[]
    itemKey: string | ((item: unknown) => string | number)
    tag?: string
    handle?: string
    animation?: number
    ghostClass?: string
    chosenClass?: string
    dragClass?: string
    forceFallback?: boolean
    fallbackClass?: string
    disabled?: boolean
    group?: string | Record<string, unknown>
  }>
  export default draggable
}
