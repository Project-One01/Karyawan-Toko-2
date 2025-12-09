// ============================================
// save_global.js - COMPLETE CODE
// ============================================

let isSyncing = false;
let syncQueue = [];

// ============================================
// LOAD FUNCTIONS
// ============================================

async function loadBarangData() {
  try {
    if (isOnline()) {
      console.log("📥 Loading barang from server...");
      const onlineData = await loadBarangOnline();
      saveBarangCache(onlineData);
      console.log("✅ Barang loaded from server:", onlineData.length, "items");
      return onlineData;
    } else {
      console.log("📱 Loading barang from cache (offline)...");
      const cacheData = loadBarangCache();
      console.log("✅ Barang loaded from cache:", cacheData.length, "items");
      return cacheData;
    }
  } catch (error) {
    console.warn("⚠️ Failed to load barang from server, using cache:", error.message);
    return loadBarangCache();
  }
}

async function loadTransaksiData() {
  try {
    if (isOnline()) {
      console.log("📥 Loading transaksi from server...");
      const onlineData = await loadTransaksiOnline();
      saveTransaksiCache(onlineData);
      console.log("✅ Transaksi loaded from server:", onlineData.length, "items");
      return onlineData;
    } else {
      console.log("📱 Loading transaksi from cache (offline)...");
      const cacheData = loadTransaksiCache();
      console.log("✅ Transaksi loaded from cache:", cacheData.length, "items");
      return cacheData;
    }
  } catch (error) {
    console.warn("⚠️ Failed to load transaksi from server, using cache:", error.message);
    return loadTransaksiCache();
  }
}

async function loadDepositData() {
  try {
    if (isOnline()) {
      console.log("📥 Loading deposit from server...");
      const onlineData = await loadDepositOnline();
      saveDepositCache(onlineData);
      console.log("✅ Deposit loaded from server:", onlineData.length, "items");
      return onlineData;
    } else {
      console.log("📱 Loading deposit from cache (offline)...");
      const cacheData = loadDepositCache();
      console.log("✅ Deposit loaded from cache:", cacheData.length, "items");
      return cacheData;
    }
  } catch (error) {
    console.warn("⚠️ Failed to load deposit from server, using cache:", error.message);
    return loadDepositCache();
  }
}

// ============================================
// SAVE FUNCTIONS - CRITICAL FIX
// ============================================

async function saveBarangData(data) {
  const dataArray = Array.isArray(data) ? data : [data];
  
  console.log("\n📊 saveBarangData called with", dataArray.length, "items");
  console.log("🌐 Online status:", isOnline());
  
  // Log detail stok
  dataArray.forEach(item => {
    console.log(`   ${item.id}: BM1=${item.stokBM1}, BM2=${item.stokBM2}, Jenis=${item.jenisTransaksi}`);
  });
  
  // ✅ STEP 1: Update cache SEGERA (offline/online)
  const cacheUpdated = updateBarangCache(dataArray);
  console.log("💾 Cache updated:", cacheUpdated ? "SUCCESS" : "FAILED");
  
  if (isOnline()) {
    // ONLINE MODE
    try {
      console.log("🌐 Attempting online save to Google Sheets...");
      const result = await saveBarangOnline(dataArray);
      console.log("✅ Online save SUCCESS");
      return result;
    } catch (error) {
      console.error("❌ Online save FAILED:", error.message);
      // ✅ FALLBACK: Masukkan ke pending
      const pendingAdded = addPendingBarang(dataArray);
      console.log("📥 Added to pending:", pendingAdded ? "SUCCESS" : "FAILED");
      
      // ✅ JANGAN throw error - return object
      return { 
        success: false, 
        offline: true, 
        message: "Saved to pending (online save failed)" 
      };
    }
  } else {
    // OFFLINE MODE
    console.log("📱 OFFLINE MODE - Adding to pending queue");
    
    // ✅ STEP 2: Masukkan ke pending queue
    const pendingAdded = addPendingBarang(dataArray);
    console.log("📥 Added to pending:", pendingAdded ? "SUCCESS" : "FAILED");
    
    // ✅ Verify pending
    const pending = getPendingBarang();
    console.log("📋 Total pending barang:", pending.length);
    
    // ✅ JANGAN throw error - return success object
    return { 
      success: true, 
      offline: true, 
      message: "Data saved to cache and pending queue" 
    };
  }
}

