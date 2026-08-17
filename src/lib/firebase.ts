// MongoDB Real-time Client Adapter for Frontend

export const db = {
  type: 'mongodb',
  connected: true
};

export const auth = {
  currentUser: null
};

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  console.error(`[DB Error ${operationType} on ${path}]:`, error);
}

export function serverTimestamp() {
  return new Date().toISOString();
}

// References
export interface CollectionRef {
  _type: 'collection';
  name: string;
  constraints?: any[];
}

export interface DocRef {
  _type: 'doc';
  collection: string;
  id: string;
}

export interface QueryRef extends CollectionRef {
  constraints: any[];
}

export function collection(dbInstance: any, name: string): CollectionRef {
  return { _type: 'collection', name, constraints: [] };
}

export function doc(dbInstance: any, collectionName: string, id?: string): DocRef {
  return {
    _type: 'doc',
    collection: collectionName,
    id: id || ('doc_' + Math.random().toString(36).substring(2, 11) + Date.now().toString(36))
  };
}

export function query(colRef: CollectionRef, ...constraints: any[]): QueryRef {
  return {
    ...colRef,
    constraints: [...(colRef.constraints || []), ...constraints]
  };
}

export function where(field: string, op: string, value: any) {
  return { type: 'where', field, op, value };
}

export function orderBy(field: string, direction: 'asc' | 'desc' = 'asc') {
  return { type: 'orderBy', field, direction };
}

export function limit(count: number) {
  return { type: 'limit', count };
}

// Global SSE Manager for real-time synchronization
type SSECallback = (event: { collection: string; action: string; data: any; id?: string }) => void;
const sseListeners = new Set<SSECallback>();
let eventSource: EventSource | null = null;

function ensureSSE() {
  if (typeof window === 'undefined') return;
  if (eventSource) return;

  try {
    eventSource = new EventSource('/api/events');
    
    eventSource.addEventListener('db_change', (event: MessageEvent) => {
      try {
        const payload = JSON.parse(event.data);
        sseListeners.forEach(listener => listener(payload));
      } catch (err) {
        console.error('[SSE] Failed to parse db_change event:', err);
      }
    });

    eventSource.onerror = () => {
      console.warn('[SSE] EventSource disconnected, attempting auto-reconnect...');
      eventSource?.close();
      eventSource = null;
      setTimeout(ensureSSE, 3000);
    };
  } catch (err) {
    console.error('[SSE] EventSource setup error:', err);
  }
}

// --- Data Fetching & Operations ---

export async function getDocs(targetRef: CollectionRef | QueryRef): Promise<{
  docs: any[];
  empty: boolean;
  size: number;
}> {
  try {
    const colName = targetRef.name;
    const res = await fetch(`/api/data/${colName}`);
    if (!res.ok) {
      throw new Error(`Failed to fetch ${colName}: ${res.statusText}`);
    }
    let data: any[] = await res.json();

    // Client-side filter evaluation if query constraints are present
    if (targetRef.constraints && targetRef.constraints.length > 0) {
      for (const c of targetRef.constraints) {
        if (c.type === 'where') {
          data = data.filter(item => {
            const itemVal = item[c.field];
            if (c.op === '==' || c.op === '===') {
              return String(itemVal) === String(c.value);
            }
            if (c.op === '!=') return itemVal !== c.value;
            if (c.op === '>') return itemVal > c.value;
            if (c.op === '>=') return itemVal >= c.value;
            if (c.op === '<') return itemVal < c.value;
            if (c.op === '<=') return itemVal <= c.value;
            if (c.op === 'array-contains') {
              return Array.isArray(itemVal) && itemVal.includes(c.value);
            }
            return true;
          });
        } else if (c.type === 'orderBy') {
          data.sort((a, b) => {
            const valA = a[c.field];
            const valB = b[c.field];
            if (valA < valB) return c.direction === 'desc' ? 1 : -1;
            if (valA > valB) return c.direction === 'desc' ? -1 : 1;
            return 0;
          });
        } else if (c.type === 'limit') {
          data = data.slice(0, c.count);
        }
      }
    }

    const docs = data.map(item => ({
      id: item.id || item._id,
      data: () => item,
      ...item
    }));

    return {
      docs,
      empty: docs.length === 0,
      size: docs.length
    };
  } catch (err) {
    console.error(`[getDocs error on ${targetRef.name}]:`, err);
    return { docs: [], empty: true, size: 0 };
  }
}

