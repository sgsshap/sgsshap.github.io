<template>
  <div class="donation-view">
    <header class="donation-view__panel donation-view__page-head">
      <p class="donation-view__eyebrow">支持 JxShap</p>
      <h1 class="donation-view__title">{{ DONATION_CAMPAIGN_TITLE }}</h1>
      <p class="donation-view__lead">
        网站持续运营与开发需要成本。若你觉得 JxShap 对你有帮助，欢迎自愿捐助，帮助我们走得更远。
      </p>
    </header>

    <section class="donation-view__panel donation-view__section">
      <div class="donation-view__stack">
        <div class="donation-view__stack-block donation-view__stack-block--story">
          <p class="donation-view__block-label">开发者说</p>
          <p class="donation-view__callout donation-view__callout--soft">
            <span class="donation-view__callout-bar" aria-hidden="true" />
            <span>{{ DONATION_STORY }}</span>
          </p>
        </div>

        <div class="donation-view__stack-split" aria-hidden="true" />

        <div class="donation-view__stack-block donation-view__stack-block--pay">
          <div class="donation-view__pay-head">
            <span class="donation-view__icon">
              <n-icon :size="18" :component="VolunteerActivismRound" />
            </span>
            <div class="donation-view__pay-head-copy">
              <p class="donation-view__block-label">捐助方式</p>
              <p class="donation-view__block-desc">选择支付方式后扫码</p>
            </div>
          </div>

          <div class="donation-view__inset donation-view__pay-stack">
            <div class="donation-view__pay-row">
              <span class="donation-view__field-label">支付方式</span>
              <n-radio-group v-model:value="paymentMethod" size="medium">
                <n-radio-button
                  v-for="option in paymentOptions"
                  :key="option.key"
                  :value="option.key"
                >
                  {{ option.label }}
                </n-radio-button>
              </n-radio-group>
            </div>

            <div class="donation-view__field-split" aria-hidden="true" />

            <div class="donation-view__qr-block">
              <div class="donation-view__qr-frame">
                <img
                  :key="paymentMethod"
                  :src="activeQrSrc()"
                  :alt="`${activePaymentLabel}收款码`"
                  class="donation-view__qr-image"
                />
              </div>
              <div class="donation-view__qr-meta">
                <p class="donation-view__qr-method">{{ activePaymentLabel }}</p>
                <p class="donation-view__qr-account">收款方：{{ activeAccount() }}</p>
                <p class="donation-view__qr-tip">长按或扫码完成捐助</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import {
  DONATION_ALIPAY_ACCOUNT,
  DONATION_ALIPAY_LABEL,
  DONATION_CAMPAIGN_TITLE,
  DONATION_QR_ALIPAY,
  DONATION_QR_WECHAT,
  DONATION_STORY,
  DONATION_WECHAT_ACCOUNT,
  DONATION_WECHAT_LABEL,
} from '@/features/donation/constants'
import { VolunteerActivismRound } from '@/shared/icons'
import { computed, ref } from 'vue'
import { NIcon } from 'naive-ui'

defineOptions({ name: 'DonationView' })

type PaymentMethod = 'wechat' | 'alipay'

const paymentMethod = ref<PaymentMethod>('wechat')

const paymentOptions = [
  { key: 'wechat' as const, label: DONATION_WECHAT_LABEL },
  { key: 'alipay' as const, label: DONATION_ALIPAY_LABEL },
]

const activeQrSrc = () => (paymentMethod.value === 'wechat' ? DONATION_QR_WECHAT : DONATION_QR_ALIPAY)

const activeAccount = () =>
  paymentMethod.value === 'wechat' ? DONATION_WECHAT_ACCOUNT : DONATION_ALIPAY_ACCOUNT

const activePaymentLabel = computed(() =>
  paymentMethod.value === 'wechat' ? DONATION_WECHAT_LABEL : DONATION_ALIPAY_LABEL,
)
</script>

<style scoped>
.donation-view {
  --page-p: 28px;
  --page-inset: 20px;
  --page-gap: 16px;
  --page-r: 12px;

  max-width: 720px;
  margin: 0 auto;
  padding: 20px 16px 48px;
  display: flex;
  flex-direction: column;
  gap: var(--page-gap);
}

.donation-view > * {
  animation: donation-in 0.5s cubic-bezier(0.22, 1, 0.36, 1) backwards;
}

.donation-view > *:nth-child(1) { animation-delay: 0ms; }
.donation-view > *:nth-child(2) { animation-delay: 60ms; }

