const CACHE_KEYS = {
  BARANG: "cache_barang_v1",
  TRANSAKSI: "cache_transaksi_v1",
  DEPOSIT: "cache_deposit_v1",
  PENDING_BARANG: "cache_pending_barang_v1",
  PENDING_TRANSAKSI: "cache_pending_transaksi_v1",
  PENDING_DEPOSIT: "cache_pending_deposit_v1",
  PENDING_DELETE: "cache_pending_delete_v1",
  LAST_SYNC: "cache_last_sync_v1",
};

function getCacheStorage() {
  try {
    return window.localStorage;
  } catch (error) {
    return null;
  }
}

function saveToCache(key, data) {
  try {
    const storage = getCacheStorage();
    if (!storage) return false;
    
    const jsonData = JSON.stringify(data);
    storage.setItem(key, jsonData);
    return true;
  } catch (error) {
    return false;
  }
}

function getFromCache(key) {
  try {
    const storage = getCacheStorage();
    if (!storage) return null;
    
    const jsonData = storage.getItem(key);
    if (!jsonData) return null;
    
    return JSON.parse(jsonData);
  } catch (error) {
    return null;
  }
}

function removeFromCache(key) {
  try {
    const storage = getCacheStorage();
    if (!storage) return false;
    
    storage.removeItem(key);
    return true;
  } catch (error) {
    return false;
  }
}

function saveBarangCache(barangData) {
  return saveToCache(CACHE_KEYS.BARANG, barangData);
}

function loadBarangCache() {
  return getFromCache(CACHE_KEYS.BARANG) || [];
}

function saveTransaksiCache(transaksiData) {
  return saveToCache(CACHE_KEYS.TRANSAKSI, transaksiData);
}

function loadTransaksiCache() {
  return getFromCache(CACHE_KEYS.TRANSAKSI) || [];
}

function saveDepositCache(depositData) {
  return saveToCache(CACHE_KEYS.DEPOSIT, depositData);
}

function loadDepositCache() {
  return getFromCache(CACHE_KEYS.DEPOSIT) || [];
}

function formatDateToYYYYMMDD(dateInput) {
  if (!dateInput) return "";
  if (typeof dateInput === "string") {
    const match = dateInput.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) return `${match[1]}-${match[2]}-${match[3]}`;
  }
  const date = dateInput instanceof Date ? dateInput : new Date(dateInput);
  if (isNaN(date.getTime())) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function updateBarangCache(barangArray) {
  const currentCache = loadBarangCache();
  const dataArray = Array.isArray(barangArray) ? barangArray : [barangArray];
  
  dataArray.forEach((newBarang) => {
    const existingIndex = currentCache.findIndex((item) => {
      const matchId = item.id === newBarang.id;
      const matchJenis = item.jenisTransaksi === newBarang.jenisTransaksi;
      
      if (newBarang.jenisTransaksi === "Penambahan Stok Lama") {
        const itemDate = formatDateToYYYYMMDD(item.tanggal);
        const newDate = formatDateToYYYYMMDD(newBarang.tanggal);
        return matchId && matchJenis && itemDate === newDate;
      }
      
      return matchId && matchJenis;
    });
    
    if (existingIndex !== -1) {
      currentCache[existingIndex] = { ...newBarang };
    } else {
      currentCache.push({ ...newBarang });
    }
  });
  
  const saved = saveBarangCache(currentCache);
  
  return saved;
}

function addPendingBarang(barangData) {
  const pending = getFromCache(CACHE_KEYS.PENDING_BARANG) || [];
  const dataArray = Array.isArray(barangData) ? barangData : [barangData];
  
  dataArray.forEach((item) => {
    const existingIndex = pending.findIndex((p) => {
      const matchId = p.id === item.id;
      const matchJenis = p.jenisTransaksi === item.jenisTransaksi;
      
      if (item.jenisTransaksi === "Penambahan Stok Lama") {
        const pDate = formatDateToYYYYMMDD(p.tanggal);
        const itemDate = formatDateToYYYYMMDD(item.tanggal);
        return matchId && matchJenis && pDate === itemDate;
      }
      
      return matchId && matchJenis;
    });
    
    if (existingIndex !== -1) {
      pending[existingIndex] = { ...item, timestamp: Date.now() };
    } else {
      pending.push({ ...item, timestamp: Date.now() });
    }
  });
  
  return saveToCache(CACHE_KEYS.PENDING_BARANG, pending);
}

function getPendingBarang() {
  return getFromCache(CACHE_KEYS.PENDING_BARANG) || [];
}

