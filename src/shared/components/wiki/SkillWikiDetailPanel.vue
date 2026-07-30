<script setup lang="ts">
import { getSkillWiki } from '@/shared/api/wiki'
import type { WikiSearchTag, WikiSkillSelectPayload } from '@/shared/types/wiki'
import { getDict, isSuccess } from '@/shared/api'
import type { DictItem } from '@/shared/types/api'
import { getLabel } from '@/shared/utils/dict'
import { formatWikiSkillDescHtml } from '@/shared/utils/wikiSkillDesc'
import { parseSkillWikiLegendLinks } from '@/shared/utils/wikiLegendLink'
import WikiLegendLinkList from '@/shared/components/wiki/WikiLegendLinkList.vue'
import { CheckCircleRound } from '@/shared/icons'
import { useMessage } from 'naive-ui'
import { computed, ref, watch } from 'vue'

defineOptions({ name: 'SkillWikiDetailPanel' })

interface Props {
  skillId: number
  skillIndex?: number
  readonly?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  skillIndex: 0,
  readonly: false,
})

const emit = defineEmits<{
  apply: [payload: WikiSkillSelectPayload]
}>()

const message = useMessage()
const loading = ref(false)
const wikiData = ref<Record<string, unknown>>({})

const serverOptions = ref<DictItem[]>([])
const gameModeOptions = ref<DictItem[]>([])
const packageOptions = ref<DictItem[]>([])

const descriptionHtml = computed(() =>
  formatWikiSkillDescHtml(String(wikiData.value.description ?? '')),
)

const showTags = computed<WikiSearchTag[]>(() => {
  const tags: WikiSearchTag[] = []
  const data = wikiData.value

  if (data.gameMode) {
    tags.push({ value: getLabel(String(data.gameMode), gameModeOptions.value) })
  }
  if (data.server) {
    tags.push({ value: getLabel(String(data.server), serverOptions.value), type: 'success' })
  }
  if (data.skillPackage) {
    tags.push({ value: getLabel(String(data.skillPackage), packageOptions.value), type: 'warning' })
  }

  const customTags = data.tags
  if (Array.isArray(customTags)) {
    for (const tag of customTags) {
      const row = tag as Record<string, unknown>
      if (row.name) {
        tags.push({ value: String(row.name), type: 'info' })
      }
    }
  }

  return tags
})

const legendLinks = computed(() => parseSkillWikiLegendLinks(wikiData.value.legendVersions))

const loadSkill = async () => {
  loading.value = true
  try {
    const res = await getSkillWiki(props.skillId)
    if (!isSuccess(res)) {
      throw new Error(res.message || '技能加载失败')
    }
    wikiData.value = res.data
  } catch (error) {
    message.error(error instanceof Error ? error.message : '技能加载失败')
  } finally {
    loading.value = false
  }
}

const handleApply = () => {
  const name = String(wikiData.value.name ?? '').trim()
  const desc = String(wikiData.value.description ?? '')
  if (!name) {
    message.warning('技能名称无效')
    return
  }
  emit('apply', {
    type: 'skill',
    skillIndex: props.skillIndex,
    data: { name, desc },
  })
}

watch(
  () => props.skillId,
  (id) => {
    if (id > 0) {
      void loadSkill()
    }
  },
  { immediate: true },
)

void (async () => {
  const [serverRes, gameModeRes, packageRes] = await Promise.all([
    getDict('server'),
    getDict('game_mode'),
    getDict('skill_package'),
  ])
  if (isSuccess(serverRes)) serverOptions.value = serverRes.data.itemList ?? []
  if (isSuccess(gameModeRes)) gameModeOptions.value = gameModeRes.data.itemList ?? []
  if (isSuccess(packageRes)) packageOptions.value = packageRes.data.itemList ?? []
})()
</script>

<template>
  <n-el tag="div" class="skill-detail-panel">
    <n-spin :show="loading" class="skill-detail-panel__body-spin">
      <header class="skill-detail-panel__header">
        <h1 class="diy-drawer-page-title">{{ wikiData.name || '技能详情' }}</h1>
        <div v-if="showTags.length" class="skill-detail-panel__tags">
          <n-tag
            v-for="tag in showTags"
            :key="tag.value"
            size="small"
            :type="tag.type"
            :bordered="false"
          >
            {{ tag.value }}
          </n-tag>
        </div>
      </header>

      <section class="skill-detail-panel__desc wiki-detail-inset">
        <h2 class="diy-drawer-section-title">技能描述</h2>
        <div
          v-if="descriptionHtml"
          class="skill-detail-panel__desc-text wiki-skill-desc"
          v-html="descriptionHtml"
        />
        <p v-else class="skill-detail-panel__desc-text skill-detail-panel__desc-text--empty">
          暂无描述
        </p>
      </section>

      <section v-if="legendLinks.length" class="skill-detail-panel__legends">
        <header class="wiki-detail-section-head skill-detail-panel__legends-head">
          <h2 class="diy-drawer-section-title diy-drawer-section-title--muted">所属武将</h2>
        </header>
        <WikiLegendLinkList :links="legendLinks" layout="list" class="skill-detail-panel__legend-links" />
      </section>
    </n-spin>

    <footer v-if="!readonly" class="diy-detail-panel__footer-bar">
      <n-button type="primary" size="large" block @click="handleApply">
        <template #icon>
          <n-icon><CheckCircleRound /></n-icon>
        </template>
        一键使用此技能
      </n-button>
    </footer>
  </n-el>
</template>

<style scoped>
.skill-detail-panel {
  display: flex;
  flex-direction: column;
  gap: 0;
  min-width: 0;
  padding: 4px 0 0;
  box-sizing: border-box;
}

.skill-detail-panel__body-spin {
  display: block;
  width: 100%;
}

.skill-detail-panel__body-spin :deep(.n-spin-content) {
  display: flex;
  flex-direction: column;
  gap: var(--diy-drawer-content-gap);
  width: 100%;
}

.skill-detail-panel__header {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding-bottom: 4px;
  margin-bottom: var(--page-gap, 16px);
  border-bottom: 1px solid var(--divider-color);
}

.skill-detail-panel__tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.skill-detail-panel__desc {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.skill-detail-panel__desc-text {
  margin: 0;
  font-size: 14px;
  line-height: 1.75;
  color: var(--text-color-1);
  word-break: break-word;
}

.skill-detail-panel__desc-text--empty {
  color: var(--text-color-3);
}

.skill-detail-panel__legends {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.skill-detail-panel__legends-head {
  margin-bottom: 0;
  padding-bottom: 0;
  border-bottom: none;
}

.skill-detail-panel__legend-links {
  padding: var(--page-inset, 18px);
  border-radius: calc(var(--page-r, 12px) - 2px);
  background: color-mix(in srgb, var(--body-color) 48%, var(--card-color));
  border: 1px solid color-mix(in srgb, var(--primary-color) 12%, var(--border-color));
  font-size: 13px;
  line-height: 1.55;
}

</style>
