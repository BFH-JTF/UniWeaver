<template>
  <span v-if="id" class="d-inline-flex align-center">
    <v-tooltip location="top" :text="copied ? 'Copied to clipboard' : 'Copy ID'">
      <template #activator="{ props: tooltipProps }">
        <v-btn
          v-bind="tooltipProps"
          :icon="copied ? 'mdi-check' : 'mdi-content-copy'"
          :color="copied ? 'success' : color"
          variant="text"
          size="x-small"
          class="ml-1"
          @click.stop.prevent="copy"
        />
      </template>
    </v-tooltip>
  </span>
</template>

<script setup lang="ts">
import { ref } from 'vue'

const props = defineProps<{
  id?: string | null
  /** Pass 'white' when placed on a dark header background. */
  color?: string
}>()

const copied = ref(false)
let timer: number | undefined

async function copy() {
  if (!props.id) return
  try {
    await navigator.clipboard.writeText(props.id)
  } catch {
    const textarea = document.createElement('textarea')
    textarea.value = props.id
    textarea.style.position = 'fixed'
    textarea.style.opacity = '0'
    document.body.appendChild(textarea)
    textarea.select()
    document.execCommand('copy')
    document.body.removeChild(textarea)
  }
  copied.value = true
  window.clearTimeout(timer)
  timer = window.setTimeout(() => {
    copied.value = false
  }, 1500)
}
</script>