export async function requestJson(apiBase, path, options = {}) {
  const {
    headers,
    timeoutMs = 0,
    ...fetchOptions
  } = options
  const controller = timeoutMs > 0 ? new AbortController() : null
  const timeoutId = controller
    ? window.setTimeout(() => controller.abort(), timeoutMs)
    : null

  let response
  try {
    response = await fetch(`${apiBase}${path}`, {
      ...fetchOptions,
      signal: controller?.signal,
      headers: {
        'Content-Type': 'application/json',
        ...(headers || {}),
      },
    })
  } catch (err) {
    if (err?.name === 'AbortError') {
      throw new Error(`Request timed out after ${timeoutMs} ms: ${path}`)
    }
    throw err
  } finally {
    if (timeoutId) {
      window.clearTimeout(timeoutId)
    }
  }

  if (!response.ok) {
    const text = await response.text()
    let message = text
    try {
      const payload = JSON.parse(text)
      message = payload.detail || payload.message || text
    } catch {
      // Preserve non-JSON service errors as returned.
    }
    throw new Error(message || `Request failed with status ${response.status}`)
  }

  return response.json()
}
