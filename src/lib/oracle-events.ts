export function openOracle(prefill?: string): void {
  window.dispatchEvent(
    new CustomEvent('protagonist:open-oracle', {
      detail: prefill ? { prefill } : undefined,
    })
  )
}