@keyframes donation-in {
  from {
    opacity: 0;
    transform: translateY(12px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@media (prefers-reduced-motion: reduce) {
  .donation-view > * {
    animation: none;
  }
}

.donation-view__panel {
  position: relative;
  border: 1px solid var(--border-color);
  border-radius: var(--page-r);
  background: var(--card-color);
}

.donation-view__inset {
  padding: var(--page-inset);
  border-radius: calc(var(--page-r) - 2px);
  background: color-mix(in srgb, var(--body-color) 48%, var(--card-color));
}

/* ---------- Page head ---------- */
.donation-view__page-head {
  padding: calc(var(--page-p) + 2px) var(--page-p) var(--page-p);
  border-color: color-mix(in srgb, var(--primary-color) 18%, var(--border-color));
  background:
    radial-gradient(
      ellipse 80% 55% at 100% 0%,
      color-mix(in srgb, var(--primary-color) 20%, transparent) 0%,
      transparent 58%
    ),
    linear-gradient(
      145deg,
      color-mix(in srgb, var(--primary-color) 12%, var(--card-color)) 0%,
      var(--card-color) 52%,
      color-mix(in srgb, var(--primary-color-suppl) 22%, var(--card-color)) 100%
    );
}

.donation-view__eyebrow {
  margin: 0 0 6px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.12em;
  color: var(--primary-color);
}

.donation-view__title {
  margin: 0 0 10px;
  font-size: 22px;
  line-height: 1.35;
  font-weight: 700;
  color: var(--text-color-base);
}

.donation-view__lead {
  margin: 0;
  max-width: 40em;
  font-size: 14px;
  line-height: 1.75;
  color: var(--text-color-2);
}

/* ---------- Main stack (community-stack 变体) ---------- */
.donation-view__section {
  padding: var(--page-p);
}

.donation-view__stack {
  border-radius: calc(var(--page-r) - 2px);
  border: 1px solid color-mix(in srgb, var(--primary-color) 24%, var(--border-color));
  background: color-mix(in srgb, var(--primary-color) 5%, color-mix(in srgb, var(--body-color) 48%, var(--card-color)));
  overflow: hidden;
}

.donation-view__stack-block {
  padding: var(--page-inset);
}

.donation-view__stack-block--story {
  background: linear-gradient(
    135deg,
    color-mix(in srgb, var(--primary-color) 14%, transparent) 0%,
    transparent 62%
  );
}

.donation-view__stack-split {
  height: 1px;
  background: var(--divider-color);
}

.donation-view__block-label {
  margin: 0 0 10px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.1em;
  color: var(--text-color-3);
}

.donation-view__block-desc {
  margin: -6px 0 0;
  font-size: 12px;
  line-height: 1.45;
  color: var(--text-color-3);
}

.donation-view__callout {
  display: flex;
  align-items: stretch;
  gap: 14px;
  margin: 0;
  padding: 14px var(--page-inset);
  font-size: 15px;
  font-weight: 600;
  line-height: 1.65;
  color: var(--text-color-base);
  border-radius: calc(var(--page-r) - 4px);
  border: 1px solid color-mix(in srgb, var(--primary-color) 18%, var(--border-color));
  background: color-mix(
    in srgb,
    var(--primary-color) 8%,
    color-mix(in srgb, var(--body-color) 48%, var(--card-color))
  );
}

.donation-view__callout--soft {
  font-size: 14px;
  font-weight: 400;
  line-height: 1.85;
  color: var(--text-color-2);
}

.donation-view__callout-bar {
  width: 4px;
  flex-shrink: 0;
  border-radius: 2px;
  background: linear-gradient(
    180deg,
    var(--primary-color) 0%,
    color-mix(in srgb, var(--primary-color) 45%, transparent) 100%
  );
}

.donation-view__pay-head {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  margin-bottom: var(--page-gap);
}

.donation-view__icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  flex-shrink: 0;
  border-radius: 10px;
  color: var(--primary-color);
  background: color-mix(in srgb, var(--primary-color) 16%, transparent);
  border: 1px solid color-mix(in srgb, var(--primary-color) 22%, transparent);
}

.donation-view__pay-head-copy {
  min-width: 0;
}

.donation-view__pay-head-copy .donation-view__block-label {
  margin-bottom: 4px;
}

/* ---------- Pay / QR ---------- */
.donation-view__pay-stack {
  display: flex;
  flex-direction: column;
  gap: 0;
  padding: 6px 16px var(--page-inset);
  background: color-mix(in srgb, var(--body-color) 52%, var(--card-color));
}

.donation-view__pay-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 0;
  flex-wrap: wrap;
}

.donation-view__field-split {
  height: 1px;
  background: var(--divider-color);
}

.donation-view__field-label {
  font-size: 14px;
  font-weight: 600;
  line-height: 1.35;
  color: var(--text-color-base);
}

.donation-view__qr-block {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 14px;
  padding: 18px 0 10px;
}

.donation-view__qr-frame {
  width: min(100%, 268px);
  aspect-ratio: 1;
  padding: 12px;
  border-radius: calc(var(--page-r) - 2px);
  border: 1px solid color-mix(in srgb, var(--primary-color) 26%, var(--border-color));
  background:
    radial-gradient(
      ellipse 90% 70% at 50% 0%,
      color-mix(in srgb, var(--primary-color) 12%, transparent) 0%,
      transparent 65%
    ),
    color-mix(in srgb, var(--body-color) 42%, var(--card-color));
  box-shadow: inset 0 1px 0 color-mix(in srgb, var(--primary-color) 12%, transparent);
}

.donation-view__qr-image {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: contain;
  border-radius: 6px;
}

.donation-view__qr-meta {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  text-align: center;
}

.donation-view__qr-method {
  margin: 0;
  font-size: 13px;
  font-weight: 600;
  line-height: 1.5;
  letter-spacing: 0.04em;
  color: color-mix(in srgb, var(--primary-color) 68%, var(--text-color-2));
}

.donation-view__qr-account {
  margin: 0;
  font-size: 14px;
  font-weight: 500;
  color: var(--text-color-1);
}

.donation-view__qr-tip {
  margin: 0;
  font-size: 12px;
  line-height: 1.5;
  color: var(--text-color-3);
}

/* ---------- Responsive ---------- */
@media (max-width: 520px) {
  .donation-view {
    --page-p: 20px;
    --page-inset: 16px;
    padding: 16px 12px 36px;
  }

  .donation-view__pay-stack {
    padding: 4px 14px var(--page-inset);
  }

  .donation-view__pay-row {
    flex-direction: column;
    align-items: stretch;
  }
}
</style>
