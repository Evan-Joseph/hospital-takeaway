import { useState, useEffect, useCallback } from 'react'

interface AsyncState<T> {
  data: T | null
  loading: boolean
  error: Error | null
}

export function useAsync<T>(
  asyncFunction: () => Promise<T>,
  dependencies: any[] = []
) {
  const [state, setState] = useState<AsyncState<T>>({
    data: null,
    loading: true,
    error: null
  })

  const execute = useCallback(async () => {
    setState({ data: null, loading: true, error: null })
    
    try {
      const result = await asyncFunction()
      setState({ data: result, loading: false, error: null })
      return result
    } catch (error) {
      setState({ data: null, loading: false, error: error as Error })
      throw error
    }
  }, dependencies)

  useEffect(() => {
    execute()
  }, [execute])

  return {
    ...state,
    execute
  }
}

// 手动触发的异步hook
export function useAsyncCallback<T, Args extends any[]>(
  asyncFunction: (...args: Args) => Promise<T>
) {
  const [state, setState] = useState<AsyncState<T>>({
    data: null,
    loading: false,
    error: null
  })

  const execute = useCallback(async (...args: Args) => {
    setState(prev => ({ ...prev, loading: true, error: null }))
    
    try {
      const result = await asyncFunction(...args)
      setState({ data: result, loading: false, error: null })
      return result
    } catch (error) {
      setState(prev => ({ ...prev, loading: false, error: error as Error }))
      throw error
    }
  }, [])

  return {
    ...state,
    execute
  }
}