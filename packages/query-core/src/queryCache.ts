import type { QueryFilters } from './utils'
import { matchQuery, parseFilterArgs } from './utils'
import type { Action, QueryState } from './query'
import { Query } from './query'
import type { NotifyEvent, QueryOptions } from './types'
import { notifyManager } from './notifyManager'
import type { QueryClient } from './queryClient'
import { Subscribable } from './subscribable'
import type { QueryObserver } from './queryObserver'

// TYPES

interface QueryCacheConfig {
  onError?: (error: unknown, query: Query<unknown, unknown, unknown>) => void
  onSuccess?: (data: unknown, query: Query<unknown, unknown, unknown>) => void
  onSettled?: (
    data: unknown | undefined,
    error: unknown | null,
    query: Query<unknown, unknown, unknown>,
  ) => void
}

interface NotifyEventQueryAdded extends NotifyEvent {
  type: 'added'
  query: Query<any, any, any>
}

interface NotifyEventQueryRemoved extends NotifyEvent {
  type: 'removed'
  query: Query<any, any, any>
}

interface NotifyEventQueryUpdated extends NotifyEvent {
  type: 'updated'
  query: Query<any, any, any>
  action: Action<any, any>
}

interface NotifyEventQueryObserverAdded extends NotifyEvent {
  type: 'observerAdded'
  query: Query<any, any, any>
  observer: QueryObserver<any, any, any, any>
}

interface NotifyEventQueryObserverRemoved extends NotifyEvent {
  type: 'observerRemoved'
  query: Query<any, any, any>
  observer: QueryObserver<any, any, any, any>
}

interface NotifyEventQueryObserverResultsUpdated extends NotifyEvent {
  type: 'observerResultsUpdated'
  query: Query<any, any, any>
}

interface NotifyEventQueryObserverOptionsUpdated extends NotifyEvent {
  type: 'observerOptionsUpdated'
  query: Query<any, any, any>
  observer: QueryObserver<any, any, any, any>
}

type QueryCacheNotifyEvent =
  | NotifyEventQueryAdded
  | NotifyEventQueryRemoved
  | NotifyEventQueryUpdated
  | NotifyEventQueryObserverAdded
  | NotifyEventQueryObserverRemoved
  | NotifyEventQueryObserverResultsUpdated
  | NotifyEventQueryObserverOptionsUpdated

type QueryCacheListener = (event: QueryCacheNotifyEvent) => void

// CLASS

export class QueryCache extends Subscribable<QueryCacheListener> {
  config: QueryCacheConfig

  private queries: Query<any, any, any>[]
  private queriesMap: {
    [key: string]: Query<any, any, any>
  }

  constructor(config?: QueryCacheConfig) {
    super()
    this.config = config || {}
    this.queries = []
    this.queriesMap = {}
  }

  build<TQueryFnData, TError, TData>(
    client: QueryClient,
    options: QueryOptions<TQueryFnData, TError, TData>,
    state?: QueryState<TData, TError>,
  ): Query<TQueryFnData, TError, TData> {
    const queryKey = options.queryKey!
    let query = this.get<TQueryFnData, TError, TData>(queryKey)

    if (!query) {
      query = new Query({
        cache: this,
        logger: client.getLogger(),
        queryKey,
        options: client.defaultQueryOptions(options),
        state,
        defaultOptions: client.getQueryDefaults(queryKey),
      })
      this.add(query)
    }

    return query
  }

  add(query: Query<any, any, any>): void {
    if (!this.queriesMap[query.queryKey]) {
      this.queriesMap[query.queryKey] = query
      this.queries.push(query)
      this.notify({
        type: 'added',
        query,
      })
    }
  }

  remove(query: Query<any, any, any>): void {
    const queryInMap = this.queriesMap[query.queryKey]

    if (queryInMap) {
      query.destroy()

      this.queries = this.queries.filter((x) => x !== query)

      if (queryInMap === query) {
        delete this.queriesMap[query.queryKey]
      }

      this.notify({ type: 'removed', query })
    }
  }

  clear(): void {
    notifyManager.batch(() => {
      this.queries.forEach((query) => {
        this.remove(query)
      })
    })
  }

  get<
    TQueryFnData = unknown,
    TError = unknown,
    TData = TQueryFnData,
  >(
    queryKey: string,
  ): Query<TQueryFnData, TError, TData> | undefined {
    return this.queriesMap[queryKey]
  }

  getAll(): Query[] {
    return this.queries
  }

  find<TQueryFnData = unknown, TError = unknown, TData = TQueryFnData>(
    arg1: string,
    arg2?: QueryFilters,
  ): Query<TQueryFnData, TError, TData> | undefined {
    const [filters] = parseFilterArgs(arg1, arg2)

    if (typeof filters.exact === 'undefined') {
      filters.exact = true
    }

    return this.queries.find((query) => matchQuery(filters, query))
  }

  findAll(queryKey?: string, filters?: QueryFilters): Query[]
  findAll(filters?: QueryFilters): Query[]
  findAll(arg1?: string | QueryFilters, arg2?: QueryFilters): Query[]
  findAll(arg1?: string | QueryFilters, arg2?: QueryFilters): Query[] {
    const [filters] = parseFilterArgs(arg1, arg2)
    return Object.keys(filters).length > 0
      ? this.queries.filter((query) => matchQuery(filters, query))
      : this.queries
  }

  notify(event: QueryCacheNotifyEvent) {
    notifyManager.batch(() => {
      this.listeners.forEach((listener) => {
        listener(event)
      })
    })
  }

  onFocus(): void {
    notifyManager.batch(() => {
      this.queries.forEach((query) => {
        query.onFocus()
      })
    })
  }

  onOnline(): void {
    notifyManager.batch(() => {
      this.queries.forEach((query) => {
        query.onOnline()
      })
    })
  }
}
