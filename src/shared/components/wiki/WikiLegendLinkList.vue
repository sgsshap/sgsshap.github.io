<script setup lang="ts">
import { useWikiLegendNavigation } from '@/shared/composables/useWikiLegendNavigation'
import { ArrowForwardRound } from '@/shared/icons'
import type { WikiLegendNavigationTarget } from '@/shared/utils/wikiLegendLink'

defineOptions({ name: 'WikiLegendLinkList' })

interface Props {
  links: WikiLegendNavigationTarget[]
  emptyText?: string
  layout?: 'inline' | 'list'
}

withDefaults(defineProps<Props>(), {
  emptyText: '无',
  layout: 'inline',
})

const { navigateToLegend } = useWikiLegendNavigation()
</script>

<template>
  <span v-if="!links.length" class="wiki-legend-link-list__empty">{{ emptyText }}</span>
  <span v-else :class="['wiki-legend-link-list', `wiki-legend-link-list--${layout}`]">
    <button
      v-for="link in links"
      :key="link.key"
      type="button"
      class="wiki-legend-link"
      @click="navigateToLegend(link)"
    >
      <span class="wiki-legend-link__label">{{ link.label }}</span>
      <n-icon class="wiki-legend-link__icon" :size="14"><ArrowForwardRound /></n-icon>
    </button>
  </span>
</template>

<style scoped>
.wiki-legend-link-list--inline {
  display: inline-flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
}

.wiki-legend-link-list--list {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 8px;
}

.wiki-legend-link-list__empty {
  color: var(--text-color-1);
}

.wiki-legend-link {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  max-width: 100%;
  margin: 0;
  padding: 4px 10px;
  border: 1px solid color-mix(in srgb, var(--primary-color) 22%, var(--border-color));
  border-radius: 999px;
  background: color-mix(in srgb, var(--primary-color) 8%, var(--card-color));
  font: inherit;
  font-size: 13px;
  line-height: 1.4;
  color: var(--primary-color);
  cursor: pointer;
  text-align: left;
  transition:
    background-color 0.18s ease,
    border-color 0.18s ease,
    box-shadow 0.18s ease,
    transform 0.18s ease;
}

.wiki-legend-link__label {
  min-width: 0;
  word-break: break-word;
}

.wiki-legend-link__icon {
  flex-shrink: 0;
  opacity: 0.72;
  transition:
    opacity 0.18s ease,
    transform 0.18s ease;
}

.wiki-legend-link:hover {
  border-color: color-mix(in srgb, var(--primary-color) 42%, var(--border-color));
  background: color-mix(in srgb, var(--primary-color) 14%, var(--card-color));
  box-shadow: 0 1px 0 color-mix(in srgb, var(--primary-color) 10%, transparent);
}

.wiki-legend-link:hover .wiki-legend-link__icon {
  opacity: 1;
  transform: translateX(1px);
}

.wiki-legend-link:active {
  transform: translateY(1px);
}

.wiki-legend-link:focus-visible {
  outline: 2px solid color-mix(in srgb, var(--primary-color) 45%, transparent);
  outline-offset: 2px;
}
</style>