export async function getDoc(docRef: DocRef): Promise<{
  id: string;
  exists: () => boolean;
  data: () => any;
  [key: string]: any;
}> {
  try {
    const res = await fetch(`/api/data/${docRef.collection}/${docRef.id}`);
    if (!res.ok) {
      if (res.status === 404) {
        return {
          id: docRef.id,
          exists: () => false,
          data: () => null
        };
      }
      throw new Error(`Failed to fetch doc ${docRef.id}: ${res.statusText}`);
    }
    const item = await res.json();
    return {
      id: item.id || item._id || docRef.id,
      exists: () => true,
      data: () => item,
      ...item
    };
  } catch (err) {
    return {
      id: docRef.id,
      exists: () => false,
      data: () => null
    };
  }
}

export async function addDoc(colRef: CollectionRef, data: any): Promise<{ id: string; [key: string]: any }> {
  const res = await fetch(`/api/data/${colRef.name}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  if (!res.ok) {
    throw new Error(`Failed to add document to ${colRef.name}: ${res.statusText}`);
  }
  const result = await res.json();
  return { id: result.id, ...result };
}

export async function updateDoc(docRef: DocRef, data: any): Promise<void> {
  const res = await fetch(`/api/data/${docRef.collection}/${docRef.id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  if (!res.ok) {
    throw new Error(`Failed to update document ${docRef.id}: ${res.statusText}`);
  }
}

export async function setDoc(docRef: DocRef, data: any, options?: { merge?: boolean }): Promise<void> {
  const res = await fetch(`/api/data/${docRef.collection}/${docRef.id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: docRef.id, ...data })
  });
  if (!res.ok) {
    throw new Error(`Failed to set document ${docRef.id}: ${res.statusText}`);
  }
}

export async function deleteDoc(docRef: DocRef): Promise<void> {
  const res = await fetch(`/api/data/${docRef.collection}/${docRef.id}`, {
    method: 'DELETE'
  });
  if (!res.ok) {
    throw new Error(`Failed to delete document ${docRef.id}: ${res.statusText}`);
  }
}

// Real-time listener: onSnapshot
export function onSnapshot(
  target: CollectionRef | QueryRef | DocRef,
  onNext: (snapshot: any) => void,
  onError?: (error: any) => void
): () => void {
  ensureSSE();

  let isActive = true;

  if (target._type === 'doc') {
    const docTarget = target as DocRef;
    
    // Initial fetch
    getDoc(docTarget)
      .then(snap => {
        if (isActive) onNext(snap);
      })
      .catch(err => {
        if (isActive && onError) onError(err);
      });

    // Real-time change listener
    const sseListener: SSECallback = (event) => {
      if (event.collection.toLowerCase() === docTarget.collection.toLowerCase()) {
        if (event.id === docTarget.id || event.action === 'delete') {
          getDoc(docTarget)
            .then(snap => {
              if (isActive) onNext(snap);
            })
            .catch(err => {
              if (isActive && onError) onError(err);
            });
        }
      }
    };

    sseListeners.add(sseListener);

    return () => {
      isActive = false;
      sseListeners.delete(sseListener);
    };
  }

  // Collection or Query
  const colTarget = target as CollectionRef | QueryRef;

  // Initial fetch
  getDocs(colTarget)
    .then(snap => {
      if (isActive) onNext(snap);
    })
    .catch(err => {
      if (isActive && onError) onError(err);
    });

  // Real-time change listener
  const sseListener: SSECallback = (event) => {
    if (event.collection.toLowerCase() === colTarget.name.toLowerCase()) {
      getDocs(colTarget)
        .then(snap => {
          if (isActive) onNext(snap);
        })
        .catch(err => {
          if (isActive && onError) onError(err);
        });
    }
  };

  sseListeners.add(sseListener);

  return () => {
    isActive = false;
    sseListeners.delete(sseListener);
  };
}
