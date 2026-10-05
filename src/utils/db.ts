import { PageSize, OutlineItem, PdfMetadata, PdfCacheData } from '../types';

const DB_VERSION = 2;

export async function savePdfToDb(name: string, buffer: ArrayBuffer): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('rapture_db', DB_VERSION);
    request.onupgradeneeded = (e) => {
      const db = request.result;
      if (!db.objectStoreNames.contains('pdf_store')) {
        db.createObjectStore('pdf_store');
      }
      if (!db.objectStoreNames.contains('pdf_cache')) {
        db.createObjectStore('pdf_cache');
      }
    };
    request.onsuccess = () => {
      const db = request.result;
      const tx = db.transaction('pdf_store', 'readwrite');
      const store = tx.objectStore('pdf_store');
      store.put(buffer, name);
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => reject(tx.error);
    };
    request.onerror = () => reject(request.error);
  });
}

export async function getPdfFromDb(name: string): Promise<ArrayBuffer | null> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('rapture_db', DB_VERSION);
    request.onupgradeneeded = (e) => {
      const db = request.result;
      if (!db.objectStoreNames.contains('pdf_store')) {
        db.createObjectStore('pdf_store');
      }
      if (!db.objectStoreNames.contains('pdf_cache')) {
        db.createObjectStore('pdf_cache');
      }
    };
    request.onsuccess = () => {
      const db = request.result;
      const tx = db.transaction('pdf_store', 'readonly');
      const store = tx.objectStore('pdf_store');
      const getReq = store.get(name);
      getReq.onsuccess = () => {
        db.close();
        resolve(getReq.result || null);
      };
      getReq.onerror = () => reject(getReq.error);
    };
    request.onerror = () => reject(request.error);
  });
}

export async function savePdfCacheToDb(name: string, cache: PdfCacheData): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('rapture_db', DB_VERSION);
    request.onupgradeneeded = (e) => {
      const db = request.result;
      if (!db.objectStoreNames.contains('pdf_store')) {
        db.createObjectStore('pdf_store');
      }
      if (!db.objectStoreNames.contains('pdf_cache')) {
        db.createObjectStore('pdf_cache');
      }
    };
    request.onsuccess = () => {
      const db = request.result;
      const tx = db.transaction('pdf_cache', 'readwrite');
      const store = tx.objectStore('pdf_cache');
      store.put(cache, name);
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => reject(tx.error);
    };
    request.onerror = () => reject(request.error);
  });
}

export async function getPdfCacheFromDb(name: string): Promise<PdfCacheData | null> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('rapture_db', DB_VERSION);
    request.onupgradeneeded = (e) => {
      const db = request.result;
      if (!db.objectStoreNames.contains('pdf_store')) {
        db.createObjectStore('pdf_store');
      }
      if (!db.objectStoreNames.contains('pdf_cache')) {
        db.createObjectStore('pdf_cache');
      }
    };
    request.onsuccess = () => {
      const db = request.result;
      const tx = db.transaction('pdf_cache', 'readonly');
      const store = tx.objectStore('pdf_cache');
      const getReq = store.get(name);
      getReq.onsuccess = () => {
        db.close();
        resolve(getReq.result || null);
      };
      getReq.onerror = () => reject(getReq.error);
    };
    request.onerror = () => reject(request.error);
  });
}

export async function deletePdfFromDb(name: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('rapture_db', DB_VERSION);
    request.onupgradeneeded = (e) => {
      const db = request.result;
      if (!db.objectStoreNames.contains('pdf_store')) {
        db.createObjectStore('pdf_store');
      }
      if (!db.objectStoreNames.contains('pdf_cache')) {
        db.createObjectStore('pdf_cache');
      }
    };
    request.onsuccess = () => {
      const db = request.result;
      const tx = db.transaction(['pdf_store', 'pdf_cache'], 'readwrite');
      
      const pdfStore = tx.objectStore('pdf_store');
      const cacheStore = tx.objectStore('pdf_cache');
      
      pdfStore.delete(name);
      cacheStore.delete(name);
      
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => reject(tx.error);
    };
    request.onerror = () => reject(request.error);
  });
}
