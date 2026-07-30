export type SyntheticMouseEventType = 'mousedown' | 'mousemove' | 'mouseup'

/** 向目标派发合成 MouseEvent（补齐仅监听 mouse 的第三方组件） */
export const dispatchSyntheticMouseEvent = (
  type: SyntheticMouseEventType,
  target: EventTarget,
  clientX: number,
  clientY: number,
) => {
  target.dispatchEvent(
    new MouseEvent(type, {
      bubbles: true,
      cancelable: true,
      view: window,
      clientX,
      clientY,
      button: 0,
      buttons: type === 'mouseup' ? 0 : 1,
    }),
  )
}