function clearPendingBarang() {
  return removeFromCache(CACHE_KEYS.PENDING_BARANG);
}

function addPendingTransaksi(transaksiData, detailData = []) {
  const pending = getFromCache(CACHE_KEYS.PENDING_TRANSAKSI) || [];
  
  const transaksiArray = Array.isArray(transaksiData) ? transaksiData : [transaksiData];
  
  transaksiArray.forEach((trans) => {
    const existingIndex = pending.findIndex((p) => p.id === trans.id);
    
    const pendingItem = {
      transaksi: trans,
      detailData: detailData.filter((d) => d.idTrans === trans.id),
      timestamp: Date.now()
    };
    
    if (existingIndex !== -1) {
      pending[existingIndex] = pendingItem;
    } else {
      pending.push(pendingItem);
    }
  });
  
  return saveToCache(CACHE_KEYS.PENDING_TRANSAKSI, pending);
}

function getPendingTransaksi() {
  return getFromCache(CACHE_KEYS.PENDING_TRANSAKSI) || [];
}

function clearPendingTransaksi() {
  return removeFromCache(CACHE_KEYS.PENDING_TRANSAKSI);
}

function addPendingDeposit(depositData) {
  const pending = getFromCache(CACHE_KEYS.PENDING_DEPOSIT) || [];
  const dataArray = Array.isArray(depositData) ? depositData : [depositData];
  
  dataArray.forEach((item) => {
    pending.push({ ...item, timestamp: Date.now() });
  });
  
  return saveToCache(CACHE_KEYS.PENDING_DEPOSIT, pending);
}

function getPendingDeposit() {
  return getFromCache(CACHE_KEYS.PENDING_DEPOSIT) || [];
}

function clearPendingDeposit() {
  return removeFromCache(CACHE_KEYS.PENDING_DEPOSIT);
}

function addPendingDelete(deleteInfo) {
  const pending = getFromCache(CACHE_KEYS.PENDING_DELETE) || [];
  pending.push({ ...deleteInfo, timestamp: Date.now() });
  return saveToCache(CACHE_KEYS.PENDING_DELETE, pending);
}

function getPendingDelete() {
  return getFromCache(CACHE_KEYS.PENDING_DELETE) || [];
}

function clearPendingDelete() {
  return removeFromCache(CACHE_KEYS.PENDING_DELETE);
}

function updateLastSync() {
  const syncInfo = {
    timestamp: Date.now(),
    datetime: getNowWIB()
  };
  return saveToCache(CACHE_KEYS.LAST_SYNC, syncInfo);
}

function getLastSync() {
  return getFromCache(CACHE_KEYS.LAST_SYNC);
}

function updateTransaksiCache(transaksiArray) {
  const currentCache = loadTransaksiCache();
  const dataArray = Array.isArray(transaksiArray) ? transaksiArray : [transaksiArray];
  
  dataArray.forEach((newTrans) => {
    const existingIndex = currentCache.findIndex((item) => item.id === newTrans.id);
    
    if (existingIndex !== -1) {
      currentCache[existingIndex] = newTrans;
    } else {
      currentCache.push(newTrans);
    }
  });
  
  return saveTransaksiCache(currentCache);
}

function updateDepositCache(depositArray) {
  const currentCache = loadDepositCache();
  const dataArray = Array.isArray(depositArray) ? depositArray : [depositArray];
  
  dataArray.forEach((newDeposit) => {
    currentCache.push(newDeposit);
  });
  
  return saveDepositCache(currentCache);
}

function hasPendingChanges() {
  const pendingBarang = getPendingBarang();
  const pendingTransaksi = getPendingTransaksi();
  const pendingDeposit = getPendingDeposit();
  const pendingDelete = getPendingDelete();
  
  return pendingBarang.length > 0 || 
         pendingTransaksi.length > 0 || 
         pendingDeposit.length > 0 ||
         pendingDelete.length > 0;
}

function clearAllCache() {
  removeFromCache(CACHE_KEYS.BARANG);
  removeFromCache(CACHE_KEYS.TRANSAKSI);
  removeFromCache(CACHE_KEYS.DEPOSIT);
  removeFromCache(CACHE_KEYS.PENDING_BARANG);
  removeFromCache(CACHE_KEYS.PENDING_TRANSAKSI);
  removeFromCache(CACHE_KEYS.PENDING_DEPOSIT);
  removeFromCache(CACHE_KEYS.PENDING_DELETE);
  removeFromCache(CACHE_KEYS.LAST_SYNC);
}