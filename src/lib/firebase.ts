// MongoDB Real-time Client Adapter for Frontend with Resilient Offline/Serverless Caching
import { INITIAL_CATEGORIES, INITIAL_MENU_ITEMS } from '../constants';

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
  console.warn(`[DB Operation ${operationType} on ${path}]:`, error);
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

export function collection(_dbInstance: any, name: string): CollectionRef {
  return { _type: 'collection', name, constraints: [] };
}

export function doc(_dbInstance: any, collectionName: string, id?: string): DocRef {
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

// Local Storage & Memory Fallback Store
const STORAGE_PREFIX = 'senpai_sushi_db_';

function getDefaultCollectionData(collectionName: string): any[] {
  const col = collectionName.toLowerCase();
  if (col === 'categories') {
    return INITIAL_CATEGORIES.map((c, i) => ({
      id: `cat_${i + 1}`,
      name: c.name,
      icon: c.icon,
      fixedPrice: c.fixedPrice || 0,
      isIndividualPricing: false,
      createdAt: new Date().toISOString()
    }));
  }
  if (col === 'menuitems') {
    return INITIAL_MENU_ITEMS.map((m, i) => ({
      id: `item_${i + 1}`,
      name: m.name,
      categoryId: m.categoryId,
      categoryIds: [m.categoryId],
      price: m.price || 0,
      description: m.description || '',
      imageUrl: m.imageUrl || '',
      visible: true,
      allergies: [],
      createdAt: new Date().toISOString()
    }));
  }
  if (col === 'tables') {
    return Array.from({ length: 10 }, (_, i) => ({
      id: `table_${i + 1}`,
      name: `Table ${i + 1}`,
      isActive: true,
      createdAt: new Date().toISOString()
    }));
  }
  if (col === 'printers') {
    return [{
      id: 'printer_1',
      name: 'Custom P3',
      type: 'thermal',
      serialNumber: 'MECC2019222350530',
      macAddress: '000EE21A956E',
      port: 9100,
      isDefault: true,
      createdAt: new Date().toISOString()
    }];
  }
  if (col === 'settings') {
    return [{
      id: 'site',
      siteName: 'Smart Menu & Kitchen',
      logo: '',
      favicon: '',
      contactEmail: 'info@restaurant.com',
      contactPhone: '+39 123 456 7890',
      address: 'Via Roma, 12, Milano',
      footerText: 'Powered by Smart Menu',
      createdAt: new Date().toISOString()
    }];
  }
  return [];
}

function getLocalData(collectionName: string): any[] {
  const col = collectionName.toLowerCase();
  if (typeof window === 'undefined') return getDefaultCollectionData(col);

  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + col);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (e) {
    console.warn('[LocalStorage read error]:', e);
  }

  const defaults = getDefaultCollectionData(col);
  if (defaults.length > 0) {
    setLocalData(col, defaults);
  }
  return defaults;
}

function setLocalData(collectionName: string, items: any[]) {
  const col = collectionName.toLowerCase();
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_PREFIX + col, JSON.stringify(items));
  } catch (e) {
    console.warn('[LocalStorage write error]:', e);
  }
}

// Global SSE & Polling Manager for real-time synchronization
type SSECallback = (event: { collection: string; action: string; data: any; id?: string }) => void;
const sseListeners = new Set<SSECallback>();
let eventSource: EventSource | null = null;

export function broadcastLocalEvent(collectionName: string, action: 'create' | 'update' | 'delete', data: any, id?: string) {
  const col = collectionName.toLowerCase();
  const payload = {
    collection: col,
    action,
    data,
    id: id || data?.id || data?._id
  };

  // Sync to local cache immediately
  const current = getLocalData(col);
  if (action === 'create') {
    if (!current.some(item => item.id === payload.id || item._id === payload.id)) {
      setLocalData(col, [data, ...current]);
    }
  } else if (action === 'update') {
    const next = current.map(item => (item.id === payload.id || item._id === payload.id) ? { ...item, ...data } : item);
    if (!next.some(item => item.id === payload.id || item._id === payload.id)) {
      next.push({ id: payload.id, ...data });
    }
    setLocalData(col, next);
  } else if (action === 'delete') {
    setLocalData(col, current.filter(item => item.id !== payload.id && item._id !== payload.id));
  }

  sseListeners.forEach(listener => {
    try {
      listener(payload);
    } catch (e) {
      console.error('[SSE Listener Error]:', e);
    }
  });
}

function ensureSSE() {
  if (typeof window === 'undefined') return;
  if (eventSource) return;

  try {
    eventSource = new EventSource('/api/events');
    
    eventSource.addEventListener('db_change', (event: MessageEvent) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload.collection && payload.data) {
          const col = payload.collection.toLowerCase();
          const current = getLocalData(col);
          if (payload.action === 'create') {
            if (!current.some(i => i.id === payload.id)) {
              setLocalData(col, [payload.data, ...current]);
            }
          } else if (payload.action === 'update') {
            setLocalData(col, current.map(i => i.id === payload.id ? { ...i, ...payload.data } : i));
          } else if (payload.action === 'delete') {
            setLocalData(col, current.filter(i => i.id !== payload.id));
          }
        }
        sseListeners.forEach(listener => listener(payload));
      } catch (err) {
        console.warn('[SSE] Failed to parse db_change event:', err);
      }
    });

    eventSource.onerror = () => {
      eventSource?.close();
      eventSource = null;
      setTimeout(ensureSSE, 6000);
    };
  } catch (err) {
    console.warn('[SSE] EventSource setup error:', err);
  }
}

