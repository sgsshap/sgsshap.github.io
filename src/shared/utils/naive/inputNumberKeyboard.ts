import { observeAddedNodes } from '@/shared/utils/dom/observeAddedNodes'
import { isTouchDevice } from '@/shared/utils/naive/touchDevice'

const GUARD_ATTR = 'data-sgs-input-number-guard'

const applyReadonlyGuard = (input: HTMLInputElement) => {
  input.readOnly = true
  input.setAttribute('readonly', 'readonly')
  input.setAttribute(GUARD_ATTR, '1')
}

const scanInputNumbers = (root: ParentNode) => {
  if (!(root instanceof Document || root instanceof Element)) return
  root.querySelectorAll?.('.n-input-number input').forEach((el) => {
    if (el instanceof HTMLInputElement && !el.hasAttribute(GUARD_ATTR)) {
      applyReadonlyGuard(el)
    }
  })
}

const findInputNumberRoot = (el: HTMLElement) => el.closest('.n-input-number')

const findInput = (root: Element | null) => {
  const input = root?.querySelector('input')
  return input instanceof HTMLInputElement ? input : null
}

const isStepperControl = (el: HTMLElement) => el.closest('.n-input-number .n-button') !== null

const isInputFieldTarget = (el: HTMLElement, input: HTMLInputElement) =>
  el === input ||
  el.closest('.n-input__input-el') !== null ||
  el.closest('.n-input__input') !== null

export type NaiveInputNumberKeyboardGuard = {
  disconnect: () => void
}

/**
 * 移动端 n-input-number：Naive 在点 +/- 时仍会 activate() 聚焦 input。
 * 组合：默认 readonly + 步进按下标记 + focusin 时立即 blur。
 */
export function setupNaiveInputNumberKeyboardGuard(): NaiveInputNumberKeyboardGuard | null {
  if (!isTouchDevice()) return null

  scanInputNumbers(document.body)

  let stepperRoot: Element | null = null
  let clearStepperTimer: ReturnType<typeof globalThis.setTimeout> | null = null

  const markStepperPress = (target: HTMLElement) => {
    stepperRoot = findInputNumberRoot(target)
    const input = findInput(stepperRoot)
    if (input) {
      applyReadonlyGuard(input)
    }
    if (clearStepperTimer) globalThis.clearTimeout(clearStepperTimer)
    clearStepperTimer = globalThis.setTimeout(() => {
      stepperRoot = null
      clearStepperTimer = null
    }, 400)
  }

  const blurIfStepperFocus = (input: HTMLInputElement) => {
    const root = findInputNumberRoot(input)
    if (!root || root !== stepperRoot) return false

    const releaseFocus = () => {
      if (document.activeElement === input) {
        input.blur()
      }
    }

    releaseFocus()
    requestAnimationFrame(releaseFocus)
    globalThis.setTimeout(releaseFocus, 0)

    stepperRoot = null
    if (clearStepperTimer) {
      globalThis.clearTimeout(clearStepperTimer)
      clearStepperTimer = null
    }
    return true
  }

  const onStepperPointerDown = (event: Event) => {
    const target = event.target
    if (!(target instanceof HTMLElement)) return
    if (!isStepperControl(target)) return
    markStepperPress(target)
  }

  const onTouchStart = (event: TouchEvent) => {
    const target = event.target
    if (!(target instanceof HTMLElement)) return

    const root = findInputNumberRoot(target)
    if (!root) return

    const input = findInput(root)
    if (!input) return

    if (isStepperControl(target)) {
      markStepperPress(target)
      return
    }

    if (isInputFieldTarget(target, input)) {
      input.readOnly = false
      input.removeAttribute('readonly')
      input.inputMode = 'decimal'
    }
  }

  const onFocusIn = (event: FocusEvent) => {
    const target = event.target
    if (!(target instanceof HTMLInputElement)) return
    if (!target.closest('.n-input-number')) return

    if (blurIfStepperFocus(target)) return

    if (target.readOnly && stepperRoot) {
      target.blur()
    }
  }

  const onBlur = (event: FocusEvent) => {
    const target = event.target
    if (!(target instanceof HTMLInputElement)) return
    if (!target.closest('.n-input-number')) return
    applyReadonlyGuard(target)
  }

  const domObserver = observeAddedNodes((node) => {
    scanInputNumbers(node)
  })

  document.addEventListener('pointerdown', onStepperPointerDown, { capture: true })
  document.addEventListener('mousedown', onStepperPointerDown, { capture: true })
  document.addEventListener('touchstart', onTouchStart, { capture: true, passive: true })
  document.addEventListener('focusin', onFocusIn, true)
  document.addEventListener('blur', onBlur, true)

  return {
    disconnect: () => {
      domObserver.disconnect()
      document.removeEventListener('pointerdown', onStepperPointerDown, { capture: true })
      document.removeEventListener('mousedown', onStepperPointerDown, { capture: true })
      document.removeEventListener('touchstart', onTouchStart, { capture: true })
      document.removeEventListener('focusin', onFocusIn, true)
      document.removeEventListener('blur', onBlur, true)
      if (clearStepperTimer) globalThis.clearTimeout(clearStepperTimer)
      stepperRoot = null
    },
  }
}
