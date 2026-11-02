import { useEffect, useRef, useState } from 'react';
import { supabase } from '../supabaseClient';
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';

type RealtimeEvent = 'INSERT' | 'UPDATE' | 'DELETE';
// postgres_changes payloads are schema-generic; consumers only read
// `eventType`, `new`/`old`. `any` keeps the plumbing untyped while the event
// data is treated opaque.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RawPayload = RealtimePostgresChangesPayload<any>;

// Low-level helper: subscribe to postgres_changes on a single table and call
// `cb` for every matching event. Returns an unsubscribe function. Used by the
// store facades (module scope, outside React) as well as components.
export function subscribeTableChanges(
  table: string,
  cb: (payload: RawPayload) => void,
  filter?: string,
): () => void {
  const channel = supabase.channel(`db-${table}-${Math.random().toString(36).slice(2)}`);
  channel.on(
    'postgres_changes',
    {
      event: '*',
      schema: 'public',
      table,
      ...(filter ? { filter } : {}),
    },
    (payload) => cb(payload),
  );
  channel.subscribe();
  return () => {
    void supabase.removeChannel(channel);
  };
}

export interface RealtimeParams {
  table: string;
  events?: RealtimeEvent[];
  filter?: string;
  enabled?: boolean;
  onEvent: (payload: RawPayload) => void;
}

// React hook wrapping subscribeTableChanges with automatic cleanup. `events`
// defaults to all events.
export function useDbRealtime({ table, events, filter, enabled = true, onEvent }: RealtimeParams): void {
  const cbRef = useRef(onEvent);
  cbRef.current = onEvent;

  const argsKey = `${table}|${filter ?? ''}|${(events ?? ['*']).join(',')}`;

  useEffect(() => {
    if (!enabled) return;
    const unsubscribe = subscribeTableChanges(table, (payload) => {
      if (events && payload.eventType && !events.includes(payload.eventType as RealtimeEvent)) return;
      cbRef.current(payload);
    }, filter);
    return unsubscribe;
  }, [argsKey, enabled]);
}

// Small data-fetching hook: runs `fetcher` when mounted (and when deps/tick
// change), exposing { data, loading, error, reload }.
export function useDbQuery<T>(
  fetcher: () => Promise<T>,
  deps: unknown[],
  enabled = true,
): { data: T | null; loading: boolean; error: unknown; reload: () => void } {
  const [state, setState] = useState<{ data: T | null; loading: boolean; error: unknown }>({
    data: null,
    loading: enabled,
    error: null,
  });
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    setState({ data: null, loading: true, error: null });
    fetcher()
      .then((data) => {
        if (alive) setState({ data, loading: false, error: null });
      })
      .catch((error) => {
        if (alive) setState({ data: null, loading: false, error });
      });
    return () => {
      alive = false;
    };
  }, [...deps, enabled, tick]);

  return { ...state, reload: () => setTick((t) => t + 1) };
}
