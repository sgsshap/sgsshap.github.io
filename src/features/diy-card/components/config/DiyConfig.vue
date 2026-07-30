<script setup lang="ts">
import LegendConfig from '@/features/diy-card/components/config/LegendConfig.vue'
import { useInfoStore } from '@/features/diy-card/stores'
import { useTemplateStore } from '@/features/diy-card/stores'
import type { BaseRenderConfig } from '@/features/diy-card/types/diy/base'
import { applyFieldChange, recordTextBlurModify } from '@/features/diy-card/utils/diyHistoryField'
import {
  getTemplateAuthorContactLabel,
  TEMPLATE_AUTHOR_NO_CONTACT_LABEL,
} from '@/features/diy-card/types/template'
import { CancelRound, CheckCircleRound, HelpRound } from '@/shared/icons'
import { formatKingdoms } from '@/shared/utils/kingdom'
import { useMessage } from 'naive-ui'
import { computed, ref } from 'vue'

/* 依赖注入 */
const infoStore = useInfoStore()
const templateStore = useTemplateStore()
const message = useMessage()

/** 当前牌种下的水印配置（直接读 store，避免 setup 时 info 快照与恢复后 renderConfig 脱节） */
const watermark = computed((): BaseRenderConfig['watermark'] => infoStore.renderConfig.watermark)

const watermarkUsername = computed({
  get: () => watermark.value.username ?? '',
  set: (value: string) => {
    watermark.value.username = value
  },
})

/* 状态定义 */
const size = ref<'small' | 'medium' | 'large'>('medium')
const templateType = ref(templateStore.templateType)

/* 核心逻辑 */
/**
 * 切换模板类型
 * @param value - 选中的模板类型值
 */
const handleChangeTemplate = (value: string) => {
  const firstTemplate = templateStore.getFirstTemplate(value)
  if (!firstTemplate) {
    message.error('该类型的模板未配置！')
    templateType.value = templateStore.templateType
    return
  }
  templateStore.setTemplateType(value)
}

const onWatermarkShowFlagChange = (value: boolean) => {
  applyFieldChange(
    '水印开关',
    watermark.value.showFlag,
    value,
    (v) => {
      watermark.value.showFlag = v
    },
    { category: 'watermark', format: 'bool' },
  )
}

let watermarkUsernameOnFocus = ''
const onWatermarkUsernameFocus = () => {
  watermarkUsernameOnFocus = watermark.value.username ?? ''
}
const onWatermarkUsernameBlur = () => {
  recordTextBlurModify(
    '个人水印',
    watermarkUsernameOnFocus,
    watermark.value.username ?? '',
    { category: 'watermark' },
  )
}
</script>

