let isSyncing = false;
let syncQueue = [];

async function loadBarangData() {
  try {
    if (isOnline()) {
      const onlineData = await loadBarangOnline();
      saveBarangCache(onlineData);
      return onlineData;
    } else {
      const cacheData = loadBarangCache();
      return cacheData;
    }
  } catch (error) {
    return loadBarangCache();
  }
}

async function loadTransaksiData() {
  try {
    if (isOnline()) {
      const onlineData = await loadTransaksiOnline();
      saveTransaksiCache(onlineData);
      return onlineData;
    } else {
      const cacheData = loadTransaksiCache();
      return cacheData;
    }
  } catch (error) {
    return loadTransaksiCache();
  }
}

async function loadDepositData() {
  try {
    if (isOnline()) {
      const onlineData = await loadDepositOnline();
      saveDepositCache(onlineData);
      return onlineData;
    } else {
      const cacheData = loadDepositCache();
      return cacheData;
    }
  } catch (error) {
    return loadDepositCache();
  }
}

async function saveBarangData(data) {
  const dataArray = Array.isArray(data) ? data : [data];
  
  const cacheUpdated = updateBarangCache(dataArray);
  
  if (isOnline()) {
    try {
      const result = await saveBarangOnline(dataArray);
      return result;
    } catch (error) {
      const pendingAdded = addPendingBarang(dataArray);
      
      return { 
        success: false, 
        offline: true, 
        message: "Saved to pending (online save failed)" 
      };
    }
  } else {
    const pendingAdded = addPendingBarang(dataArray);
    
    const pending = getPendingBarang();
    
    return { 
      success: true, 
      offline: true, 
      message: "Data saved to cache and pending queue" 
    };
  }
}

async function saveTransaksiData(transaksi, detailData = []) {
  const transaksiArray = Array.isArray(transaksi) ? transaksi : [transaksi];
  
  updateTransaksiCache(transaksiArray);
  
  if (isOnline()) {
    try {
      const result = await saveTransaksiOnline(transaksiArray, detailData);
      return result;
    } catch (error) {
      addPendingTransaksi(transaksiArray, detailData);
      return { 
        success: false, 
        offline: true, 
        message: "Saved to pending (online save failed)" 
      };
    }
  } else {
    addPendingTransaksi(transaksiArray, detailData);
    const pending = getPendingTransaksi();
    return { 
      success: true, 
      offline: true, 
      message: "Transaksi saved to pending" 
    };
  }
}

async function saveDeposit(data) {
  const dataArray = Array.isArray(data) ? data : [data];
  
  updateDepositCache(dataArray);
  
  if (isOnline()) {
    try {
      const result = await saveDepositOnline(dataArray);
      return result;
    } catch (error) {
      addPendingDeposit(dataArray);
      return { 
        success: false, 
        offline: true, 
        message: "Deposit saved to pending" 
      };
    }
  } else {
    addPendingDeposit(dataArray);
    return { 
      success: true, 
      offline: true, 
      message: "Deposit saved to pending" 
    };
  }
}

async function deleteEmptyBatch(idBarang, tanggalBatch, jenisTransaksi = "Penambahan Stok Lama") {
  if (isOnline()) {
    try {
      const result = await deleteEmptyBatchOnline(idBarang, tanggalBatch, jenisTransaksi);
      
      const currentCache = loadBarangCache();
      const updatedCache = currentCache.filter(b => {
        if (b.id === idBarang && b.jenisTransaksi === jenisTransaksi) {
          const batchDate = formatDateToYYYYMMDD(b.tanggal);
          const searchDate = formatDateToYYYYMMDD(tanggalBatch);
          return batchDate !== searchDate;
        }
        return true;
      });
      
      saveBarangCache(updatedCache);
      
      return result;
    } catch (error) {
      addPendingDelete({
        type: "deleteEmptyBatch",
        idBarang: idBarang,
        tanggalBatch: tanggalBatch,
        jenisTransaksi: jenisTransaksi
      });
      
      return { 
        success: false, 
        offline: true, 
        message: "Delete batch saved to pending" 
      };
    }
  } else {
    addPendingDelete({
      type: "deleteEmptyBatch",
      idBarang: idBarang,
      tanggalBatch: tanggalBatch,
      jenisTransaksi: jenisTransaksi
    });
    return { 
      success: true, 
      offline: true, 
      message: "Delete batch saved to pending" 
    };
  }
}

async function updateDetailTransaksi(idTrans, updatedItems) {
  if (isOnline()) {
    try {
      const result = await updateDetailTransaksiOnline(idTrans, updatedItems);
      return result;
    } catch (error) {
      throw error;
    }
  } else {
    throw new Error("Offline: Update detail transaksi memerlukan koneksi online");
  }
}

