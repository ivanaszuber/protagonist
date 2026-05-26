export function openOracle(
  prefill?: string,
  context?: string
): void {
  window.dispatchEvent(
    new CustomEvent('protagonist:open-oracle', {
      detail: { prefill, context },
    })
  )
}