async function saveTransaksiData(transaksi, detailData = []) {
  const transaksiArray = Array.isArray(transaksi) ? transaksi : [transaksi];
  
  console.log("\n💰 saveTransaksiData called with", transaksiArray.length, "transactions");
  console.log("🌐 Online status:", isOnline());
  
  // Update cache
  updateTransaksiCache(transaksiArray);
  console.log("💾 Transaksi cache updated");
  
  if (isOnline()) {
    try {
      console.log("🌐 Attempting online save to Google Sheets...");
      const result = await saveTransaksiOnline(transaksiArray, detailData);
      console.log("✅ Transaksi online save SUCCESS");
      return result;
    } catch (error) {
      console.error("❌ Transaksi online save FAILED:", error.message);
      addPendingTransaksi(transaksiArray, detailData);
      console.log("📥 Added to pending transaksi");
      return { 
        success: false, 
        offline: true, 
        message: "Saved to pending (online save failed)" 
      };
    }
  } else {
    console.log("📱 OFFLINE MODE - Adding transaksi to pending");
    addPendingTransaksi(transaksiArray, detailData);
    const pending = getPendingTransaksi();
    console.log("📋 Total pending transaksi:", pending.length);
    return { 
      success: true, 
      offline: true, 
      message: "Transaksi saved to pending" 
    };
  }
}

async function saveDeposit(data) {
  const dataArray = Array.isArray(data) ? data : [data];
  
  console.log("\n💳 saveDeposit called with", dataArray.length, "items");
  updateDepositCache(dataArray);
  
  if (isOnline()) {
    try {
      const result = await saveDepositOnline(dataArray);
      console.log("✅ Deposit online save SUCCESS");
      return result;
    } catch (error) {
      console.error("❌ Deposit online save FAILED:", error.message);
      addPendingDeposit(dataArray);
      return { 
        success: false, 
        offline: true, 
        message: "Deposit saved to pending" 
      };
    }
  } else {
    console.log("📱 OFFLINE MODE - Adding deposit to pending");
    addPendingDeposit(dataArray);
    return { 
      success: true, 
      offline: true, 
      message: "Deposit saved to pending" 
    };
  }
}