async function syncPendingData() {
  if (isSyncing) {
    return { success: false, message: "Sinkronisasi sedang berlangsung" };
  }
  
  if (!isOnline()) {
    return { success: false, message: "Tidak ada koneksi internet" };
  }
  
  if (!hasPendingChanges()) {
    return { success: true, message: "Tidak ada data pending untuk disinkronkan" };
  }
  
  isSyncing = true;
  
  const results = {
    barang: { success: 0, failed: 0, details: [] },
    transaksi: { success: 0, failed: 0, details: [] },
    deposit: { success: 0, failed: 0 },
    delete: { success: 0, failed: 0 }
  };
  
  try {
    const pendingBarang = getPendingBarang();
    
    if (pendingBarang.length > 0) {
      const groupedByItem = {};
      pendingBarang.forEach(barang => {
        const key = barang.jenisTransaksi === "Penambahan Stok Lama" 
          ? `${barang.id}_${barang.jenisTransaksi}_${barang.tanggal}`
          : `${barang.id}_${barang.jenisTransaksi}`;
        
        if (!groupedByItem[key]) {
          groupedByItem[key] = [];
        }
        groupedByItem[key].push(barang);
      });
      
      for (const [key, items] of Object.entries(groupedByItem)) {
        try {
          const latestItem = items.reduce((latest, current) => {
            return (current.timestamp || 0) > (latest.timestamp || 0) ? current : latest;
          });
          
          const saveResult = await saveBarangOnline([latestItem]);
          
          if (saveResult.success) {
            results.barang.success++;
            results.barang.details.push(`${latestItem.id} ✅`);
          } else {
            throw new Error(saveResult.message || "Save failed");
          }
        } catch (error) {
          results.barang.failed++;
          results.barang.details.push(`${items[0].id} ❌: ${error.message}`);
        }
      }
      
      if (results.barang.failed === 0) {
        clearPendingBarang();
      }
    }
    
    const pendingTransaksi = getPendingTransaksi();
    
    if (pendingTransaksi.length > 0) {
      for (const item of pendingTransaksi) {
        try {
          await saveTransaksiOnline([item.transaksi], item.detailData);
          results.transaksi.success++;
          results.transaksi.details.push(`${item.transaksi.id} ✅`);
        } catch (error) {
          results.transaksi.failed++;
          results.transaksi.details.push(`${item.transaksi.id} ❌: ${error.message}`);
        }
      }
      
      if (results.transaksi.failed === 0) {
        clearPendingTransaksi();
      }
    }
    
    const pendingDeposit = getPendingDeposit();
    
    if (pendingDeposit.length > 0) {
      for (const deposit of pendingDeposit) {
        try {
          await saveDepositOnline([deposit]);
          results.deposit.success++;
        } catch (error) {
          results.deposit.failed++;
        }
      }
      
      if (results.deposit.failed === 0) {
        clearPendingDeposit();
      }
    }
    
    const pendingDelete = getPendingDelete();
    
    if (pendingDelete.length > 0) {
      for (const deleteInfo of pendingDelete) {
        try {
          if (deleteInfo.type === "deleteEmptyBatch") {
            await deleteEmptyBatchOnline(
              deleteInfo.idBarang,
              deleteInfo.tanggalBatch,
              deleteInfo.jenisTransaksi
            );
            results.delete.success++;
          }
        } catch (error) {
          results.delete.failed++;
        }
      }
      
      if (results.delete.failed === 0) {
        clearPendingDelete();
      }
    }
    
    if (results.barang.failed === 0 && 
        results.transaksi.failed === 0 && 
        results.deposit.failed === 0 &&
        results.delete.failed === 0) {
      
      updateLastSync();
      
      try {
        const [barang, transaksi, deposit] = await Promise.all([
          loadBarangOnline(),
          loadTransaksiOnline(),
          loadDepositOnline()
        ]);
        
        saveBarangCache(barang);
        saveTransaksiCache(transaksi);
        saveDepositCache(deposit);
      } catch (error) {
      }
    }
    
    return {
      success: true,
      message: "Sinkronisasi selesai",
      results: results
    };
    
  } catch (error) {
    return {
      success: false,
      message: "Gagal melakukan sinkronisasi: " + error.message,
      results: results
    };
  } finally {
    isSyncing = false;
  }
}

function autoSync() {
  if (isOnline() && hasPendingChanges() && !isSyncing) {
    syncPendingData().then((result) => {
      if (result.success) {
        window.dispatchEvent(new CustomEvent("dataSynced", { detail: result }));
      }
    });
  }
}

window.addEventListener("online", () => {
  setTimeout(() => {
    autoSync();
  }, 2000);
});

setInterval(() => {
  if (isOnline() && hasPendingChanges()) {
    autoSync();
  }
}, 60000);

function debugPendingData() {
  const pendingBarang = getPendingBarang();
  const pendingTransaksi = getPendingTransaksi();
  const pendingDeposit = getPendingDeposit();
  const pendingDelete = getPendingDelete();
  
  return {
    barang: pendingBarang.length,
    transaksi: pendingTransaksi.length,
    deposit: pendingDeposit.length,
    delete: pendingDelete.length,
    hasPending: hasPendingChanges(),
    isOnline: isOnline()
  };
}

window.debugPendingData = debugPendingData;
window.forceSyncNow = syncPendingData;