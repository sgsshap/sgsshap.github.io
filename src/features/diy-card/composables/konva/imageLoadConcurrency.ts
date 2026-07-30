/** 限制同时进行的图片请求数，避免慢网下浏览器连接池打满导致部分素材超时失败 */
const IMAGE_LOAD_MAX_CONCURRENT = 6

export type ImageLoadPriority = 'high' | 'normal'

let imageLoadInFlight = 0
const highPriorityWaiters: Array<() => void> = []
const normalPriorityWaiters: Array<() => void> = []

const pumpImageLoadQueue = () => {
  while (imageLoadInFlight < IMAGE_LOAD_MAX_CONCURRENT) {
    const resume = highPriorityWaiters.shift() ?? normalPriorityWaiters.shift()
    if (!resume) return
    imageLoadInFlight += 1
    resume()
  }
}

export const acquireImageLoadSlot = (priority: ImageLoadPriority = 'normal') =>
  new Promise<void>((resolve) => {
    if (imageLoadInFlight < IMAGE_LOAD_MAX_CONCURRENT) {
      imageLoadInFlight += 1
      resolve()
      return
    }
    if (priority === 'high') {
      highPriorityWaiters.push(resolve)
      return
    }
    normalPriorityWaiters.push(resolve)
  })

export const releaseImageLoadSlot = () => {
  imageLoadInFlight = Math.max(0, imageLoadInFlight - 1)
  pumpImageLoadQueue()
}

export const runWithImageLoadSlot = async <T>(
  task: () => Promise<T>,
  priority: ImageLoadPriority = 'normal',
): Promise<T> => {
  await acquireImageLoadSlot(priority)
  try {
    return await task()
  } finally {
    releaseImageLoadSlot()
  }
}