async function deleteEmptyBatch(idBarang, tanggalBatch, jenisTransaksi = "Penambahan Stok Lama") {
  console.log(`\n🗑️ deleteEmptyBatch: ${idBarang}, ${tanggalBatch}`);
  
  if (isOnline()) {
    try {
      const result = await deleteEmptyBatchOnline(idBarang, tanggalBatch, jenisTransaksi);
      console.log("✅ Batch deleted online");
      return result;
    } catch (error) {
      console.error("❌ Delete batch failed:", error.message);
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
    console.log("📱 OFFLINE MODE - Adding delete to pending");
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

// ============================================
// SYNC PENDING DATA - COMPLETE REWRITE
// ============================================

async function syncPendingData() {
  if (isSyncing) {
    console.warn("⚠️ Sync already in progress, skipping...");
    return { success: false, message: "Sinkronisasi sedang berlangsung" };
  }
  
  if (!isOnline()) {
    console.warn("⚠️ Cannot sync - offline");
    return { success: false, message: "Tidak ada koneksi internet" };
  }
  
  if (!hasPendingChanges()) {
    console.log("✅ No pending changes to sync");
    return { success: true, message: "Tidak ada data pending untuk disinkronkan" };
  }
  
  console.log("\n🔄 ====== STARTING SYNC PROCESS ======");
  isSyncing = true;
  
  const results = {
    barang: { success: 0, failed: 0, details: [] },
    transaksi: { success: 0, failed: 0, details: [] },
    deposit: { success: 0, failed: 0 },
    delete: { success: 0, failed: 0 }
  };
  
  try {
    // ============================================
    // STEP 1: SYNC BARANG (STOCK) - PRIORITY #1
    // ============================================
    const pendingBarang = getPendingBarang();
    console.log(`\n📦 STEP 1: Syncing ${pendingBarang.length} pending barang...`);
    
    if (pendingBarang.length > 0) {
      // Log detail setiap pending item
      pendingBarang.forEach((item, idx) => {
        console.log(`   [${idx + 1}] ${item.id} - BM1:${item.stokBM1}, BM2:${item.stokBM2}, Jenis:${item.jenisTransaksi}`);
      });
      
      // Group by unique identifier
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
      
      console.log(`   📊 Grouped into ${Object.keys(groupedByItem).length} unique items`);
      
      // Sync per item group
      for (const [key, items] of Object.entries(groupedByItem)) {
        try {
          // Ambil item dengan timestamp terbaru
          const latestItem = items.reduce((latest, current) => {
            return (current.timestamp || 0) > (latest.timestamp || 0) ? current : latest;
          });
          
          console.log(`\n   🔄 Syncing ${latestItem.id}...`);
          console.log(`      Stock: BM1=${latestItem.stokBM1}, BM2=${latestItem.stokBM2}`);
          
          // Save to Google Sheets
          const saveResult = await saveBarangOnline([latestItem]);
          
          if (saveResult.success) {
            results.barang.success++;
            results.barang.details.push(`${latestItem.id} ✅`);
            console.log(`      ✅ SUCCESS`);
          } else {
            throw new Error(saveResult.message || "Save failed");
          }
        } catch (error) {
          results.barang.failed++;
          results.barang.details.push(`${items[0].id} ❌: ${error.message}`);
          console.error(`      ❌ FAILED:`, error.message);
        }
      }
      
      // Clear pending HANYA jika SEMUA berhasil
      if (results.barang.failed === 0) {
        clearPendingBarang();
        console.log(`\n   ✅ All ${results.barang.success} barang synced successfully`);
        console.log(`   🗑️ Pending barang queue cleared`);
      } else {
        console.log(`\n   ⚠️ ${results.barang.failed} barang failed to sync, keeping in queue`);
      }
    } else {
      console.log("   ℹ️ No pending barang to sync");
    }
    
    // ============================================
    // STEP 2: SYNC TRANSAKSI
    // ============================================
    const pendingTransaksi = getPendingTransaksi();
    console.log(`\n💰 STEP 2: Syncing ${pendingTransaksi.length} pending transaksi...`);
    
    if (pendingTransaksi.length > 0) {
      for (const item of pendingTransaksi) {
        try {
          console.log(`   🔄 Syncing transaksi ID ${item.transaksi.id}...`);
          await saveTransaksiOnline([item.transaksi], item.detailData);
          results.transaksi.success++;
          results.transaksi.details.push(`${item.transaksi.id} ✅`);
          console.log(`      ✅ SUCCESS`);
        } catch (error) {
          results.transaksi.failed++;
          results.transaksi.details.push(`${item.transaksi.id} ❌: ${error.message}`);
          console.error(`      ❌ FAILED:`, error.message);
        }
      }
      
      if (results.transaksi.failed === 0) {
        clearPendingTransaksi();
        console.log(`\n   ✅ All ${results.transaksi.success} transaksi synced`);
        console.log(`   🗑️ Pending transaksi queue cleared`);
      } else {
        console.log(`\n   ⚠️ ${results.transaksi.failed} transaksi failed, keeping in queue`);
      }
    } else {
      console.log("   ℹ️ No pending transaksi to sync");
    }
    
    // ============================================
    // STEP 3: SYNC DEPOSIT
    // ============================================
    const pendingDeposit = getPendingDeposit();
    console.log(`\n💳 STEP 3: Syncing ${pendingDeposit.length} pending deposit...`);
    
    if (pendingDeposit.length > 0) {
      for (const deposit of pendingDeposit) {
        try {
          await saveDepositOnline([deposit]);
          results.deposit.success++;
          console.log(`   ✅ Deposit synced`);
        } catch (error) {
          results.deposit.failed++;
          console.error(`   ❌ Deposit failed:`, error.message);
        }
      }
      
      if (results.deposit.failed === 0) {
        clearPendingDeposit();
        console.log(`\n   ✅ All deposit synced`);
      }
    } else {
      console.log("   ℹ️ No pending deposit to sync");
    }
    
    // ============================================
    // STEP 4: SYNC DELETE
    // ============================================
    const pendingDelete = getPendingDelete();
    console.log(`\n🗑️ STEP 4: Syncing ${pendingDelete.length} pending deletes...`);
    
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
            console.log(`   ✅ Batch deleted`);
          }
        } catch (error) {
          results.delete.failed++;
          console.error(`   ❌ Delete failed:`, error.message);
        }
      }
      
      if (results.delete.failed === 0) {
        clearPendingDelete();
        console.log(`\n   ✅ All deletes completed`);
      }
    } else {
      console.log("   ℹ️ No pending deletes to sync");
    }
    
    // ============================================
    // STEP 5: RELOAD DATA JIKA SEMUA BERHASIL
    // ============================================
    if (results.barang.failed === 0 && 
        results.transaksi.failed === 0 && 
        results.deposit.failed === 0 &&
        results.delete.failed === 0) {
      
      console.log("\n📥 All synced successfully, reloading from server...");
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
        
        console.log("✅ Data reloaded and cached");
      } catch (error) {
        console.warn("⚠️ Failed to reload data:", error.message);
      }
    }
    
    console.log("\n🔄 ====== SYNC COMPLETED ======");
    console.log("📊 Results:");
    console.log("   Barang:", results.barang.success, "success,", results.barang.failed, "failed");
    console.log("   Transaksi:", results.transaksi.success, "success,", results.transaksi.failed, "failed");
    console.log("   Deposit:", results.deposit.success, "success,", results.deposit.failed, "failed");
    console.log("   Delete:", results.delete.success, "success,", results.delete.failed, "failed");
    
    return {
      success: true,
      message: "Sinkronisasi selesai",
      results: results
    };
    
  } catch (error) {
    console.error("\n❌ SYNC ERROR:", error);
    return {
      success: false,
      message: "Gagal melakukan sinkronisasi: " + error.message,
      results: results
    };
  } finally {
    isSyncing = false;
    console.log("🔓 Sync lock released\n");
  }
}

