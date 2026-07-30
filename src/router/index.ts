import { setupRouterLoading } from '@/router/loading'
import {
  clearAllDiyOverlayQuery,
  isAnyDiyOverlayOpen,
} from '@/features/diy-card/constants/diyDrawerRoute'
import { createRouter, createWebHashHistory } from 'vue-router'

const router = createRouter({
  history: createWebHashHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      component: () => import('@/shared/components/layout/AppShell.vue'),
      redirect: '/home',
      meta: { loadingHint: '正在加载…' },
      children: [
        {
          path: 'home',
          name: 'home',
          meta: { loadingHint: '正在进入首页…', loadingScope: 'content' },
          component: () => import('@/features/home/views/HomeView.vue'),
        },
        {
          path: 'diy',
          name: 'diy',
          meta: {
            keepAlive: true,
            loadingHint: '正在进入制图…',
            loadingScope: 'content',
            skipNavigationLoading: true,
          },
          component: () => import('@/features/diy-card/views/DiyCardView.vue'),
        },
        {
          path: 'wiki',
          name: 'wiki',
          meta: { loadingHint: '正在进入百科…', loadingScope: 'content' },
          component: () => import('@/features/wiki/views/WikiView.vue'),
        },
        {
          path: 'settings',
          name: 'settings',
          meta: { loadingHint: '正在进入系统设置…', loadingScope: 'content' },
          component: () => import('@/features/settings/views/SettingsView.vue'),
        },
        {
          path: 'donation',
          name: 'donation',
          meta: { loadingHint: '正在进入支持项目…', loadingScope: 'content' },
          component: () => import('@/features/donation/views/DonationView.vue'),
        },
      ],
    },
  ],
})

/** 刷新/外链进入时去掉抽屉 query；已在 diy 页内的 query 变更（打开抽屉）须放行 */
router.beforeEach((to, from) => {
  if (to.name !== 'diy' || !isAnyDiyOverlayOpen(to.query)) {
    return true
  }
  if (from.name === 'diy') {
    return true
  }
  return {
    name: 'diy',
    query: clearAllDiyOverlayQuery(to.query),
    hash: to.hash,
  }
})

setupRouterLoading(router)

export default router