<template>
  <n-el class="diy-config">
    <n-form
      ref="formRef"
      :model="infoStore.info"
      label-placement="left"
      label-align="right"
      label-width="110"
      require-mark-placement="right-hanging"
      :size="size"
    >
      <n-collapse
        :default-expanded-names="['template', 'copyright', 'base', 'skill', 'package', 'other']"
      >
        <n-collapse-item title="模板信息" name="template">
          <n-form-item label="模板类型">
            <n-select
              v-model:value="templateType"
              :options="templateStore.templateTypeOptions"
              @update:value="handleChangeTemplate"
            >
            </n-select>
          </n-form-item>
          <n-form-item label="选择模板">
            <n-select
              v-model:value="templateStore.currentTemplateName"
              :options="templateStore.templateOptions"
              placeholder="请选择模板"
            />
          </n-form-item>
          <n-form-item label="模板介绍" class="diy-config__template-intro" :show-feedback="false">
            <div class="diy-config__template-card-body">
              <p class="diy-config__template-desc">
                {{ templateStore.currentTemplate.desc }}
              </p>
              <div class="diy-config__template-meta-group">
                <p class="diy-config__template-meta diy-config__template-meta--authors">
                  <span class="diy-config__template-meta-key">作者</span>
                  <span class="diy-config__template-authors-list">
                  <template
                    v-for="(author, index) in templateStore.currentTemplate.authors"
                    :key="author.name"
                  >
                    <n-popover trigger="click" placement="top" :show-arrow="true">
                      <template #trigger>
                        <button type="button" class="diy-config__template-author-btn">
                          {{ author.name }}
                        </button>
                      </template>
                      <div class="diy-config__template-author-popover">
                        <div class="diy-config__template-author-popover-title">{{ author.name }}</div>
                        <div
                          :class="{
                            'diy-config__template-author-popover-empty':
                              getTemplateAuthorContactLabel(author) === TEMPLATE_AUTHOR_NO_CONTACT_LABEL,
                          }"
                        >
                          {{ getTemplateAuthorContactLabel(author) }}
                        </div>
                      </div>
                    </n-popover>
                    <span
                      v-if="index < templateStore.currentTemplate.authors.length - 1"
                      class="diy-config__template-author-sep"
                    >、</span>
                  </template>
                </span>
              </p>
                <p class="diy-config__template-meta">
                  适用：{{ templateStore.currentTemplate.apply }}
                </p>
                <p
                  v-if="templateStore.currentTemplate.config?.kingdoms"
                  class="diy-config__template-meta"
                >
                  势力：{{ formatKingdoms(templateStore.currentTemplate.config.kingdoms.value as string[]) }}
                </p>
              </div>
              <div class="diy-config__template-features">
                <template v-for="(config, key) in templateStore.currentTemplate.config" :key="key">
                  <span
                    v-if="
                      key !== 'kingdoms'
                        && (config.showFlag === undefined || config.showFlag)
                        && config.label
                    "
                    class="diy-config__template-feature"
                  >
                    <n-icon
                      v-if="config.value"
                      color="var(--success-color)"
                      :size="14"
                    >
                      <CheckCircleRound />
                    </n-icon>
                    <n-icon
                      v-else
                      color="var(--error-color)"
                      :size="14"
                    >
                      <CancelRound />
                    </n-icon>
                    {{ config.label }}
                  </span>
                </template>
              </div>
            </div>
          </n-form-item>
        </n-collapse-item>
        <n-collapse-item title="版权水印" name="copyright">
          <n-form-item label="水印开关">
            <template #label>
              <div class="diy-config__form-label">
                <n-tooltip trigger="hover">
                  <template #trigger>
                    <n-icon size="1.1em">
                      <HelpRound />
                    </n-icon>
                  </template>
                  <div>如需发布到群组或社交平台，请开启水印，防止引起不必要的争论！</div>
                </n-tooltip>
                <span>水印开关</span>
              </div>
            </template>
            <n-switch
              :value="watermark.showFlag"
              @update:value="onWatermarkShowFlagChange"
            >
              <template #checked>开启</template>
              <template #unchecked>关闭</template>
            </n-switch>
          </n-form-item>
          <n-form-item label="个人水印">
            <n-input
              v-model:value="watermarkUsername"
              placeholder="@Author:"
              :maxlength="20"
              clearable
              @focus="onWatermarkUsernameFocus"
              @blur="onWatermarkUsernameBlur"
            />
          </n-form-item>
        </n-collapse-item>
        <LegendConfig v-if="templateStore.templateType === 'legend'" />
      </n-collapse>
    </n-form>
  </n-el>
</template>

<style scoped>
.diy-config__form-label {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 2px;
  width: 100%;
}

.diy-config__template-intro :deep(.n-form-item-blank) {
  min-width: 0;
}

.diy-config__template-intro :deep(.n-form-item) {
  align-items: flex-start;
}

.diy-config__template-intro :deep(.n-form-item-label) {
  padding-top: calc((var(--diy-form-control-height, 32px) - 1em) / 2);
}

.diy-config__template-authors-list {
  display: inline;
}

.diy-config__template-author-btn {
  padding: 0 2px;
  border: none;
  background: none;
  font: inherit;
  font-weight: 600;
  color: var(--primary-color);
  cursor: pointer;
  text-decoration: underline;
  text-decoration-style: dotted;
  text-underline-offset: 3px;
}

.diy-config__template-author-btn:hover {
  color: var(--primary-color-hover);
}

.diy-config__template-author-sep {
  color: var(--text-color-2);
}

.diy-config__template-author-popover {
  max-width: 240px;
  font-size: 13px;
  line-height: 1.5;
}

.diy-config__template-author-popover-title {
  font-weight: 700;
  margin-bottom: 4px;
}

.diy-config__template-author-popover-empty {
  color: var(--text-color-3);
  font-style: italic;
}
</style>
