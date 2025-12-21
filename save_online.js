const APPS_SCRIPT_URL = `https://script.google.com/macros/s/AKfycbwxxO1sBXQ8i-sCpkfT4R0qdsQdqdpo9RacQ8qXRusrF4fTR7I7Z_FHxB0bjaXLovCE/exec`;

async function sendToSheetOnline(action, data) {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);
    
    const response = await fetch(APPS_SCRIPT_URL, {
      method: "POST",
      mode: "cors",
      cache: "no-cache",
      headers: { "Content-Type": "text/plain" },
      body: JSON.stringify({ action, ...data }),
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP Error: ${response.status} - ${errorText}`);
    }
    
    const result = await response.json();
    return result;
  } catch (error) {
    throw error;
  }
}

async function loadBarangOnline() {
  const response = await sendToSheetOnline("FETCH_BARANG", {});
  if (response.success) {
    return response.result.map((barang) => {
      const jenisKelompok = barang.jenisKelompok || "Satuan";
      const banyakItemPerTurunan = barang.banyakItemPerTurunan || 1;
      const stokKelompokBM1 = barang.stokKelompokBM1 || 0;
      const stokKelompokBM2 = barang.stokKelompokBM2 || 0;
      const stokTurunanBM1 = barang.stokTurunanBM1 || 0;
      const stokTurunanBM2 = barang.stokTurunanBM2 || 0;
      const totalStokBM1 = stokKelompokBM1 * banyakItemPerTurunan + stokTurunanBM1;
      const totalStokBM2 = stokKelompokBM2 * banyakItemPerTurunan + stokTurunanBM2;
      
      return {
        tanggal: barang.tanggal,
        id: barang.id,
        nama: barang.nama,
        jenisKelompok: jenisKelompok,
        banyakItemPerTurunan: banyakItemPerTurunan,
        jenisTurunan: barang.jenisTurunan || "satuan",
        stokKelompokBM1: stokKelompokBM1,
        stokKelompokBM2: stokKelompokBM2,
        stokTurunanBM1: stokTurunanBM1,
        stokTurunanBM2: stokTurunanBM2,
        modalBarang: barang.modalBarang || 0,
        hargaJualKelompok: barang.hargaJualKelompok || 0,
        hargaJualTurunan: barang.hargaJualTurunan || 0,
        stokBM1: totalStokBM1,
        stokBM2: totalStokBM2,
        totalItem: barang.totalItem || totalStokBM1 + totalStokBM2,
        totalItemTerjual: barang.totalItemTerjual || 0,
        totalHargaItemTerjual: barang.totalHargaItemTerjual || 0,
        totalModal: barang.totalModal || 0,
        keuntunganMargin: barang.keuntunganMargin || 0,
        jenisTransaksi: barang.jenisTransaksi || "Penambahan Barang Baru",
        alamat: barang.alamat || "-",
        status: barang.status || "Tambah Barang Baru",
        catatan: barang.catatan || "",
      };
    });
  }
  return [];
}

async function loadTransaksiOnline() {
  const response = await sendToSheetOnline("FETCH_TRANSAKSI", {});
  if (response.success) {
    const transactions = (response.result.transactions || []).map((trans) => ({
      ...trans,
      items: (trans.items || []).map((item) => ({
        ...item,
        stokSource: item.stokSource || "BM1",
        qtyOriginal: item.qtyOriginal || item.qty,
        typeBarang: item.typeBarang || (item.isKotak ? "kelompok" : "turunan"),
        isKotak: item.typeBarang === "kelompok" || item.isKotak,
      })),
    }));
    return transactions;
  }
  return [];
}

async function loadDepositOnline() {
  const response = await sendToSheetOnline("FETCH_DEPOSIT", {});
  if (!response.success) return [];

  return response.result.map((item) => ({
    waktu: item.waktu,
    nama: item.nama || "",
    jenis: item.jenis || "Deposit",
    jumlah: parseFloat(item.jumlah) || 0,
    saldo: parseFloat(item.saldo) || 0,
    keterangan: item.keterangan || "",
    idTransaksi: item.idTransaksi || "",
    toko: item.toko || "",
  }));
}

async function saveBarangOnline(data) {
  const dataToSave = Array.isArray(data) ? data : [data];
  const validatedData = dataToSave.map((barang) => {
    const jenisKelompok = barang.jenisKelompok || "satuan";
    const banyakItemPerTurunan = barang.banyakItemPerTurunan || getBanyakItemPerTurunan(jenisKelompok);
    
    let stokKelompokBM1, stokTurunanBM1, stokKelompokBM2, stokTurunanBM2;
    
    if (barang.stokKelompokBM1 !== undefined) {
      stokKelompokBM1 = barang.stokKelompokBM1 || 0;
      stokTurunanBM1 = barang.stokTurunanBM1 || 0;
      stokKelompokBM2 = barang.stokKelompokBM2 || 0;
      stokTurunanBM2 = barang.stokTurunanBM2 || 0;
    } else {
      const totalBM1 = barang.stokBM1 || 0;
      const totalBM2 = barang.stokBM2 || 0;
      const separateBM1 = convertStokToSeparate(totalBM1, banyakItemPerTurunan);
      const separateBM2 = convertStokToSeparate(totalBM2, banyakItemPerTurunan);
      stokKelompokBM1 = separateBM1.stokKelompok;
      stokTurunanBM1 = separateBM1.stokTurunan;
      stokKelompokBM2 = separateBM2.stokKelompok;
      stokTurunanBM2 = separateBM2.stokTurunan;
    }

    return {
      tanggal: barang.tanggal || getTodayWIB(),
      id: barang.id,
      nama: barang.nama,
      jenisKelompok: jenisKelompok,
      banyakItemPerTurunan: banyakItemPerTurunan,
      jenisTurunan: getSatuanTurunanLabel(jenisKelompok).toLowerCase(),
      stokKelompokBM1: stokKelompokBM1,
      stokKelompokBM2: stokKelompokBM2,
      stokTurunanBM1: stokTurunanBM1,
      stokTurunanBM2: stokTurunanBM2,
      modalBarang: barang.modalBarang || 0,
      hargaJualKelompok: barang.hargaJualKelompok || 0,
      hargaJualTurunan: barang.hargaJualTurunan || 0,
      totalItem: barang.totalItem || 0,
      totalItemTerjual: barang.totalItemTerjual || 0,
      totalHargaItemTerjual: barang.totalHargaItemTerjual || 0,
      totalModal: barang.totalModal || 0,
      keuntunganMargin: barang.keuntunganMargin || 0,
      jenisTransaksi: barang.jenisTransaksi || "Penambahan Barang Baru",
      alamat: barang.alamat || "-",
      status: barang.status || "Tambah Barang Baru",
      catatan: barang.catatan || "",
    };
  });

  return await sendToSheetOnline("SAVE_BARANG", { data: validatedData });
}

async function saveTransaksiOnline(transaksi, detailData = []) {
  const transaksiArray = Array.isArray(transaksi) ? transaksi : [transaksi];

  const validatedTransaksi = transaksiArray.map((trans) => ({
    id: trans.id,
    noStruk: trans.noStruk || "",
    tanggal: trans.tanggal || getTodayWIB(),
    waktu: trans.waktu || getNowWIB(),
    jenis: trans.jenis || "Pemasukan",
    nama: trans.nama || "",
    alamat: trans.alamat || "",
    banyaknya: parseInt(trans.banyaknya) || 0,
    barang: trans.barang || "",
    total: parseFloat(trans.total) || 0,
    bayar: parseFloat(trans.bayar) || 0,
    sisa: parseFloat(trans.sisa) || 0,
    status: trans.status || "Selesai",
    catatan: trans.catatan || "",
    tipeProses: trans.tipeProses || "",
    netDifference: parseFloat(trans.netDifference) || 0,
    stokSource: trans.stokSource || "BM1",
    tipeAwal: trans.tipeAwal || "",
  }));

  const validatedDetailData = detailData.map((detail) => ({
    idTrans: detail.idTrans,
    tanggal: detail.tanggal || getTodayWIB(),
    id: detail.id,
    nama: detail.nama,
    harga: detail.harga || 0,
    qty: detail.qty || 0,
    typeBarang: detail.typeBarang || (detail.isKotak ? "kelompok" : "turunan"),
    hargaModalUnit: detail.hargaModalUnit || 0,
    qtyOriginal: detail.qtyOriginal || detail.qty,
    isRefunded: detail.isRefunded || false,
    isTukar: detail.isTukar || false,
    stokSource: detail.stokSource || "BM1",
    diskonPersen: parseFloat(detail.diskonPersen) || 0,
    diskonRupiah: parseFloat(detail.diskonRupiah) || 0,
  }));

  return await sendToSheetOnline("SAVE_TRANSAKSI", {
    data: validatedTransaksi,
    detailData: validatedDetailData,
  });
}

async function saveDepositOnline(data) {
  const dataArray = Array.isArray(data) ? data : [data];

  const depositData = dataArray.map((item) => ({
    waktu: item.waktu || getNowWIB(),
    nama: item.nama || "",
    jenis: item.jenis || "Deposit",
    jumlah: parseFloat(item.jumlah) || 0,
    saldo: parseFloat(item.saldo) || 0,
    keterangan: item.keterangan || "",
    idTransaksi: item.idTransaksi || "",
    toko: item.toko || "",
  }));

  return await sendToSheetOnline("SAVE_DEPOSIT", { data: depositData });
}

async function deleteEmptyBatchOnline(idBarang, tanggalBatch, jenisTransaksi = "Penambahan Stok Lama") {
  try {
    const result = await sendToSheetOnline("DELETE_EMPTY_BATCH", { 
      id: idBarang,
      tanggal: tanggalBatch,
      jenisTransaksi: jenisTransaksi
    });
    
    if (!result.success) {
      throw new Error(result.message || "Gagal menghapus batch kosong");
    }
    
    return result;
  } catch (error) {
    throw new Error("Gagal menghapus batch kosong: " + error.message);
  }
}

async function updateDetailTransaksiOnline(idTrans, updatedItems) {
  if (!idTrans || !Array.isArray(updatedItems)) {
    throw new Error("ID Transaksi atau items tidak valid");
  }

  const validatedItems = updatedItems.map((item) => ({
    idTrans: idTrans,
    tanggal: item.tanggal || getTodayWIB(),
    id: item.id,
    nama: item.nama,
    harga: parseFloat(item.harga) || 0,
    qty: parseInt(item.qty) || 0,
    typeBarang: item.typeBarang || (item.isKotak ? "kelompok" : "turunan"),
    hargaModalUnit: parseFloat(item.hargaModalUnit) || 0,
    qtyOriginal: parseInt(item.qtyOriginal) || item.qty,
    isRefunded: item.isRefunded || false,
    isTukar: item.isTukar || false,
    stokSource: item.stokSource || "BM1",
  }));

  return await sendToSheetOnline("UPDATE_DETAIL_TRANSAKSI", {
    idTrans: idTrans,
    items: validatedItems,
  });
}