// ============================================
// AUTO SYNC
// ============================================

function autoSync() {
  if (isOnline() && hasPendingChanges() && !isSyncing) {
    console.log("🔄 Auto-sync triggered...");
    syncPendingData().then((result) => {
      if (result.success) {
        window.dispatchEvent(new CustomEvent("dataSynced", { detail: result }));
      }
    });
  }
}

window.addEventListener("online", () => {
  console.log("🌐 Koneksi online terdeteksi");
  setTimeout(() => {
    autoSync();
  }, 2000);
});

setInterval(() => {
  if (isOnline() && hasPendingChanges()) {
    autoSync();
  }
}, 60000);

// ============================================
// DEBUG FUNCTIONS
// ============================================

function debugPendingData() {
  console.log("\n🔍 ====== DEBUG PENDING DATA ======");
  
  const pendingBarang = getPendingBarang();
  const pendingTransaksi = getPendingTransaksi();
  const pendingDeposit = getPendingDeposit();
  const pendingDelete = getPendingDelete();
  
  console.log("📦 Pending Barang:", pendingBarang.length);
  pendingBarang.forEach((item, idx) => {
    console.log(`   [${idx + 1}] ${item.id} - BM1:${item.stokBM1}, BM2:${item.stokBM2}`);
  });
  
  console.log("\n💰 Pending Transaksi:", pendingTransaksi.length);
  pendingTransaksi.forEach((item, idx) => {
    console.log(`   [${idx + 1}] Trans ID ${item.transaksi.id} - Total: ${item.transaksi.total}`);
  });
  
  console.log("\n💳 Pending Deposit:", pendingDeposit.length);
  console.log("🗑️ Pending Delete:", pendingDelete.length);
  
  console.log("\n🌐 Has Pending Changes:", hasPendingChanges());
  console.log("🌐 Is Online:", isOnline());
  
  console.log("\n====== END DEBUG ======\n");
  
  return {
    barang: pendingBarang.length,
    transaksi: pendingTransaksi.length,
    deposit: pendingDeposit.length,
    delete: pendingDelete.length,
    hasPending: hasPendingChanges(),
    isOnline: isOnline()
  };
}

// Expose to window for debugging
window.debugPendingData = debugPendingData;
window.forceSyncNow = syncPendingData;