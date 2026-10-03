import { ref, h, type VNode, type Component } from 'vue'
import KoruConfirmDialog from '../components/KoruConfirmDialog.vue'

export interface ConfirmOptions {
  title: string
  content: string
  type?: 'info' | 'warning' | 'danger'
  okText?: string
  cancelText?: string
}

/**
 * 零 Arco 确认弹窗 composable
 *
 * 使用方式：
 *   const { confirm, ConfirmDialog } = useConfirm()
 *   const ok = await confirm({ title: '确认', content: '确定要删除吗？', type: 'danger' })
 *   // template 里放 <ConfirmDialog />
 *
 * 和 window.confirm 区别：返回 Promise<boolean>，异步友好，UI 风格统一。
 */
export function useConfirm() {
  const visible = ref(false)
  const loading = ref(false)
  const opts = ref<ConfirmOptions>({ title: '', content: '' })
  let resolveFn: ((ok: boolean) => void) | null = null

  function confirm(options: ConfirmOptions): Promise<boolean> {
    opts.value = options
    visible.value = true
    return new Promise<boolean>((resolve) => {
      resolveFn = resolve
    })
  }

  function handleOk() {
    resolveFn?.(true)
    resolveFn = null
  }

  function handleCancel() {
    resolveFn?.(false)
    resolveFn = null
  }

  /** 以编程方式渲染 ConfirmDialog（无需手动在 template 挂载） */
  function renderVNode(): VNode {
    return h(KoruConfirmDialog as Component, {
      visible: visible.value,
      'onUpdate:visible': (v: boolean) => { visible.value = v; if (!v) handleCancel() },
      title: opts.value.title,
      content: opts.value.content,
      type: opts.value.type,
      okText: opts.value.okText,
      cancelText: opts.value.cancelText,
      loading: loading.value,
      onOk: handleOk,
      onCancel: handleCancel,
    })
  }

  return { confirm, visible, loading, renderVNode }
}

/**
 * 命令式调用（无需挂载组件）：
 *   const ok = await confirm({ title: '...', content: '...' })
 */
export async function confirm(options: ConfirmOptions): Promise<boolean> {
  const { confirm: show } = useConfirm()
  return show(options)
}
