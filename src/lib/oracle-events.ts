export function openOracle(
  prefill?: string,
  context?: 'morning_checkin'
): void {
  window.dispatchEvent(
    new CustomEvent('protagonist:open-oracle', {
      detail: { prefill, context },
    })
  )
}
