import { useCallback, useState } from 'react'
import { requestJson } from '@/lib/service-api'

/**
 * Hook for calling API endpoints with loading/error state.
 * Returns { data, loading, error, execute }.
 */
export function useApiCall(apiBase, path, { method = 'GET', autoReset = true } = {}) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const execute = useCallback(
    async (body = undefined) => {
      setLoading(true)
      if (autoReset) {
        setError(null)
      }

      try {
        const options = method === 'POST' ? { method: 'POST', body: JSON.stringify(body ?? {}) } : {}
        const result = await requestJson(apiBase, path, options)
        setData(result)
        return result
      } catch (err) {
        setError(String(err.message || err))
        return null
      } finally {
        setLoading(false)
      }
    },
    [apiBase, path, method, autoReset],
  )

  return { data, loading, error, execute }
}
