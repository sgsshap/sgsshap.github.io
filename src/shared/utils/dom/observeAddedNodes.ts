export type DomNodeObserver = {
  disconnect: () => void
}

/**
 * 监听 DOM 子树新增节点（如图表、弹层 Teleport），用于移动端补丁扫描。
 */
export function observeAddedNodes(
  handler: (node: HTMLElement) => void,
  root: ParentNode = document.body,
): DomNodeObserver {
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (node instanceof HTMLElement) {
          handler(node)
        }
      }
    }
  })

  observer.observe(root, { childList: true, subtree: true })

  return {
    disconnect: () => observer.disconnect(),
  }
}