// --- Data Fetching & Operations ---

export async function getDocs(targetRef: CollectionRef | QueryRef): Promise<{
  docs: any[];
  empty: boolean;
  size: number;
}> {
  const colName = targetRef.name;
  const colKey = colName.toLowerCase();
  let data: any[] = [];

  try {
    const res = await fetch(`/api/data/${colName}`);
    if (res.ok) {
      data = await res.json();
      if (Array.isArray(data)) {
        setLocalData(colKey, data);
      } else {
        data = getLocalData(colKey);
      }
    } else {
      data = getLocalData(colKey);
    }
  } catch (err) {
    data = getLocalData(colKey);
  }

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
}

export async function getDoc(docRef: DocRef): Promise<{
  id: string;
  exists: () => boolean;
  data: () => any;
  [key: string]: any;
}> {
  const colKey = docRef.collection.toLowerCase();
  let item: any = null;

  try {
    const res = await fetch(`/api/data/${docRef.collection}/${docRef.id}`);
    if (res.ok) {
      item = await res.json();
    }
  } catch (_err) {
    // fallback to local data
  }

  if (!item) {
    const localList = getLocalData(colKey);
    item = localList.find(i => i.id === docRef.id || i._id === docRef.id);
  }

  if (!item) {
    return {
      id: docRef.id,
      exists: () => false,
      data: () => null
    };
  }

  return {
    id: item.id || item._id || docRef.id,
    exists: () => true,
    data: () => item,
    ...item
  };
}

export async function addDoc(colRef: CollectionRef, data: any): Promise<{ id: string; [key: string]: any }> {
  const colKey = colRef.name.toLowerCase();
  const id = data.id || `${colKey}_${Math.random().toString(36).substring(2, 9)}_${Date.now().toString(36)}`;
  const itemWithId = { id, createdAt: new Date().toISOString(), ...data };

  // Optimistic local update
  broadcastLocalEvent(colRef.name, 'create', itemWithId, id);

  try {
    const res = await fetch(`/api/data/${colRef.name}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(itemWithId)
    });
    if (res.ok) {
      const result = await res.json();
      return { id: result.id || id, ...result };
    }
  } catch (err) {
    console.warn(`[addDoc API fallback on ${colRef.name}]:`, err);
  }

  return itemWithId;
}

export async function updateDoc(docRef: DocRef, data: any): Promise<void> {
  const colKey = docRef.collection.toLowerCase();
  const updatePayload = { ...data, updatedAt: new Date().toISOString() };

  // Optimistic local update
  broadcastLocalEvent(docRef.collection, 'update', updatePayload, docRef.id);

  try {
    const res = await fetch(`/api/data/${docRef.collection}/${docRef.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updatePayload)
    });
    if (res.ok) {
      const result = await res.json();
      broadcastLocalEvent(docRef.collection, 'update', result, docRef.id);
    }
  } catch (err) {
    console.warn(`[updateDoc API fallback on ${docRef.collection}/${docRef.id}]:`, err);
  }
}

export async function setDoc(docRef: DocRef, data: any, _options?: { merge?: boolean }): Promise<void> {
  const fullData = { id: docRef.id, ...data, updatedAt: new Date().toISOString() };

  // Optimistic local update
  broadcastLocalEvent(docRef.collection, 'update', fullData, docRef.id);

  try {
    const res = await fetch(`/api/data/${docRef.collection}/${docRef.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(fullData)
    });
    if (res.ok) {
      const result = await res.json();
      broadcastLocalEvent(docRef.collection, 'update', result, docRef.id);
    }
  } catch (err) {
    console.warn(`[setDoc API fallback on ${docRef.collection}/${docRef.id}]:`, err);
  }
}

export async function deleteDoc(docRef: DocRef): Promise<void> {
  // Optimistic local delete
  broadcastLocalEvent(docRef.collection, 'delete', { id: docRef.id }, docRef.id);

  try {
    await fetch(`/api/data/${docRef.collection}/${docRef.id}`, {
      method: 'DELETE'
    });
  } catch (err) {
    console.warn(`[deleteDoc API fallback on ${docRef.collection}/${docRef.id}]:`, err);
  }
}

// Real-time listener: onSnapshot with SSE + Polling Fallback
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

    // Polling fallback
    const pollInterval = setInterval(() => {
      if (!isActive) return;
      getDoc(docTarget)
        .then(snap => {
          if (isActive) onNext(snap);
        })
        .catch(() => {});
    }, 5000);

    return () => {
      isActive = false;
      clearInterval(pollInterval);
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

  // Polling fallback
  const pollInterval = setInterval(() => {
    if (!isActive) return;
    getDocs(colTarget)
      .then(snap => {
        if (isActive) onNext(snap);
      })
      .catch(() => {});
  }, 4000);

  return () => {
    isActive = false;
    clearInterval(pollInterval);
    sseListeners.delete(sseListener);
  };
}
