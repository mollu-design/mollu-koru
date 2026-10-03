/**
 * IndexedDB 封装：为 mollu-koru 提供异步 KV 存储。
 * 使用独立的数据库名称（koru-store）避免与 webtopo 冲突。
 */

const DB_NAME = 'koru-store'
const STORE_NAME = 'kv'
const DB_VERSION = 1

let dbPromise: Promise<IDBDatabase> | null = null
/** 保持对数据库实例的强引用，防止 GC 回收连接 */
let dbInstance: IDBDatabase | null = null

/** 获取或初始化数据库连接（缓存在模块级变量中，保持强引用） */
const getDB = (): Promise<IDBDatabase> => {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME)
      }
    }
    request.onsuccess = () => {
      dbInstance = request.result
      // 连接意外关闭（如版本变更）时，清除缓存以自动重连
      dbInstance.onclose = () => {
        dbPromise = null
        dbInstance = null
      }
      resolve(dbInstance)
    }
    request.onerror = () => reject(request.error)
  })
  return dbPromise
}

/** 读取 key 对应的值 */
export async function dbGet(key: string): Promise<string | null> {
  try {
    const db = await getDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly')
      const store = tx.objectStore(STORE_NAME)
      const req = store.get(key)
      req.onsuccess = () => resolve(req.result ?? null)
      req.onerror = () => reject(req.error)
    })
  } catch {
    return null
  }
}

/** 写入 key-value */
export async function dbSet(key: string, value: string): Promise<boolean> {
  try {
    const db = await getDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      const store = tx.objectStore(STORE_NAME)
      const req = store.put(value, key)
      req.onsuccess = () => resolve(true)
      req.onerror = () => reject(req.error)
    })
  } catch {
    return false
  }
}

/** 删除 key */
export async function dbRemove(key: string): Promise<boolean> {
  try {
    const db = await getDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      const store = tx.objectStore(STORE_NAME)
      const req = store.delete(key)
      req.onsuccess = () => resolve(true)
      req.onerror = () => reject(req.error)
    })
  } catch {
    return false
  }
}
