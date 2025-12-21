if (typeof STORE_ID === "undefined") {
  alert("❌ Konfigurasi toko tidak valid. Hubungi administrator.");
}

let barangData = [];
let transaksiData = [];
let cartItems = [];
let manualGrandTotal = null;
let activeRefundTransaction = null;
let refundItems = [];
let addedExchangeItems = [];
let depositData = [];
let useDepositForTransaction = false;
let selectedDepositCustomer = null;
let isDataLoaded = false;

function showLoading(show) {
  let loader = document.getElementById("globalLoader");
  if (!loader && show) {
    loader = document.createElement("div");
    loader.id = "globalLoader";
    loader.innerHTML = '<div class="progress-bar"></div>';
    loader.style.cssText = "position:fixed;top:0;left:0;right:0;height:3px;background:transparent;z-index:9999;overflow:hidden;";
    document.body.appendChild(loader);
  }
  if (loader) {
    loader.style.display = show ? "block" : "none";
  }
}

async function loadAllData() {
  try {
    showLoading(true);

    if (isOnline()) {
      try {
        const [barang, transaksi, deposit] = await Promise.all([
          loadBarangData(),
          loadTransaksiData(),
          loadDepositData(),
        ]);

        barangData = barang;
        transaksiData = Array.isArray(transaksi) ? transaksi : transaksi.transactions || [];
        depositData = deposit;

        isDataLoaded = true;
        return true;
      } catch (error) {
        
        barangData = loadBarangCache();
        transaksiData = loadTransaksiCache();
        depositData = loadDepositCache();
        
        isDataLoaded = true;
        
        alert(
          "⚠️ Mode Offline\n\n" +
          "Koneksi ke server gagal. Menggunakan data dari cache.\n" +
          "Data akan tersinkronisasi otomatis saat koneksi stabil."
        );
        
        return true;
      }
    } else {
      barangData = loadBarangCache();
      transaksiData = loadTransaksiCache();
      depositData = loadDepositCache();
      
      isDataLoaded = true;
      
      alert(
        "📱 Mode Offline\n\n" +
        "Anda sedang offline. Menggunakan data dari cache.\n" +
        "Transaksi akan tersinkronisasi otomatis saat online."
      );
      
      return true;
    }
  } catch (error) {
    alert("❌ Gagal memuat data. Silakan refresh halaman.");
    return false;
  } finally {
    showLoading(false);
  }
}

async function refreshData() {
  if (!isOnline()) {
    barangData = loadBarangCache();
    transaksiData = loadTransaksiCache();
    depositData = loadDepositCache();
    return true;
  }
  
  try {
    return await loadAllData();
  } catch (error) {
    return true; 
  }
}

function loadPageData(page) {
  if (!isDataLoaded) {
    loadAllData().then(() => {
      renderPage(page);
    });
    return;
  }
  renderPage(page);
}

function renderPage(page) {
  switch (page) {
    case "transaksi":
      renderTodayTransactionsTable();
      renderCart();
      break;
    case "listbarang":
      renderListBarangTable(barangData);
      break;
    case "refund":
      resetRefundProcess();
      break;
  }
}

function initNavigation() {
  const navItems = document.querySelectorAll(".nav-item");
  const pages = document.querySelectorAll(".page");
  const sidebar = document.querySelector(".sidebar");
  const btnMenu = document.getElementById("btnMenu");

  if (!sidebar || !btnMenu) return;

  navItems.forEach((item) => {
    item.addEventListener("click", (e) => {
      e.preventDefault();
      const targetPage = item.dataset.page;

      navItems.forEach((nav) => nav.classList.remove("active"));
      pages.forEach((page) => page.classList.remove("active"));

      item.classList.add("active");
      const targetElement = document.getElementById(targetPage);
      if (targetElement) {
        targetElement.classList.add("active");
      }

      const pageTitleEl = document.getElementById("pageTitle");
      if (pageTitleEl) {
        const spanText = item.querySelector("span");
        if (spanText) {
          pageTitleEl.textContent = spanText.textContent;
        }
      }

      loadPageData(targetPage);

      if (window.innerWidth <= 768) {
        sidebar.classList.remove("show");
      }
    });
  });

  btnMenu.addEventListener("click", function (e) {
    e.preventDefault();
    e.stopPropagation();
    sidebar.classList.toggle("show");
  });

  document.addEventListener("click", function (e) {
    if (window.innerWidth > 768) return;
    if (!sidebar.classList.contains("show")) return;

    const isClickInsideSidebar = sidebar.contains(e.target);
    const isClickOnMenuButton = btnMenu.contains(e.target);

    if (!isClickInsideSidebar && !isClickOnMenuButton) {
      sidebar.classList.remove("show");
    }
  });
}

function initSearch() {
  const searchInput = document.getElementById("searchBarang");
  const btnSearch = document.getElementById("btnSearch");

  if (!searchInput || !btnSearch) return;

  function performSearch() {
    const query = searchInput.value.toLowerCase().trim();
    if (!query) {
      const resultsContainer = document.getElementById("searchResults");
      if (resultsContainer) resultsContainer.innerHTML = "";
      return;
    }

    const results = barangData.filter(function (b) {
      const jenis = b.jenisTransaksi || "Penambahan Barang Baru";
      const isMainBarang = jenis === "Penambahan Barang Baru";
      return isMainBarang && (b.id.toLowerCase().includes(query) || b.nama.toLowerCase().includes(query));
    });

    renderSearchResults(results);
  }

  btnSearch.addEventListener("click", performSearch);
  searchInput.addEventListener("keyup", function (e) {
    if (e.key === "Enter") {
      performSearch();
    } else if (searchInput.value.length > 2) {
      performSearch();
    } else if (searchInput.value.length === 0) {
      const resultsContainer = document.getElementById("searchResults");
      if (resultsContainer) resultsContainer.innerHTML = "";
    }
  });
}

function initDepositSearch() {
  const searchDepositInput = document.getElementById("searchDepositCustomer");
  const btnSearchDeposit = document.getElementById("btnSearchDeposit");
  const btnUseDeposit = document.getElementById("btnUseDeposit");
  const btnCancelDeposit = document.getElementById("btnCancelDeposit");

  if (!searchDepositInput || !btnSearchDeposit) return;

  function performDepositSearch() {
    const query = searchDepositInput.value.toLowerCase().trim();

    if (!query) {
      const resultsContainer = document.getElementById("depositSearchResults");
      if (resultsContainer) resultsContainer.innerHTML = "";
      return;
    }

    const customerMap = {};

    depositData.forEach((item) => {
      const namaLower = item.nama.toLowerCase();
      if (namaLower.includes(query)) {
        if (!customerMap[item.nama] || new Date(item.waktu) > new Date(customerMap[item.nama].waktu)) {
          customerMap[item.nama] = item;
        }
      }
    });

    const results = Object.values(customerMap);
    renderDepositSearchResults(results);
  }

  btnSearchDeposit.addEventListener("click", performDepositSearch);

  searchDepositInput.addEventListener("keyup", (e) => {
    if (e.key === "Enter") {
      performDepositSearch();
    } else if (searchDepositInput.value.length > 2) {
      performDepositSearch();
    } else if (searchDepositInput.value.length === 0) {
      const resultsContainer = document.getElementById("depositSearchResults");
      if (resultsContainer) resultsContainer.innerHTML = "";
    }
  });

  if (btnUseDeposit) {
    btnUseDeposit.addEventListener("click", activateDepositMode);
  }

  if (btnCancelDeposit) {
    btnCancelDeposit.addEventListener("click", deactivateDepositMode);
  }
}

function renderDepositSearchResults(results) {
  const container = document.getElementById("depositSearchResults");
  if (!container) return;

  if (results.length === 0) {
    container.innerHTML = '<p class="search-empty">Pelanggan tidak ditemukan atau tidak memiliki deposit</p>';
    return;
  }

  container.innerHTML = results
    .map((item) => {
      const saldoColor = item.saldo > 0 ? "#10b981" : "#ef4444";
      return `<div class="search-item" onclick="selectDepositCustomer('${item.nama}', ${item.saldo})">
        <div class="deposit-customer-info">
          <div class="deposit-customer-name">
            <i class="fas fa-user"></i> ${item.nama}
          </div>
          <div class="deposit-customer-balance" style="color: ${saldoColor}; font-weight: bold;">
            Saldo: ${formatRupiah(item.saldo)}
          </div>
        </div>
      </div>`;
    })
    .join("");
}

window.selectDepositCustomer = function (customerName, balance) {
  if (balance <= 0) {
    alert("❌ Saldo deposit pelanggan ini kosong!");
    return;
  }

  selectedDepositCustomer = {
    nama: customerName,
    saldo: balance,
  };

  const customerNameInput = document.getElementById("customerName");
  if (customerNameInput) {
    customerNameInput.value = customerName;
    customerNameInput.readOnly = true;
  }

  const depositInfoEl = document.getElementById("depositInfo");
  if (depositInfoEl) {
    depositInfoEl.innerHTML = `
      <div style="background: #dbeafe; border-left: 4px solid #3b82f6; padding: 12px; border-radius: 4px; margin: 10px 0;">
        <strong style="color: #1e40af;">
          <i class="fas fa-wallet"></i> Menggunakan Deposit: ${customerName}
        </strong><br>
        <span style="color: #1e40af;">Saldo: ${formatRupiah(balance)}</span>
      </div>`;
    depositInfoEl.style.display = "block";
  }

  const searchDepositInput = document.getElementById("searchDepositCustomer");
  const depositSearchResults = document.getElementById("depositSearchResults");
  if (searchDepositInput) searchDepositInput.value = "";
  if (depositSearchResults) depositSearchResults.innerHTML = "";

  const depositSearchSection = document.getElementById("depositSearchSection");
  if (depositSearchSection) depositSearchSection.style.display = "none";

  useDepositForTransaction = true;
};

function activateDepositMode() {
  const depositSearchSection = document.getElementById("depositSearchSection");
  if (depositSearchSection) {
    depositSearchSection.style.display = "block";
  }

  const searchDepositInput = document.getElementById("searchDepositCustomer");
  if (searchDepositInput) {
    searchDepositInput.focus();
  }
}

function deactivateDepositMode() {
  useDepositForTransaction = false;
  selectedDepositCustomer = null;

  const depositSearchSection = document.getElementById("depositSearchSection");
  if (depositSearchSection) {
    depositSearchSection.style.display = "none";
  }

  const depositInfoEl = document.getElementById("depositInfo");
  if (depositInfoEl) {
    depositInfoEl.style.display = "none";
    depositInfoEl.innerHTML = "";
  }

  const customerNameInput = document.getElementById("customerName");
  if (customerNameInput) {
    customerNameInput.readOnly = false;
  }

  const searchDepositInput = document.getElementById("searchDepositCustomer");
  const depositSearchResults = document.getElementById("depositSearchResults");
  if (searchDepositInput) searchDepositInput.value = "";
  if (depositSearchResults) depositSearchResults.innerHTML = "";
}

function renderSearchResults(results) {
  const container = document.getElementById("searchResults");
  if (!container) return;

  if (results.length === 0) {
    container.innerHTML = '<p class="search-empty">Barang tidak ditemukan</p>';
    return;
  }

  container.innerHTML = results
    .map(function (item) {
      const banyakItem = item.banyakItemPerTurunan || 1;
      const kelompokLabel = getKelompokLabel(item.jenisKelompok || "Satuan");
      const turunanLabel = item.jenisTurunan || getSatuanTurunanLabel(item.jenisKelompok || "Satuan");

      const allBatches = barangData
        .filter((b) => b.id === item.id)
        .sort((a, b) => new Date(a.tanggal) - new Date(b.tanggal));

      const totalStokSource = calculateTotalStokForBarang(item.id, barangData, STORE_ID);

      let batchBreakdownHTML = "";
      let batchNumber = 1;

      allBatches.forEach((batch) => {
        let batchStokKelompok, batchStokTurunan;

        if (STORE_ID === "BM1") {
          batchStokKelompok = batch.stokKelompokBM1 || 0;
          batchStokTurunan = batch.stokTurunanBM1 || 0;
        } else {
          batchStokKelompok = batch.stokKelompokBM2 || 0;
          batchStokTurunan = batch.stokTurunanBM2 || 0;
        }

        const batchTotalStok = batchStokKelompok * banyakItem + batchStokTurunan;

        if (batchTotalStok <= 0) return;

        const batchLabel = batch.jenisTransaksi === "Penambahan Stok Lama"
          ? '<span style="color: #f59e0b; font-weight: 600;">Batch ' + batchNumber + "</span>"
          : '<span style="color: #3b82f6; font-weight: 600;">Batch Awal</span>';

        const hargaJual = batch.hargaJualKelompok;

        batchBreakdownHTML +=
          '<div style="padding: 6px 0; border-left: 3px solid ' +
          (batch.jenisTransaksi === "Penambahan Stok Lama" ? "#f59e0b" : "#3b82f6") +
          '; padding-left: 8px; margin: 4px 0;">' +
          '<div style="display: flex; justify-content: space-between; align-items: center;">' +
          '<span style="font-size: 11px;">' +
          batchLabel +
          ": <strong>" +
          batchTotalStok +
          " " +
          turunanLabel +
          "</strong></span>" +
          '<span style="font-size: 11px; color: #059669; font-weight: 600;">' +
          formatRupiah(hargaJual) +
          "</span>" +
          "</div>" +
          "</div>";

        if (batch.jenisTransaksi === "Penambahan Stok Lama") batchNumber++;
      });

      const stockWarning = totalStokSource < 20 ? ' <span class="stock-low">(Menipis)</span>' : "";

      return (
        '<div class="search-item" onclick="addToCart(\'' +
        item.id +
        "')\">" +
        '<div class="search-item-header">' +
        '<span class="search-item-id">ID: ' +
        item.id +
        "</span>" +
        '<span class="kelompok-badge">' +
        kelompokLabel +
        "</span>" +
        "</div>" +
        '<div class="search-item-name">' +
        item.nama +
        "</div>" +
        '<div style="background: #f8fafc; padding: 10px; border-radius: 6px; margin: 8px 0;">' +
        '<div style="font-size: 11px; color: #64748b; margin-bottom: 6px; font-weight: 600;">' +
        '<i class="fas fa-layer-group"></i> Stok ' +
        STORE_ID +
        " (Sistem FIFO):" +
        "</div>" +
        batchBreakdownHTML +
        '<div style="margin-top: 8px; padding-top: 8px; border-top: 2px solid #e2e8f0;">' +
        '<div style="display: flex; justify-content: space-between; font-weight: 600;">' +
        '<span style="font-size: 12px;">Total Stok ' +
        STORE_ID +
        ":</span>" +
        '<span style="font-size: 12px; color: #1e293b;">' +
        totalStokSource +
        " " +
        turunanLabel +
        stockWarning +
        "</span>" +
        "</div>" +
        "</div>" +
        "</div>" +
        "</div>"
      );
    })
    .join("");
}

function calculateFIFOPricing(itemId, qtyNeeded, stokSource) {
  const allBatches = barangData
    .filter((b) => b.id === itemId)
    .sort((a, b) => new Date(a.tanggal) - new Date(b.tanggal));

  if (allBatches.length === 0) {
    return { totalCost: 0, breakdown: [], success: false };
  }

  const banyakItem = allBatches[0].banyakItemPerTurunan || 1;
  let remainingQty = qtyNeeded;
  let totalCost = 0;
  const breakdown = [];

  allBatches.forEach((batch) => {
    if (remainingQty <= 0) return;

    let batchStokKelompok, batchStokTurunan;

    if (stokSource === "BM1") {
      batchStokKelompok = batch.stokKelompokBM1 || 0;
      batchStokTurunan = batch.stokTurunanBM1 || 0;
    } else {
      batchStokKelompok = batch.stokKelompokBM2 || 0;
      batchStokTurunan = batch.stokTurunanBM2 || 0;
    }

    const batchTotalStok = batchStokKelompok * banyakItem + batchStokTurunan;

    if (batchTotalStok <= 0) return;

    const qtyFromThisBatch = Math.min(remainingQty, batchTotalStok);
    const costFromThisBatch = qtyFromThisBatch * batch.hargaJualKelompok;
    
    const modalPerUnit = batch.modalBarang && banyakItem > 0 
      ? batch.modalBarang / banyakItem 
      : batch.modalBarang || 0;

    totalCost += costFromThisBatch;
    breakdown.push({
      batch: batch.jenisTransaksi === "Penambahan Stok Lama" ? "Stok Lama" : "Batch Awal",
      qty: qtyFromThisBatch,
      harga: batch.hargaJualKelompok,
      subtotal: costFromThisBatch,
      hargaModalUnit: modalPerUnit,  // ✅ TAMBAHKAN INI
      tanggalBatch: batch.tanggal,    // ✅ OPSIONAL: untuk tracking
    });

    remainingQty -= qtyFromThisBatch;
  });

  return {
    totalCost: totalCost,
    breakdown: breakdown,
    success: remainingQty === 0,
  };
}

window.addToCart = function (itemId) {
  const barang = barangData.find(function (b) {
    return b.id === itemId;
  });
  if (!barang) return;

  const existingItem = cartItems.find(function (c) {
    return c.id === itemId;
  });

  const maxStock = calculateTotalStokForBarang(itemId, barangData, STORE_ID);

  if (maxStock <= 0) {
    alert("❌ Stok barang " + STORE_ID + " habis!");
    return;
  }

  const currentQty = existingItem ? existingItem.qty : 0;
  if (maxStock <= currentQty) {
    alert("❌ Stok barang " + STORE_ID + " tidak mencukupi!");
    return;
  }

  const banyakItem = barang.banyakItemPerTurunan || 1;
  const hargaModalUnit = barang.modalBarang && banyakItem > 0 ? barang.modalBarang / banyakItem : barang.modalBarang || 0;

  const jenisKelompok = (barang.jenisKelompok || "Satuan").toLowerCase();
  let defaultHarga, defaultType;

  if (jenisKelompok === "satuan" || jenisKelompok === "keping") {
    defaultHarga = barang.hargaJualKelompok;
    defaultType = "kelompok";
  } else {
    defaultHarga = barang.hargaJualKelompok;
    defaultType = "kelompok";
  }

  if (existingItem) {
    existingItem.qty++;
    existingItem.hargaAsli = existingItem.harga * existingItem.qty;
    existingItem.diskonRupiah = 0;
    existingItem.diskonPersen = 0;
  } else {
    cartItems.push({
      id: barang.id,
      nama: barang.nama,
      harga: defaultHarga,
      qty: 1,
      hargaAsli: defaultHarga,
      diskonPersen: 0,
      diskonRupiah: 0,
      hargaKelompok: barang.hargaJualKelompok,
      hargaTurunan: barang.hargaJualTurunan,
      isKotak: defaultType === "kelompok",
      typeBarang: defaultType,
      hargaModalUnit: defaultType === "kelompok" ? barang.modalBarang : hargaModalUnit,
      stokSource: STORE_ID,
      jenisKelompok: barang.jenisKelompok || "Satuan",
      banyakItemPerTurunan: banyakItem,
      jenisTurunan: barang.jenisTurunan || "satuan",
    });
  }

  renderCart();
};

function renderCart() {
  const container = document.getElementById("cartItems");
  if (!container) return;

  if (cartItems.length === 0) {
    container.innerHTML = '<p class="cart-empty">Keranjang kosong</p>';
    updateCartTotal();
    return;
  }

  container.innerHTML = cartItems
    .map(function (item, index) {
      const barangAsli = barangData.find(function (b) {
        return b.id === item.id;
      });
      const maxStock = calculateTotalStokForBarang(item.id, barangData, item.stokSource);

      const hargaKelompok = barangAsli ? barangAsli.hargaJualKelompok : item.harga;
      const hargaTurunan = barangAsli ? barangAsli.hargaJualTurunan : item.harga;
      const isManual = item.harga !== hargaKelompok && item.harga !== hargaTurunan;

      const stokBadge = '<span class="stok-badge stok-' + item.stokSource.toLowerCase() + '">' + item.stokSource + "</span>";
      const kelompokLabel = getKelompokLabel(item.jenisKelompok || "Satuan");
      const turunanLabel = item.jenisTurunan || getSatuanTurunanLabel(item.jenisKelompok || "Satuan");

      const jenisKelompok = (item.jenisKelompok || "Satuan").toLowerCase();
      let dropdownOptions = "";

      if (jenisKelompok === "satuan" || jenisKelompok === "keping") {
        dropdownOptions =
          '<option value="' +
          hargaKelompok +
          '" ' +
          (item.typeBarang === "kelompok" && !isManual ? "selected" : "") +
          ">" +
          kelompokLabel +
          "</option>" +
          '<option value="manual" ' +
          (isManual ? "selected" : "") +
          ">Manual</option>";
      } else {
        dropdownOptions =
          '<option value="' +
          hargaKelompok +
          '" ' +
          (item.typeBarang === "kelompok" && !isManual ? "selected" : "") +
          ">" +
          kelompokLabel +
          "</option>" +
          '<option value="' +
          hargaTurunan +
          '" ' +
          (item.typeBarang === "turunan" && !isManual ? "selected" : "") +
          ">" +
          turunanLabel +
          "</option>" +
          '<option value="manual" ' +
          (isManual ? "selected" : "") +
          ">Manual</option>";
      }

      const fifoResult = calculateFIFOPricing(item.id, item.qty, item.stokSource);

      let fifoBreakdownHTML = "";
      let usesFIFO = false;

      if (fifoResult.success && fifoResult.breakdown.length > 1) {
        usesFIFO = true;

        fifoBreakdownHTML =
          '<div style="background: #fef3c7; padding: 8px; margin-top: 8px; border-radius: 4px; border-left: 3px solid #f59e0b;">' +
          '<div style="font-size: 10px; color: #92400e; margin-bottom: 4px;">' +
          '<i class="fas fa-calculator"></i> <strong>Sistem FIFO - Breakdown Harga:</strong>' +
          "</div>";

        fifoResult.breakdown.forEach((b) => {
          fifoBreakdownHTML +=
            '<div style="font-size: 10px; color: #78350f; margin: 2px 0; display: flex; justify-content: space-between;">' +
            "<span>• " +
            b.qty +
            " " +
            turunanLabel +
            " @ " +
            formatRupiah(b.harga) +
            "</span>" +
            '<span style="font-weight: 600;">' +
            formatRupiah(b.subtotal) +
            "</span>" +
            "</div>";
        });

        fifoBreakdownHTML +=
          '<div style="margin-top: 4px; padding-top: 4px; border-top: 1px solid #fbbf24; font-size: 10px; font-weight: 600; color: #78350f; display: flex; justify-content: space-between;">' +
          "<span>Total FIFO:</span>" +
          "<span>" +
          formatRupiah(fifoResult.totalCost) +
          "</span>" +
          "</div>" +
          "</div>";
      }

      // PERBAIKAN: Gunakan FIFO totalCost sebagai hargaAsli jika menggunakan FIFO
      let hargaAsli = 0;

      if (usesFIFO) {
        hargaAsli = fifoResult.totalCost;
      } else {
        if (!item.hargaAsli || item.hargaAsli === 0) {
          if (item.typeBarang === "kelompok") {
            hargaAsli = hargaKelompok * item.qty;
          } else {
            hargaAsli = hargaTurunan * item.qty;
          }
        } else {
          hargaAsli = item.hargaAsli;
        }
      }

      // Update item.hargaAsli untuk konsistensi
      item.hargaAsli = hargaAsli;

      // PERBAIKAN: Hitung subtotal dengan benar
      const subtotal = usesFIFO ? fifoResult.totalCost : item.harga * item.qty;

      const diskonRupiah = Math.max(0, hargaAsli - subtotal);
      const diskonPersen = hargaAsli > 0 ? (diskonRupiah / hargaAsli) * 100 : 0;

      item.diskonRupiah = diskonRupiah;
      item.diskonPersen = diskonPersen;

      return (
        '<div class="cart-item">' +
        '<div class="cart-item-header">' +
        '<span class="cart-item-name">' +
        item.nama +
        " " +
        stokBadge +
        " <small>(" +
        kelompokLabel +
        ")</small></span>" +
        '<button class="btn-remove" onclick="removeFromCart(' +
        index +
        ')">' +
        '<i class="fas fa-trash"></i>' +
        "</button>" +
        "</div>" +
        '<div class="cart-item-controls">' +
        '<div class="qty-control">' +
        '<button class="btn-qty" onclick="decreaseQty(' +
        index +
        ')">' +
        '<i class="fas fa-minus"></i>' +
        "</button>" +
        '<input type="number" class="qty-input" value="' +
        item.qty +
        '" ' +
        'onchange="updateQty(' +
        index +
        ', this.value)" ' +
        'min="1" max="' +
        maxStock +
        '">' +
        '<button class="btn-qty" onclick="increaseQty(' +
        index +
        ')">' +
        '<i class="fas fa-plus"></i>' +
        "</button>" +
        "</div>" +
        '<div class="price-control-group">' +
        '<select class="price-selector" onchange="changeItemPrice(' +
        index +
        ', this.value)">' +
        dropdownOptions +
        "</select>" +
        '<input type="number" class="price-manual-input" value="' +
        item.harga +
        '" ' +
        'onchange="updateManualPrice(' +
        index +
        ', this.value)" placeholder="Harga">' +
        "</div>" +
        "</div>" +
        fifoBreakdownHTML +
        (diskonRupiah > 0
          ? '<div style="background: #dcfce7; border-left: 3px solid #16a34a; padding: 8px; margin-top: 8px; border-radius: 4px;">' +
            '<div style="font-size: 11px; color: #15803d; display: flex; justify-content: space-between; align-items: center;">' +
            '<span><i class="fas fa-tag"></i> <strong>Diskon Otomatis:</strong></span>' +
            '<span style="font-weight: 600;">' +
            formatRupiah(diskonRupiah) +
            " (" +
            diskonPersen.toFixed(1) +
            "%)</span>" +
            "</div>" +
            '<div style="font-size: 10px; color: #166534; margin-top: 3px;">' +
            "Harga Asli: " +
            formatRupiah(hargaAsli) +
            " → Harga Baru: " +
            formatRupiah(subtotal) +
            "</div>" +
            "</div>"
          : "") +
        '<div class="cart-item-total cart-item-subtotal-row">' +
        '<div style="flex: 1;">' +
        "<span>Subtotal:" +
        (usesFIFO
          ? ' <span style="background: #f59e0b; color: white; padding: 2px 6px; border-radius: 3px; font-size: 9px; margin-left: 5px;">FIFO</span>'
          : "") +
        "</span>" +
        "</div>" +
        '<div style="text-align: right;">' +
        (diskonRupiah > 0
          ? '<small style="text-decoration: line-through; color: #999; display: block;">' +
            formatRupiah(hargaAsli) +
            "</small>"
          : "") +
        '<input type="number" class="subtotal-input" value="' +
        subtotal +
        '" ' +
        'data-index="' +
        index +
        '" ' +
        'data-uses-fifo="' +
        usesFIFO +
        '" ' +
        'data-fifo-total="' +
        (usesFIFO ? fifoResult.totalCost : 0) +
        '" ' +
        'data-harga-asli="' +
        hargaAsli +
        '" ' +
        'onchange="updateSubtotal(' +
        index +
        ', this.value)">' +
        "</div>" +
        "</div>" +
        "</div>"
      );
    })
    .join("");

  updateCartTotal();
}

window.updateSubtotal = function (index, value) {
  const newSubtotal = parseFloat(value);

  if (isNaN(newSubtotal) || newSubtotal < 0) {
    alert("❌ Subtotal tidak valid!");
    renderCart();
    return;
  }

  const item = cartItems[index];

  if (!item || item.qty <= 0) {
    alert("❌ Item tidak valid!");
    renderCart();
    return;
  }

  const newHargaPerUnit = newSubtotal / item.qty;

  item.harga = newHargaPerUnit;
  item.typeBarang = "turunan";

  const barangAsli = barangData.find(function (b) {
    return b.id === item.id;
  });
  if (barangAsli) {
    const banyakItem = barangAsli.banyakItemPerTurunan || 1;
    item.hargaModalUnit = barangAsli.modalBarang && banyakItem > 0 ? barangAsli.modalBarang / banyakItem : barangAsli.modalBarang || 0;
  }

  const hargaAsli = parseFloat(document.querySelector('.subtotal-input[data-index="' + index + '"]').dataset.hargaAsli) || item.hargaAsli || newSubtotal;

  const diskonRupiah = Math.max(0, hargaAsli - newSubtotal);
  const diskonPersen = hargaAsli > 0 ? (diskonRupiah / hargaAsli) * 100 : 0;

  item.diskonRupiah = diskonRupiah;
  item.diskonPersen = diskonPersen;

  manualGrandTotal = null;

  renderCart();
};

window.changeItemPrice = function (index, priceValue) {
  const barangAsli = barangData.find(function (b) {
    return b.id === cartItems[index].id;
  });

  if (!barangAsli) return;

  const isManual = priceValue === "manual";
  let newPrice = isManual ? cartItems[index].harga : parseFloat(priceValue);

  const isKelompok = newPrice === barangAsli.hargaJualKelompok;
  const typeBarang = isKelompok ? "kelompok" : "turunan";

  const banyakItem = barangAsli.banyakItemPerTurunan || 1;
  const hargaModalUnit = isKelompok ? barangAsli.modalBarang : barangAsli.modalBarang && banyakItem > 0 ? barangAsli.modalBarang / banyakItem : barangAsli.modalBarang || 0;

  cartItems[index].harga = newPrice;
  cartItems[index].isKotak = isKelompok;
  cartItems[index].typeBarang = typeBarang;
  cartItems[index].hargaModalUnit = hargaModalUnit;

  if (!isManual) {
    cartItems[index].hargaAsli = newPrice * cartItems[index].qty;
    cartItems[index].diskonRupiah = 0;
    cartItems[index].diskonPersen = 0;
  }

  renderCart();
};

window.updateManualPrice = function (index, value) {
  const barangAsli = barangData.find(function (b) {
    return b.id === cartItems[index].id;
  });
  const newPrice = parseFloat(value);

  if (!isNaN(newPrice) && newPrice >= 0) {
    const item = cartItems[index];

    if (!item.hargaAsli || item.hargaAsli === 0) {
      if (barangAsli) {
        const hargaOriginal = item.typeBarang === "kelompok" ? barangAsli.hargaJualKelompok : barangAsli.hargaJualTurunan;
        item.hargaAsli = hargaOriginal * item.qty;
      }
    }

    item.harga = newPrice;
    item.typeBarang = "turunan";
    item.isKotak = false;

    if (barangAsli) {
      const banyakItem = barangAsli.banyakItemPerTurunan || 1;
      item.hargaModalUnit = barangAsli.modalBarang && banyakItem > 0 ? barangAsli.modalBarang / banyakItem : barangAsli.modalBarang || 0;
    }

    const hargaBaru = newPrice * item.qty;
    const diskonRupiah = Math.max(0, item.hargaAsli - hargaBaru);
    const diskonPersen = item.hargaAsli > 0 ? (diskonRupiah / item.hargaAsli) * 100 : 0;

    item.diskonRupiah = diskonRupiah;
    item.diskonPersen = diskonPersen;
  } else {
    alert("❌ Harga tidak valid!");
  }
  renderCart();
};

window.increaseQty = function (index) {
  const maxStock = calculateTotalStokForBarang(cartItems[index].id, barangData, cartItems[index].stokSource);

  if (cartItems[index].qty < maxStock) {
    cartItems[index].qty++;

    const hargaPerUnit = cartItems[index].hargaAsli / (cartItems[index].qty - 1);
    cartItems[index].hargaAsli = hargaPerUnit * cartItems[index].qty;

    manualGrandTotal = null;

    renderCart();
  } else {
    alert("❌ Jumlah melebihi stok " + cartItems[index].stokSource + " yang tersedia!");
  }
};

window.decreaseQty = function (index) {
  if (cartItems[index].qty > 1) {
    cartItems[index].qty--;

    const hargaPerUnit = cartItems[index].hargaAsli / (cartItems[index].qty + 1);
    cartItems[index].hargaAsli = hargaPerUnit * cartItems[index].qty;

    manualGrandTotal = null;

    renderCart();
  }
};

window.updateQty = function (index, value) {
  const qty = parseInt(value);
  const maxStock = calculateTotalStokForBarang(cartItems[index].id, barangData, cartItems[index].stokSource);

  if (qty > 0 && qty <= maxStock) {
    cartItems[index].qty = qty;
    manualGrandTotal = null;
    renderCart();
  } else if (qty > maxStock) {
    alert("❌ Jumlah melebihi stok " + cartItems[index].stokSource + " yang tersedia!");
    cartItems[index].qty = maxStock;
    manualGrandTotal = null;
    renderCart();
  } else {
    alert("❌ Kuantitas minimal 1!");
    cartItems[index].qty = 1;
    manualGrandTotal = null;
    renderCart();
  }
};

window.removeFromCart = function (index) {
  cartItems.splice(index, 1);
  manualGrandTotal = null;
  renderCart();
};

function updateCartTotal() {
  const calculatedTotal = cartItems.reduce(function (sum, item) {
    const fifoResult = calculateFIFOPricing(item.id, item.qty, item.stokSource);
    const usesFIFO = fifoResult.success && fifoResult.breakdown.length > 1;
    const itemSubtotal = usesFIFO ? fifoResult.totalCost : item.harga * item.qty;
    return sum + itemSubtotal;
  }, 0);

  const finalTotal = manualGrandTotal !== null ? manualGrandTotal : calculatedTotal;

  const cartTotalEl = document.getElementById("cartTotal");
  if (cartTotalEl) {
    cartTotalEl.innerHTML =
      '<input type="number" id="grandTotalInput" ' +
      'class="grand-total-input" value="' +
      finalTotal +
      '" ' +
      'onchange="updateGrandTotal(this.value)">';
  }

  const paymentInput = document.getElementById("paymentAmount");
  const payment = parseFloat(paymentInput ? paymentInput.value : 0) || 0;
  const difference = payment - finalTotal;

  const changeEl = document.getElementById("changeAmount");
  if (changeEl) {
    if (difference >= 0) {
      changeEl.textContent = formatRupiah(difference);
      changeEl.style.color = "#10b981";
    } else {
      changeEl.textContent = formatRupiah(Math.abs(difference));
      changeEl.style.color = "#ef4444";
    }
  }

  const changeLabel = document.querySelector('label[for="changeAmount"]');
  if (changeLabel) {
    changeLabel.textContent = difference >= 0 ? "Kembalian:" : "Kurang Bayar:";
  }
}

window.updateGrandTotal = function (value) {
  const newTotal = parseFloat(value);

  if (isNaN(newTotal) || newTotal < 0) {
    alert("❌ Grand Total tidak valid!");
    manualGrandTotal = null;
    updateCartTotal();
    return;
  }

  let totalAsli = 0;
  cartItems.forEach(function (item) {
    const fifoResult = calculateFIFOPricing(item.id, item.qty, item.stokSource);
    const usesFIFO = fifoResult.success && fifoResult.breakdown.length > 1;
    const itemHargaAsli = item.hargaAsli || (usesFIFO ? fifoResult.totalCost : item.harga * item.qty);
    totalAsli += itemHargaAsli;
  });

  const diskonGrandTotal = Math.max(0, totalAsli - newTotal);

  if (diskonGrandTotal > 0) {
    cartItems.forEach(function (item) {
      const fifoResult = calculateFIFOPricing(item.id, item.qty, item.stokSource);
      const usesFIFO = fifoResult.success && fifoResult.breakdown.length > 1;
      const itemHargaAsli = item.hargaAsli || (usesFIFO ? fifoResult.totalCost : item.harga * item.qty);
      const itemProportion = totalAsli > 0 ? itemHargaAsli / totalAsli : 0;
      const itemDiskon = diskonGrandTotal * itemProportion;
      const itemDiskonPersen = itemHargaAsli > 0 ? (itemDiskon / itemHargaAsli) * 100 : 0;

      item.diskonRupiah = itemDiskon;
      item.diskonPersen = itemDiskonPersen;
    });
  }

  manualGrandTotal = newTotal;
  updateCartTotal();
};

function updateStockAfterSale(items) {
  items.forEach(function (cartItem) {
    const idBarang = cartItem.id;
    const stokSource = cartItem.stokSource || STORE_ID;

    const barangUtama = barangData.find(function (b) {
      return b.id === idBarang && b.jenisTransaksi === "Penambahan Barang Baru";
    });

    if (!barangUtama) return;

    const jenisKelompok = barangUtama.jenisKelompok || "Satuan";
    const banyakItem = barangUtama.banyakItemPerTurunan || 1;

    let qtyNeeded = cartItem.qty;

    if (cartItem.typeBarang === "kelompok" && jenisKelompok.toLowerCase() !== "satuan") {
      qtyNeeded = cartItem.qty * banyakItem;
    }

    const allBatches = barangData.filter((b) => b.id === idBarang).sort((a, b) => new Date(a.tanggal) - new Date(b.tanggal));

    let remainingQty = qtyNeeded;

    allBatches.forEach((batch) => {
      if (remainingQty <= 0) return;

      let batchStokKelompok, batchStokTurunan;

      if (stokSource === "BM1") {
        batchStokKelompok = batch.stokKelompokBM1 || 0;
        batchStokTurunan = batch.stokTurunanBM1 || 0;
      } else {
        batchStokKelompok = batch.stokKelompokBM2 || 0;
        batchStokTurunan = batch.stokTurunanBM2 || 0;
      }

      const batchTotalStok = batchStokKelompok * banyakItem + batchStokTurunan;

      if (batchTotalStok <= 0) return;

      const qtyToTake = Math.min(remainingQty, batchTotalStok);
      const newBatchTotal = batchTotalStok - qtyToTake;

      const stokResult = convertStokToSeparate(newBatchTotal, banyakItem);

      if (stokSource === "BM1") {
        batch.stokKelompokBM1 = stokResult.stokKelompok;
        batch.stokTurunanBM1 = stokResult.stokTurunan;
        batch.stokBM1 = newBatchTotal;
      } else {
        batch.stokKelompokBM2 = stokResult.stokKelompok;
        batch.stokTurunanBM2 = stokResult.stokTurunan;
        batch.stokBM2 = newBatchTotal;
      }

      batch.totalItem = (batch.stokKelompokBM1 || 0) * banyakItem + (batch.stokTurunanBM1 || 0) +
                        (batch.stokKelompokBM2 || 0) * banyakItem + (batch.stokTurunanBM2 || 0);

      remainingQty -= qtyToTake;
      
      console.log(`📦 Stock reduced: ${batch.id} (${batch.jenisTransaksi}) - Remaining: ${batch.totalItem}`);
    });

    const totalStokBaru = calculateTotalStokForBarang(idBarang, barangData, stokSource);
    barangUtama.totalItem = totalStokBaru;
    
    console.log(`✅ Total stock for ${idBarang}: ${totalStokBaru}`);
  });
  
  updateBarangCache(barangData);
  console.log("💾 Stock updated in cache");
}

function checkIfNeedsPromotion(idBarang) {
  const mainBarang = barangData.find((b) => b.id === idBarang && b.jenisTransaksi === "Penambahan Barang Baru");

  if (!mainBarang) return false;

  const banyakItem = mainBarang.banyakItemPerTurunan || 1;
  const stokMainBM1 = (mainBarang.stokKelompokBM1 || 0) * banyakItem + (mainBarang.stokTurunanBM1 || 0);
  const stokMainBM2 = (mainBarang.stokKelompokBM2 || 0) * banyakItem + (mainBarang.stokTurunanBM2 || 0);
  const totalStokMain = stokMainBM1 + stokMainBM2;

  console.log(`🔍 Check promotion for ${idBarang}: Main stock = ${totalStokMain}`);
  
  return totalStokMain === 0;
}

function performBatchPromotion(itemId) {
  const mainBarangIndex = barangData.findIndex((b) => b.id === itemId && b.jenisTransaksi === "Penambahan Barang Baru");

  if (mainBarangIndex === -1) {
    console.log(`❌ Main barang not found: ${itemId}`);
    return false;
  }

  const mainBarang = barangData[mainBarangIndex];
  const banyakItem = mainBarang.banyakItemPerTurunan || 1;

  let oldBatchIndex = -1;
  let oldestBatchDate = null;

  for (let i = 0; i < barangData.length; i++) {
    const b = barangData[i];

    if (b.id !== itemId || b.jenisTransaksi !== "Penambahan Stok Lama") {
      continue;
    }

    const batchStokBM1 = (b.stokKelompokBM1 || 0) * banyakItem + (b.stokTurunanBM1 || 0);
    const batchStokBM2 = (b.stokKelompokBM2 || 0) * banyakItem + (b.stokTurunanBM2 || 0);
    const batchTotal = batchStokBM1 + batchStokBM2;

    if (batchTotal > 0) {
      if (!oldestBatchDate || new Date(b.tanggal) < new Date(oldestBatchDate)) {
        oldestBatchDate = b.tanggal;
        oldBatchIndex = i;
      }
    }
  }

  if (oldBatchIndex === -1) {
    console.log(`❌ No batch to promote for ${itemId}`);
    return false;
  }

  const oldestBatch = barangData[oldBatchIndex];
  const promotionTimestamp = new Date().getTime();

  console.log(`🔄 Promoting batch for ${itemId}:`);
  console.log(`   From: ${oldestBatch.tanggal}`);
  console.log(`   Stock: BM1=${oldestBatch.stokKelompokBM1}, BM2=${oldestBatch.stokKelompokBM2}`);

  barangData[mainBarangIndex] = {
    ...mainBarang,
    tanggal: mainBarang.tanggal,
    stokKelompokBM1: oldestBatch.stokKelompokBM1 || 0,
    stokKelompokBM2: oldestBatch.stokKelompokBM2 || 0,
    stokTurunanBM1: oldestBatch.stokTurunanBM1 || 0,
    stokTurunanBM2: oldestBatch.stokTurunanBM2 || 0,
    modalBarang: oldestBatch.modalBarang,
    hargaJualKelompok: oldestBatch.hargaJualKelompok,
    hargaJualTurunan: oldestBatch.hargaJualTurunan,
    stokBM1: (oldestBatch.stokKelompokBM1 || 0) * banyakItem + (oldestBatch.stokTurunanBM1 || 0),
    stokBM2: (oldestBatch.stokKelompokBM2 || 0) * banyakItem + (oldestBatch.stokTurunanBM2 || 0),
    totalItem:
      (oldestBatch.stokKelompokBM1 || 0) * banyakItem +
      (oldestBatch.stokTurunanBM1 || 0) +
      (oldestBatch.stokKelompokBM2 || 0) * banyakItem +
      (oldestBatch.stokTurunanBM2 || 0),
    catatan: `Batch Promoted | Dari: ${formatDate(oldestBatch.tanggal)} | Modal: ${formatRupiah(oldestBatch.modalBarang)}, Harga: ${formatRupiah(oldestBatch.hargaJualKelompok)} | Timestamp: ${promotionTimestamp}`,
    jenisTransaksi: "Penambahan Barang Baru",
  };

  barangData[oldBatchIndex] = {
    ...oldestBatch,
    stokKelompokBM1: 0,
    stokKelompokBM2: 0,
    stokTurunanBM1: 0,
    stokTurunanBM2: 0,
    stokBM1: 0,
    stokBM2: 0,
    totalItem: 0,
    status: "HAPUS_PERMANENT",
    catatan: (oldestBatch.catatan || "") + ` | PROMOTED_${promotionTimestamp} | WILL_BE_DELETED`,
    promotedDate: oldestBatch.tanggal,
    _markForDeletion: true,
  };

  updateBarangCache(barangData);
  console.log("💾 Promotion saved to cache");

  return {
    success: true,
    promotionId: promotionTimestamp,
    batchIndex: oldBatchIndex,
    batchDate: oldestBatch.tanggal,
    deleteId: oldestBatch.id,
  };
}

async function deleteBarangById(idBarang) {
  const data = {
    action: "DELETE_BARANG",
    id: idBarang,
  };

  const response = await fetch(APPS_SCRIPT_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });

  if (!response.ok) throw new Error("Gagal menghapus barang");
  
  const result = await response.json();
  if (!result.success) throw new Error(result.message);
  
  return result;
}

function getBarangToSave(affectedItemIds, promotionResults) {
  const toSave = [];
  const toDelete = [];
  
  affectedItemIds.forEach((itemId) => {
    const mainBarang = barangData.find((b) => 
      b.id === itemId && 
      b.jenisTransaksi === "Penambahan Barang Baru"
    );
    
    if (mainBarang) {
      toSave.push(mainBarang);
      console.log(`📦 Will save main: ${itemId} - Stock BM1=${mainBarang.stokBM1}, BM2=${mainBarang.stokBM2}`);
    }
    
    const promotionInfo = promotionResults.find((r) => 
      r.itemId === itemId && r.promoted
    );
    
    if (promotionInfo) {
      console.log(`🔄 Promotion detected for ${itemId}`);
      
      const emptyBatch = barangData.find(
        (b) =>
          b.id === itemId &&
          b.jenisTransaksi === "Penambahan Stok Lama" &&
          b.status === "HAPUS_PERMANENT" &&
          b.catatan &&
          b.catatan.includes(`PROMOTED_${promotionInfo.promotionId}`)
      );
      
      if (emptyBatch) {
        toDelete.push({
          id: emptyBatch.id,
          tanggal: emptyBatch.tanggal,
          jenisTransaksi: "Penambahan Stok Lama"
        });
        console.log(`🗑️ Will delete batch: ${itemId} (${emptyBatch.tanggal})`);
      }
    } else {
      const updatedBatches = barangData.filter(
        (b) => 
          b.id === itemId && 
          b.jenisTransaksi === "Penambahan Stok Lama" && 
          b.totalItem > 0 &&
          b.status !== "HAPUS_PERMANENT"
      );
      
      if (updatedBatches.length > 0) {
        toSave.push(...updatedBatches);
        console.log(`📦 Will save ${updatedBatches.length} old batches for ${itemId}`);
      }
    }
  });
  
  console.log(`\n📊 Summary:`);
  console.log(`   Items to save: ${toSave.length}`);
  console.log(`   Items to delete: ${toDelete.length}`);
  
  return { toSave, toDelete };
}

// 1. PERBAIKAN: Tambahkan retry mechanism untuk operasi online
async function saveWithRetry(saveFunction, maxRetries = 3) {
  let lastError;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const result = await saveFunction();
      return result;
    } catch (error) {
      lastError = error;
      console.warn(`Attempt ${attempt} failed:`, error.message);
      
      if (attempt < maxRetries) {
        // Exponential backoff: 1s, 2s, 3s
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
      }
    }
  }
  
  throw lastError;
}
// 2. PERBAIKAN: Error handling yang lebih baik di checkout
async function initCheckout() {
  const btnCheckout = document.getElementById("btnCheckout");
  if (!btnCheckout) return;

  btnCheckout.addEventListener("click", async () => {
    if (cartItems.length === 0) {
      alert("❌ Keranjang masih kosong!");
      return;
    }

    const isCurrentlyOnline = isOnline();
    
    if (!isCurrentlyOnline) {
      const confirmOffline = confirm(
        "⚠️ MODE OFFLINE\n\n" +
        "Anda sedang offline. Transaksi akan disimpan di perangkat " +
        "dan otomatis tersinkronisasi saat koneksi kembali.\n\n" +
        "Lanjutkan transaksi?"
      );
      
      if (!confirmOffline) return;
    }

    let calculatedTotal = 0;
    cartItems.forEach((item) => {
      const fifoResult = calculateFIFOPricing(item.id, item.qty, item.stokSource);
      const usesFIFO = fifoResult.success && fifoResult.breakdown.length > 1;
      const itemSubtotal = usesFIFO ? fifoResult.totalCost : item.harga * item.qty;
      calculatedTotal += itemSubtotal;
    });

    const finalTotal = manualGrandTotal !== null ? manualGrandTotal : calculatedTotal;
    const payment = parseFloat(document.getElementById("paymentAmount")?.value) || 0;
    const change = Math.max(0, payment - finalTotal);

    if (useDepositForTransaction && selectedDepositCustomer) {
      const customerBalance = selectedDepositCustomer.saldo;

      if (finalTotal > customerBalance) {
        const shortfall = finalTotal - customerBalance;
        const confirmed = confirm(
          "⚠️ Saldo deposit tidak mencukupi!\n\n" +
            "Total Belanja: " + formatRupiah(finalTotal) + "\n" +
            "Saldo Deposit: " + formatRupiah(customerBalance) + "\n" +
            "Kekurangan: " + formatRupiah(shortfall) + "\n\n" +
            "Pelanggan harus membayar kekurangan secara tunai.\n" +
            "Lanjutkan?"
        );

        if (!confirmed) return;

        if (payment < shortfall) {
          alert("❌ Pembayaran tunai kurang! Harus bayar: " + formatRupiah(shortfall));
          return;
        }
      }
    } else if (payment < finalTotal) {
      const kekurangan = finalTotal - payment;

      const confirmed = confirm(
        "⚠️ Pembayaran kurang dari total!\n\n" +
          "Total Belanja: " + formatRupiah(finalTotal) + "\n" +
          "Dibayar: " + formatRupiah(payment) + "\n" +
          "Kekurangan: " + formatRupiah(kekurangan) + "\n\n" +
          "Transaksi akan dicatat sebagai 'Belum Lunas'.\n" +
          "Lanjutkan?"
      );

      if (!confirmed) return;
    } else if (payment >= finalTotal) {
      const kembalian = payment - finalTotal;
      const confirmed = confirm(
        "✅ Konfirmasi Pembayaran Lunas\n\n" +
          "Total Belanja: " + formatRupiah(finalTotal) + "\n" +
          "Dibayar: " + formatRupiah(payment) + "\n" +
          "Kembalian: " + formatRupiah(kembalian) + "\n\n" +
          "Lanjutkan transaksi?"
      );

      if (!confirmed) return;
    }

    let barangListForKeuangan = "";
    let totalBanyaknya = 0;

    cartItems.forEach(function (item) {
      const kelompokLabel = getKelompokLabel(item.jenisKelompok || "Satuan");
      const turunanLabel = item.jenisTurunan || getSatuanTurunanLabel(item.jenisKelompok || "Satuan");

      const fifoResult = calculateFIFOPricing(item.id, item.qty, item.stokSource);
      const usesFIFO = fifoResult.success && fifoResult.breakdown.length > 1;

      if (usesFIFO) {
        fifoResult.breakdown.forEach(function (batch) {
          const batchLabel = batch.batch === "Stok Lama" ? " [Batch Lama]" : " [Batch Awal]";
          barangListForKeuangan += item.nama + " (" + batch.qty + " " + turunanLabel + batchLabel + ") [" + (item.stokSource || STORE_ID) + "], ";
          totalBanyaknya += batch.qty;
        });
      } else {
        const unitLabel = item.typeBarang === "kelompok" ? kelompokLabel : turunanLabel;
        barangListForKeuangan += item.nama + " (" + item.qty + " " + unitLabel + ") [" + (item.stokSource || STORE_ID) + "], ";
        totalBanyaknya += item.qty;
      }
    });

    barangListForKeuangan = barangListForKeuangan.replace(/, $/, "");

    const customerName = document.getElementById("customerName")?.value || "Customer";
    let transactionNote = document.getElementById("transactionNote")?.value || "-";

    const totalDiskon = cartItems.reduce((sum, item) => sum + (item.diskonRupiah || 0), 0);
    const sisaTagihan = Math.max(0, finalTotal - payment);
    let statusTransaksi = "Lunas";

    if (useDepositForTransaction && selectedDepositCustomer) {
      statusTransaksi = "Lunas";
    } else if (sisaTagihan > 0) {
      statusTransaksi = "Belum Lunas";
      transactionNote = "Kurang Bayar: " + formatRupiah(sisaTagihan) + ". " + transactionNote;
    }

    if (totalDiskon > 0) {
      transactionNote = "Total Diskon: " + formatRupiah(totalDiskon) + ". " + transactionNote;
    }

    if (useDepositForTransaction && selectedDepositCustomer) {
      transactionNote = "Bayar dengan Deposit: " + formatRupiah(Math.min(finalTotal, selectedDepositCustomer.saldo)) + ". " + transactionNote;
    }

    const transaction = {
      id: Date.now(),
      tanggal: getTodayWIB(),
      waktu: getNowWIB(),
      jenis: "Pemasukan",
      nama: customerName,
      alamat: document.getElementById("customerAddress")?.value || "-",
      banyaknya: totalBanyaknya,
      barang: barangListForKeuangan,
      total: finalTotal,
      bayar: payment,
      sisa: sisaTagihan,
      totalDiskon: totalDiskon,
      status: statusTransaksi,
      catatan: transactionNote,
      tipeProses: "",
      netDifference: 0,
      stokSource: STORE_ID,
      items: [],
    };

    const detailTransactionData = [];

    cartItems.forEach(function (item) {
      const fifoResult = calculateFIFOPricing(item.id, item.qty, item.stokSource);
      const usesFIFO = fifoResult.success && fifoResult.breakdown.length > 1;
      const diskonPersen = item.diskonPersen || 0;
      const diskonRupiah = item.diskonRupiah || 0;

      if (usesFIFO) {
        fifoResult.breakdown.forEach(function (batch) {
          const batchSubtotal = batch.subtotal;
          const totalSebelumDiskon = fifoResult.totalCost;
          const batchDiskonRupiah = totalSebelumDiskon > 0 ? (batchSubtotal / totalSebelumDiskon) * diskonRupiah : 0;

          const detailItem = {
            idTrans: transaction.id,
            tanggal: transaction.tanggal,
            id: item.id,
            nama: item.nama,
            harga: batch.harga,
            qty: batch.qty,
            diskonPersen: diskonPersen,
            diskonRupiah: batchDiskonRupiah,
            isKotak: item.typeBarang === "kelompok",
            typeBarang: item.typeBarang || "turunan",
            hargaModalUnit: batch.hargaModalUnit,
            qtyOriginal: batch.qty,
            isRefunded: false,
            isTukar: false,
            stokSource: item.stokSource || STORE_ID,
          };

          detailTransactionData.push(detailItem);
          transaction.items.push(detailItem);
        });
      } else {
        const detailItem = {
          idTrans: transaction.id,
          tanggal: transaction.tanggal,
          id: item.id,
          nama: item.nama,
          harga: item.harga,
          qty: item.qty,
          diskonPersen: diskonPersen,
          diskonRupiah: diskonRupiah,
          isKotak: item.typeBarang === "kelompok",
          typeBarang: item.typeBarang || "turunan",
          hargaModalUnit: item.hargaModalUnit,
          qtyOriginal: item.qty,
          isRefunded: false,
          isTukar: false,
          stokSource: item.stokSource || STORE_ID,
        };

        detailTransactionData.push(detailItem);
        transaction.items.push(detailItem);
      }
    });

    console.log("\n🛒 ====== STARTING CHECKOUT ======");
    console.log("💰 Total:", finalTotal);
    console.log("💵 Payment:", payment);
    console.log("🔄 Online:", isCurrentlyOnline);

    const affectedItemIds = new Set();
    cartItems.forEach((item) => affectedItemIds.add(item.id));

    console.log("\n📦 STEP 1: Update stock in memory...");
    updateStockAfterSale(cartItems);
    
    console.log("\n🔄 STEP 2: Check promotions...");
    const promotionResults = [];
    for (const itemId of affectedItemIds) {
      const needsPromotion = checkIfNeedsPromotion(itemId);
      if (needsPromotion) {
        const promotionInfo = performBatchPromotion(itemId);
        if (promotionInfo && promotionInfo.success) {
          promotionResults.push({
            itemId,
            promoted: true,
            promotionId: promotionInfo.promotionId,
            batchDate: promotionInfo.batchDate,
          });
        } else {
          promotionResults.push({ itemId, promoted: false });
        }
      }
    }

    console.log("\n📋 STEP 3: Prepare data to save...");
    const finalBarangResult = getBarangToSave(affectedItemIds, promotionResults);

    try {
      showLoading(true);

      console.log("\n💾 STEP 4: Save to Google Sheets...");
      
      const barangResult = await saveBarangData(finalBarangResult.toSave);
      
      if (!barangResult.success && !barangResult.offline) {
        throw new Error("Gagal menyimpan data stok barang");
      }

      console.log("\n💰 STEP 5: Save transaction...");
      
      const transaksiResult = await saveTransaksiData(transaction, detailTransactionData);
      
      if (!transaksiResult.success && !transaksiResult.offline) {
        throw new Error("Gagal menyimpan data transaksi");
      }

      if (finalBarangResult.toDelete && finalBarangResult.toDelete.length > 0) {
        console.log("\n🗑️ STEP 6: Delete empty batches...");
        
        for (const batchInfo of finalBarangResult.toDelete) {
          try {
            console.log(`   Deleting: ${batchInfo.id} (${batchInfo.tanggal})`);
            
            const deleteResult = await deleteEmptyBatch(
              batchInfo.id, 
              batchInfo.tanggal, 
              "Penambahan Stok Lama"
            );
            
            console.log(`   ✅ Delete result:`, deleteResult);
          } catch (error) {
            console.warn(`   ⚠️ Delete failed:`, error.message);
          }
        }
      }

      if (useDepositForTransaction && selectedDepositCustomer) {
        console.log("\n💳 STEP 7: Save deposit...");
        
        const depositUsed = Math.min(finalTotal, selectedDepositCustomer.saldo);
        const newBalance = selectedDepositCustomer.saldo - depositUsed;

        const depositTransaction = {
          waktu: getNowWIB(),
          nama: selectedDepositCustomer.nama,
          jenis: "Penggunaan",
          jumlah: -depositUsed,
          saldo: newBalance,
          keterangan: "Belanja di " + STORE_ID + " - Total: " + formatRupiah(finalTotal),
          idTransaksi: transaction.id.toString(),
          toko: STORE_ID,
        };

        try {
          await saveDeposit([depositTransaction]);
          console.log("   ✅ Deposit saved");
        } catch (error) {
          console.warn("   ⚠️ Deposit failed:", error.message);
        }
      }

      console.log("\n📥 STEP 8: Reload data...");
      
      if (isCurrentlyOnline) {
        try {
          const [barang, transaksi, deposit] = await Promise.all([
            loadBarangData(), 
            loadTransaksiData(), 
            loadDepositData()
          ]);

          barangData = barang;
          transaksiData = Array.isArray(transaksi) ? transaksi : transaksi.transactions || [];
          depositData = deposit;
          console.log("   ✅ Data reloaded");
        } catch (error) {
          console.warn("   ⚠️ Using cache");
          barangData = loadBarangCache();
          transaksiData = loadTransaksiCache();
          depositData = loadDepositCache();
        }
      } else {
        barangData = loadBarangCache();
        transaksiData = loadTransaksiCache();
        depositData = loadDepositCache();
      }
      
      const searchInput = document.getElementById("searchBarang");
      if (searchInput && searchInput.value.trim() !== "") {
        console.log("   🔄 Refreshing search results...");
        performSearchAfterCheckout(searchInput.value.trim());
      }

      const actualPayment = useDepositForTransaction && selectedDepositCustomer 
        ? Math.max(0, finalTotal - selectedDepositCustomer.saldo) 
        : payment;

      let alertMessage = "✅ Transaksi berhasil!\n";
      
      if (!isCurrentlyOnline) {
        alertMessage += "📱 MODE OFFLINE\n\n";
      }
      
      alertMessage += "Total: " + formatRupiah(finalTotal) + "\n";

      if (useDepositForTransaction && selectedDepositCustomer) {
        const depositUsed = Math.min(finalTotal, selectedDepositCustomer.saldo);
        alertMessage += "Bayar Deposit: " + formatRupiah(depositUsed) + "\n";
        if (actualPayment > 0) {
          alertMessage += "Bayar Tunai: " + formatRupiah(actualPayment) + "\n";
        }
        alertMessage += "Sisa Deposit: " + formatRupiah(selectedDepositCustomer.saldo - depositUsed) + "\n";
      } else {
        alertMessage += "Dibayar: " + formatRupiah(payment) + "\n";
        if (sisaTagihan > 0) {
          alertMessage += "Sisa Tagihan: " + formatRupiah(sisaTagihan) + "\n";
        }
      }

      if (change > 0) {
        alertMessage += "Kembalian: " + formatRupiah(change);
      }

      const promotedItems = promotionResults.filter((r) => r.promoted);
      if (promotedItems.length > 0) {
        alertMessage += "\n\n📦 Batch Promotion: " + promotedItems.length + " barang dipromosikan";
      }

      if (!isCurrentlyOnline) {
        const pendingBarang = getPendingBarang();
        const pendingTrans = getPendingTransaksi();
        alertMessage += "\n\n📤 Pending: " + pendingBarang.length + " barang, " + pendingTrans.length + " transaksi";
      }

      alert(alertMessage);

      console.log("\n✅ ====== CHECKOUT SUCCESS ======\n");

      cartItems = [];
      manualGrandTotal = null;
      deactivateDepositMode();

      const customerNameInput = document.getElementById("customerName");
      const customerAddress = document.getElementById("customerAddress");
      const transactionNoteInput = document.getElementById("transactionNote");
      const paymentAmount = document.getElementById("paymentAmount");
      const changeAmount = document.getElementById("changeAmount");

      if (customerNameInput) customerNameInput.value = "";
      if (customerAddress) customerAddress.value = "";
      if (transactionNoteInput) transactionNoteInput.value = "";
      if (paymentAmount) paymentAmount.value = "";
      if (changeAmount) changeAmount.textContent = "Rp 0";

      renderCart();
      renderTodayTransactionsTable();
      
    } catch (error) {
      console.error("\n❌ ====== CHECKOUT FAILED ======");
      console.error("Error:", error);
      
      alert(
        "❌ Gagal menyimpan transaksi.\n\n" +
        error.message +
        "\n\nSilakan coba lagi."
      );
    } finally {
      showLoading(false);
    }
  });

  const paymentAmount = document.getElementById("paymentAmount");
  if (paymentAmount) {
    paymentAmount.addEventListener("input", updateCartTotal);
  }
}

function performSearchAfterCheckout(query) {
  if (!query) return;
  
  const queryLower = query.toLowerCase();
  
  const results = barangData.filter(function (b) {
    const jenis = b.jenisTransaksi || "Penambahan Barang Baru";
    const isMainBarang = jenis === "Penambahan Barang Baru";
    return isMainBarang && (b.id.toLowerCase().includes(queryLower) || b.nama.toLowerCase().includes(queryLower));
  });

  renderSearchResults(results);
  
  console.log(`   ✅ Search results refreshed: ${results.length} items found`);
}

function renderTodayTransactionsTable() {
  const tbody = document.getElementById("todayTransactionsTableBody");

  if (!tbody) return;

  const today = getTodayWIB();

  // ✅ PERBAIKAN 3: Pisahkan transaksi hari ini dan transaksi belum lunas sebelumnya
  const todayTransactions = transaksiData
    .filter((t) => {
      if (!t.tanggal) return false;

      try {
        const transDateLocal = getLocalDateString(t.tanggal);
        const isToday = transDateLocal === today;
        const isFromThisStore = t.stokSource === STORE_ID;

        return isToday && isFromThisStore;
      } catch (error) {
        return false;
      }
    })
    .sort((a, b) => new Date(b.waktu) - new Date(a.waktu));

  const previousUnpaidTransactions = transaksiData
    .filter((t) => {
      if (!t.tanggal) return false;

      try {
        const transDateLocal = getLocalDateString(t.tanggal);
        const isToday = transDateLocal === today;
        const isFromThisStore = t.stokSource === STORE_ID;
        const isUnpaid = t.status === "Belum Lunas";

        // Hanya ambil transaksi belum lunas dari hari sebelumnya (bukan hari ini)
        return !isToday && isFromThisStore && isUnpaid;
      } catch (error) {
        return false;
      }
    })
    .sort((a, b) => new Date(b.waktu) - new Date(a.waktu));

  if (todayTransactions.length === 0 && previousUnpaidTransactions.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" class="table-empty">Belum ada transaksi hari ini di ' + STORE_ID + ".</td></tr>";
    return;
  }

  let htmlContent = "";

  // ✅ Bagian 1: Transaksi Hari Ini
  if (todayTransactions.length > 0) {
    htmlContent += '<tr class="section-header-row"><td colspan="7" style="background: #3b82f6; color: white; font-weight: bold; text-align: center; padding: 10px;">📅 TRANSAKSI HARI INI - ' + formatDate(today) + "</td></tr>";

    htmlContent += todayTransactions
      .map((t) => generateTransactionRow(t))
      .join("");
  }

  // ✅ Bagian 2: Transaksi Belum Lunas Sebelumnya
  if (previousUnpaidTransactions.length > 0) {
    htmlContent += '<tr class="section-divider-row"><td colspan="7" style="background: #f59e0b; color: white; font-weight: bold; text-align: center; padding: 10px;">⏳ TRANSAKSI BELUM LUNAS (Hari Sebelumnya)</td></tr>';

    htmlContent += previousUnpaidTransactions
      .map((t) => generateTransactionRow(t, true))
      .join("");
  }

  tbody.innerHTML = htmlContent;
}

// ✅ Helper function untuk generate row transaksi
function generateTransactionRow(t, isPrevious = false) {
  if (t.tipeProses === "refund" || t.tipeProses === "exchange") {
    const refundItemsText = t.items
      .filter((item) => item.isRefunded)
      .map((item) => {
        const typeLabel = getDisplayLabel(item, barangData);
        return '<span class="refund-item-text">- ' + item.nama + " (" + item.qty + " " + typeLabel + ") [" + (item.stokSource || STORE_ID) + "]</span>";
      })
      .join("<br>");

    const exchangeItemsText = t.items
      .filter((item) => !item.isRefunded)
      .map((item) => {
        const typeLabel = getDisplayLabel(item, barangData);
        return '<span class="exchange-item-text">+ ' + item.nama + " (" + item.qty + " " + typeLabel + ") [" + (item.stokSource || STORE_ID) + "]</span>";
      })
      .join("<br>");

    const totalKeluarMasuk = t.total;

    let totalText = "";
    let colorClass = "";

    if (t.tipeProses === "refund") {
      totalText = "Uang Kembali: " + formatRupiah(totalKeluarMasuk);
      colorClass = "total-danger";
    } else {
      if (t.jenis === "Pemasukan") {
        totalText = "Uang Tambah: " + formatRupiah(totalKeluarMasuk);
        colorClass = "total-success";
      } else if (t.jenis === "Pengeluaran") {
        totalText = "Uang Kembali: " + formatRupiah(totalKeluarMasuk);
        colorClass = "total-danger";
      } else {
        totalText = "Tukar Setara: " + formatRupiah(0);
        colorClass = "total-neutral";
      }
    }

    const fullBarangList = refundItemsText + (refundItemsText && exchangeItemsText ? "<br>" : "") + exchangeItemsText;

    return (
      '<tr class="refund-exchange-row' + (isPrevious ? ' previous-unpaid-row' : '') + '">' +
      "<td>" +
      formatDate(t.tanggal) + " " +
      formatDateTime(t.waktu).slice(-8) +
      "</td>" +
      "<td>" +
      t.nama +
      "</td>" +
      '<td class="barang-list-cell">' +
      "<strong>Barang Diproses (" +
      t.tipeProses.toUpperCase() +
      "):</strong><br>" +
      (fullBarangList || "Tidak ada barang diproses") +
      "</td>" +
      '<td><span class="' +
      colorClass +
      '">' +
      totalText +
      "</span></td>" +
      '<td><span class="status-refund-exchange">' +
      t.tipeProses.toUpperCase() +
      "</span></td>" +
      "<td>" +
      t.catatan +
      " (Trans. Awal ID: " +
      t.tipeAwal +
      ")</td>" +
      "<td>-</td>" +
      "</tr>"
    );
  }

  if (t.jenis === "Pemasukan") {
    const barangList = t.items
      ? t.items
          .map((item) => {
            const typeLabel = getDisplayLabel(item, barangData);
            return item.nama + " (" + item.qty + " " + typeLabel + ") [" + (item.stokSource || STORE_ID) + "]";
          })
          .join("<br>")
      : t.barang;

    const statusClass =
      t.status === "Lunas" ? "status-lunas" : t.status === "Belum Lunas" ? "status-belum-lunas" : t.status === "Diubah" ? "status-diubah" : "status-default";

    const statusClickable =
      t.status === "Belum Lunas"
        ? 'onclick="lunaskanTransaksi(' + t.id + ')" style="cursor: pointer;" title="Klik untuk melunaskan"'
        : "";

    const infoBayar =
      t.sisa > 0
        ? '<div style="font-size: 10px; color: #f59e0b; margin-top: 2px;">' +
          "Bayar: " +
          formatRupiah(t.bayar) +
          " | Sisa: " +
          formatRupiah(t.sisa) +
          "</div>"
        : "";

    // ✅ Tambahkan badge "HARI SEBELUMNYA" untuk transaksi belum lunas
    const dateBadge = isPrevious 
      ? '<div style="background: #f59e0b; color: white; padding: 2px 6px; border-radius: 3px; font-size: 10px; display: inline-block; margin-left: 5px;">HARI SEBELUMNYA</div>'
      : '';

    return (
      '<tr class="' + (isPrevious ? 'previous-unpaid-row' : '') + '">' +
      "<td>" +
      formatDate(t.tanggal) + " " +
      formatDateTime(t.waktu).slice(-8) +
      dateBadge +
      "</td>" +
      "<td>" +
      t.nama +
      "</td>" +
      '<td class="barang-list-cell">' +
      barangList +
      "</td>" +
      "<td>" +
      formatRupiah(t.total) +
      infoBayar +
      "</td>" +
      '<td><span class="' +
      statusClass +
      '" ' +
      statusClickable +
      ">" +
      t.status +
      (t.status === "Belum Lunas" ? " 🔄" : "") +
      "</span></td>" +
      "<td>" +
      t.catatan +
      "</td>" +
      "<td>" +
      '<button class="btn-print" onclick="printInvoice(' +
      t.id +
      ')">' +
      '<i class="fas fa-print"></i>' +
      "</button>" +
      "</td>" +
      "</tr>"
    );
  }

  return "";
    }        

window.lunaskanTransaksi = async function (transactionId) {
  const isCurrentlyOnline = isOnline();
  
  if (!isCurrentlyOnline) {
    alert(
      "❌ Pelunasan Memerlukan Koneksi Online\n\n" +
      "Fitur pelunasan memerlukan sinkronisasi real-time.\n" +
      "Silakan coba lagi saat koneksi internet tersedia."
    );
    return;
  }

  const searchId = transactionId.toString();
  const transaction = transaksiData.find((t) => t.id.toString() === searchId);

  if (!transaction) {
    alert("❌ Transaksi tidak ditemukan!");
    return;
  }

  if (transaction.status !== "Belum Lunas") {
    alert("❌ Transaksi ini sudah lunas!");
    return;
  }

  const sisaTagihan = transaction.sisa || 0;
  const totalBelanja = transaction.total;
  const sudahDibayar = transaction.bayar || 0;

  const jumlahBayar = prompt(
    "💰 Pelunasan / Cicilan Tagihan\n\n" +
      "Pelanggan: " +
      transaction.nama +
      "\n" +
      "Total Belanja: " +
      formatRupiah(totalBelanja) +
      "\n" +
      "Sudah Dibayar: " +
      formatRupiah(sudahDibayar) +
      "\n" +
      "Sisa Tagihan: " +
      formatRupiah(sisaTagihan) +
      "\n\n" +
      "Masukkan jumlah pembayaran:\n" +
      "(Boleh kurang dari sisa untuk cicilan)"
  );

  if (!jumlahBayar) return;

  const pembayaran = parseFloat(jumlahBayar);

  if (isNaN(pembayaran) || pembayaran <= 0) {
    alert("❌ Jumlah pembayaran tidak valid!");
    return;
  }

  if (pembayaran > sisaTagihan) {
    alert("⚠️ Pembayaran melebihi sisa tagihan!\nSisa tagihan: " + formatRupiah(sisaTagihan));
    return;
  }

  const sisaBaru = sisaTagihan - pembayaran;
  const totalDibayar = sudahDibayar + pembayaran;
  const kembalian = pembayaran > sisaTagihan ? pembayaran - sisaTagihan : 0;
  const statusBaru = sisaBaru > 0 ? "Belum Lunas" : "Lunas";

  const konfirmasiText = sisaBaru > 0 
    ? "✅ Konfirmasi Cicilan\n\n" +
      "Dibayar Sekarang: " + formatRupiah(pembayaran) + "\n" +
      "Total Sudah Dibayar: " + formatRupiah(totalDibayar) + "\n" +
      "Sisa Tagihan: " + formatRupiah(sisaBaru) + "\n" +
      "Status: BELUM LUNAS (Cicilan)\n\n" +
      "Lanjutkan?"
    : "✅ Konfirmasi Pelunasan\n\n" +
      "Dibayar Sekarang: " + formatRupiah(pembayaran) + "\n" +
      "Total Sudah Dibayar: " + formatRupiah(totalDibayar) + "\n" +
      "Kembalian: " + formatRupiah(kembalian) + "\n" +
      "Status: LUNAS\n\n" +
      "Lanjutkan?";

  const confirmed = confirm(konfirmasiText);

  if (!confirmed) return;

  try {
    showLoading(true);

    // Update catatan dengan riwayat pembayaran
    const catatanPembayaran = sisaBaru > 0
      ? " | 💰 Cicilan: " + formatRupiah(pembayaran) + " pada " + formatDateTime(getNowWIB()) + " (Sisa: " + formatRupiah(sisaBaru) + ")"
      : " | ✅ Dilunaskan: " + formatRupiah(pembayaran) + " pada " + formatDateTime(getNowWIB()) + (kembalian > 0 ? " (Kembalian: " + formatRupiah(kembalian) + ")" : "");

    const updatedTransaction = {
      ...transaction,
      status: statusBaru,
      bayar: totalDibayar,
      sisa: sisaBaru,
      catatan: (transaction.catatan || "") + catatanPembayaran,
    };

    await saveTransaksiData([updatedTransaction], []);

    const [barang, transaksi, deposit] = await Promise.all([
      loadBarangData(),
      loadTransaksiData(),
      loadDepositData(),
    ]);

    barangData = barang;
    transaksiData = Array.isArray(transaksi) ? transaksi : transaksi.transactions || [];
    depositData = deposit;

    const alertMessage = sisaBaru > 0
      ? "✅ Cicilan berhasil dicatat!\n\n" +
        "Pelanggan: " + transaction.nama + "\n" +
        "Dibayar: " + formatRupiah(pembayaran) + "\n" +
        "Total Terbayar: " + formatRupiah(totalDibayar) + "\n" +
        "Sisa Tagihan: " + formatRupiah(sisaBaru) + "\n" +
        "Status: BELUM LUNAS\n\n" +
        "💡 Klik lagi status 'Belum Lunas' untuk cicilan berikutnya."
      : "✅ Transaksi berhasil dilunaskan!\n\n" +
        "Pelanggan: " + transaction.nama + "\n" +
        "Dibayar: " + formatRupiah(pembayaran) + "\n" +
        "Total Terbayar: " + formatRupiah(totalDibayar) + "\n" +
        "Kembalian: " + formatRupiah(kembalian) + "\n" +
        "Status: LUNAS";

    alert(alertMessage);

    renderTodayTransactionsTable();
  } catch (error) {
    alert("❌ Gagal memproses pembayaran. Silakan coba lagi.\n\nError: " + error.message);
  } finally {
    showLoading(false);
  }
};

window.printInvoice = async function (transactionIdOrName) {
  const searchId = transactionIdOrName.toString();

  let transaction = transaksiData.find((t) => t.id.toString() === searchId && t.stokSource === STORE_ID);

  if (!transaction && typeof transactionIdOrName === "string" && isNaN(transactionIdOrName)) {
    const searchName = transactionIdOrName.toLowerCase();
    const matches = transaksiData.filter((t) => t.jenis === "Pemasukan" && t.stokSource === STORE_ID && t.nama.toLowerCase().includes(searchName));

    if (matches.length === 0) {
      alert("❌ Transaksi tidak ditemukan di " + STORE_ID + "!");
      return;
    } else if (matches.length === 1) {
      transaction = matches[0];
    } else {
      const options = matches
        .map((t, idx) => idx + 1 + ". " + t.nama + " - " + safeFormatDate(t.tanggal) + " - " + safeFormatRupiah(t.total))
        .join("\n");

      const choice = prompt(
        "Ditemukan " +
          matches.length +
          " transaksi dengan nama tersebut di " +
          STORE_ID +
          ".\n" +
          "Pilih nomor transaksi yang ingin dicetak:\n\n" +
          options +
          "\n\n" +
          "Masukkan nomor (1-" +
          matches.length +
          "):"
      );

      const choiceNum = parseInt(choice);
      if (choiceNum >= 1 && choiceNum <= matches.length) {
        transaction = matches[choiceNum - 1];
      } else {
        alert("❌ Pilihan tidak valid!");
        return;
      }
    }
  }

  if (!transaction) {
    alert("❌ Transaksi tidak ditemukan di " + STORE_ID + "!");
    return;
  }

  if (transaction.stokSource !== STORE_ID) {
    alert("❌ Transaksi ini dilakukan di " + transaction.stokSource + ", tidak bisa dicetak di " + STORE_ID + "!");
    return;
  }

  if (transaction.jenis !== "Pemasukan") {
    alert("❌ Hanya transaksi pemasukan yang bisa dicetak!");
    return;
  }

  // ✅ Helper functions yang dibutuhkan
  function formatAngkaBulat(angka) {
    return Math.round(angka).toLocaleString("id-ID");
  }

  function safeFormatDate(dateStr) {
    if (!dateStr) return "-";
    try {
      return formatDate(dateStr);
    } catch (e) {
      return dateStr;
    }
  }

  function safeFormatRupiah(angka) {
    if (!angka && angka !== 0) return "Rp 0";
    try {
      return formatRupiah(angka);
    } catch (e) {
      return "Rp " + formatAngkaBulat(angka);
    }
  }

  function safeTerbilang(angka) {
    if (!angka && angka !== 0) return "nol";
    try {
      return terbilang(angka);
    } catch (e) {
      return "(" + formatAngkaBulat(angka) + ")";
    }
  }

  function safeGetDisplayLabel(item, barangData) {
    try {
      return getDisplayLabel(item, barangData);
    } catch (e) {
      return item.typeBarang === "kelompok" ? "Kelompok" : "Turunan";
    }
  }

  // ✅ Definisikan NOMOR_TOKO berdasarkan STORE_ID
  const NOMOR_TOKO = STORE_ID === "BM1" ? "1" : "2";
  
  const alamatToko =
    STORE_ID === "BM1" ? "Dsn V (P7), Desa Sei Alim Ulu, Kec. Air Batu" : "Jalinsum Desa Air Teluk Hessa, Kec. Teluk Dalam";

  const noFaktur = transaction.noStruk || transaction.id;
  const tglFaktur = safeFormatDate(transaction.tanggal);
  const namaPelanggan = transaction.nama && transaction.nama.trim() !== "" ? transaction.nama : "NO NAME";
  const alamatPelanggan = transaction.alamat && transaction.alamat.trim() !== "" && transaction.alamat !== "-" ? transaction.alamat : "-";

  let itemsContent = "";
  let totalQty = 0;
  let subtotalSebelumDiskon = 0;
  let totalDiskon = 0;

  if (transaction.items && transaction.items.length > 0) {
    transaction.items.forEach((item, i) => {
      const typeLabel = safeGetDisplayLabel(item, barangData);
      const hargaSatuan = item.harga;
      const qtyItem = item.qty;
      const jumlahSebelumDiskon = hargaSatuan * qtyItem;

      const diskonPersen = item.diskonPersen || 0;
      const diskonRupiah = Math.round(item.diskonRupiah || 0);
      const jumlahItem = jumlahSebelumDiskon - diskonRupiah;

      subtotalSebelumDiskon += jumlahSebelumDiskon;
      totalDiskon += diskonRupiah;
      totalQty += qtyItem;

      const rowStyle = diskonRupiah > 0 ? "padding-left: 5px;" : "";

      itemsContent +=
        '<div style="display: flex; margin-bottom: 3px; ' +
        rowStyle +
        '">' +
        '<div style="width: 30px; text-align: center;">' +
        (i + 1) +
        "</div>" +
        '<div style="width: 80px;">' +
        item.id +
        "</div>" +
        '<div style="flex: 1;">' +
        item.nama +
        "</div>" +
        '<div style="width: 80px; text-align: right;">' +
        qtyItem +
        " " +
        typeLabel +
        "</div>" +
        '<div style="width: 70px; text-align: right;">' +
        formatAngkaBulat(hargaSatuan) +
        "</div>" +
        '<div style="width: 70px; text-align: right; ' +
        (diskonPersen > 0 ? "color: #dc2626; font-weight: 600;" : "") +
        '">' +
        diskonPersen.toFixed(1) +
        "</div>" +
        '<div style="width: 90px; text-align: right; ' +
        (diskonRupiah > 0 ? "color: #dc2626; font-weight: 600;" : "") +
        '">' +
        formatAngkaBulat(diskonRupiah) +
        "</div>" +
        '<div style="width: 110px; text-align: right; font-weight: bold;">' +
        formatAngkaBulat(jumlahItem) +
        "</div>" +
        "</div>";
    });
  }

  const grandTotal = transaction.total;
  const jumlahDibayar = transaction.bayar || 0;
  const sisaTagihan = transaction.sisa || 0;
  const statusPembayaran = transaction.status || "Lunas";

  const statusColor = statusPembayaran === "Lunas" ? "#10b981" : "#f59e0b";

  // ✅ PERBAIKAN: Buat HTML sebagai string terlebih dahulu
  const htmlContent = `<!DOCTYPE html>
<html>
<head>
  <title>Faktur Penjualan - ${namaPelanggan}</title>
  <style>
    @media print {
      @page { margin: 0.5cm; size: A4; }
      body { margin: 0; }
    }
    body {
      font-family: "Courier New", monospace;
      font-size: 11px;
      line-height: 1.3;
      color: #000;
      padding: 10px;
    }
    .header {
      display: flex;
      justify-content: space-between;
      margin-bottom: 15px;
      border-bottom: 1px solid #000;
      padding-bottom: 10px;
      align-items: center;
    }
    .company-logo {
      width: 80px;
      height: 80px;
      object-fit: contain;
      margin-right: 15px;
    }
    .company-info-wrapper {
      display: flex;
      align-items: center;
      flex: 1;
    }
    .company-info {
      flex: 1;
    }
    .company-name {
      font-weight: bold;
      font-size: 14px;
      margin-bottom: 3px;
    }
    .invoice-info {
      text-align: right;
      flex: 1;
    }
    .invoice-title {
      font-weight: bold;
      font-size: 16px;
      margin-bottom: 5px;
    }
    .customer-info {
      margin: 10px 0;
      display: flex;
      justify-content: space-between;
    }
    .items-header {
      display: flex;
      font-weight: bold;
      border-top: 1px solid #000;
      border-bottom: 1px solid #000;
      padding: 5px 0;
      margin: 10px 0;
    }
    .items-content {
      min-height: 200px;
    }
    .summary {
      margin-top: 20px;
      border-top: 1px solid #000;
      padding-top: 10px;
    }
    .summary-row {
      display: flex;
      justify-content: flex-end;
      margin-bottom: 3px;
    }
    .summary-label {
      width: 150px;
      text-align: right;
      padding-right: 20px;
    }
    .summary-value {
      width: 150px;
      text-align: right;
      font-weight: bold;
    }
    .footer {
      margin-top: 30px;
      border-top: 1px solid #000;
      padding-top: 10px;
    }
    .footer-row {
      display: flex;
      justify-content: space-between;
      margin-bottom: 3px;
    }
    .signatures {
      display: flex;
      justify-content: space-around;
      margin-top: 50px;
    }
    .signature-box {
      text-align: center;
      width: 150px;
    }
    .signature-line {
      border-bottom: 1px solid #000;
      height: 60px;
      margin-bottom: 5px;
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="company-info-wrapper">
      <img src="icon (1).jpeg" alt="Logo" class="company-logo" onerror="this.style.display='none'">
      <div class="company-info">
        <div class="company-name">BERKAH MANDIRI ${NOMOR_TOKO}</div>
        <div>Menjual: Segala Jenis Material Bangunan</div>
        <div>${alamatToko}</div>
        <div>Telp : 085275174814 - 085372063988</div>
      </div>
    </div>
    <div class="invoice-info">
      <div class="invoice-title">FAKTUR PENJUALAN</div>
    </div>
  </div>
  
  <div class="customer-info">
    <div>
      <div>Tanggal : ${tglFaktur}</div>
      <div>Faktur : ${noFaktur}</div>
    </div>
    <div style="text-align: right;">
      <div>Pelanggan : ${namaPelanggan}</div>
      <div>Alamat : ${alamatPelanggan}</div>
    </div>
  </div>
  
  <div class="items-header">
    <div style="width: 30px; text-align: center;">NO</div>
    <div style="width: 80px;">Kode</div>
    <div style="flex: 1;">Nama</div>
    <div style="width: 80px; text-align: right;">Qty</div>
    <div style="width: 70px; text-align: right;">Harga</div>
    <div style="width: 70px; text-align: right;">Dis.(%)</div>
    <div style="width: 90px; text-align: right;">Disk.(Rp)</div>
    <div style="width: 110px; text-align: right;">Netto</div>
  </div>
  
  <div class="items-content">
    ${itemsContent}
  </div>
  
  <div style="border-top: 1px solid #000; padding-top: 5px; margin-top: 10px;">
    <div style="display: flex; justify-content: space-between; align-items: center;">
      <div><strong>Jumlah :</strong> ${transaction.items.length} Item | <strong>Total Qty :</strong> ${formatAngkaBulat(totalQty)}</div>
    </div>
  </div>
  
  <div class="summary">
    ${totalDiskon > 0 ? `
    <div class="summary-row">
      <div class="summary-label">Subtotal :</div>
      <div class="summary-value">${formatAngkaBulat(subtotalSebelumDiskon)}</div>
    </div>
    <div class="summary-row">
      <div class="summary-label">Total Diskon :</div>
      <div class="summary-value" style="color: #dc2626;">- ${formatAngkaBulat(totalDiskon)}</div>
    </div>` : ''}
    <div class="summary-row" style="border-top: 1px solid #000; margin-top: 5px; padding-top: 5px;">
      <div class="summary-label">Grand Total :</div>
      <div class="summary-value" style="font-size: 13px;">${formatAngkaBulat(grandTotal)}</div>
    </div>
    <div class="summary-row">
      <div class="summary-label">Dibayar :</div>
      <div class="summary-value">${formatAngkaBulat(jumlahDibayar)}</div>
    </div>
    ${sisaTagihan > 0 ? `
    <div class="summary-row">
      <div class="summary-label">Sisa Tagihan :</div>
      <div class="summary-value" style="color: #f59e0b;">${formatAngkaBulat(sisaTagihan)}</div>
    </div>` : ''}
  </div>
  
  <div class="footer">
    <div class="footer-row">
      <div><strong>Terbilang :</strong> ${safeTerbilang(Math.round(grandTotal))} Rupiah</div>
    </div>
    <div class="footer-row">
      <div><strong>Status :</strong> <span style="color: ${statusColor}; font-weight: bold;">${statusPembayaran}</span></div>
    </div>
    <div class="footer-row">
      <div><strong>Memo :</strong> ${statusPembayaran === "Belum Lunas" ? "Harap lunasi sisa tagihan sebesar " + formatAngkaBulat(sisaTagihan) : "Terima kasih atas pembelian Anda"}</div>
    </div>
    <div class="signatures">
      <div class="signature-box">
        <div class="signature-line"></div>
        <div>Dibuat oleh</div>
      </div>
      <div class="signature-box">
        <div class="signature-line"></div>
        <div>Customer</div>
      </div>
    </div>
  </div>
</body>
</html>`;

  // ✅ PERBAIKAN: Gunakan cara yang lebih reliable
  const printWindow = window.open("", "_blank", "width=900,height=700");

  if (!printWindow) {
    alert("❌ Popup diblokir! Silakan izinkan popup untuk mencetak.");
    return;
  }

  // ✅ Tulis konten dan tunggu hingga siap
  printWindow.document.open();
  printWindow.document.write(htmlContent);
  printWindow.document.close();

  // ✅ Tunggu hingga dokumen benar-benar ter-load
  printWindow.onload = function() {
    setTimeout(() => {
      printWindow.focus();
      printWindow.print();
    }, 250);
  };

  // ✅ Fallback jika onload tidak trigger
  setTimeout(() => {
    if (printWindow.document.readyState === 'complete') {
      printWindow.focus();
      printWindow.print();
    }
  }, 500);
};

function initListBarangSearch() {
  const searchInput = document.getElementById("searchBarangList");
  const btnSearch = document.getElementById("btnSearchList");

  if (!searchInput || !btnSearch) return;

  function performSearchList() {
    const query = searchInput.value.toLowerCase().trim();
    let results = barangData.filter((b) => {
      const jenis = b.jenisTransaksi || "Penambahan Barang Baru";
      return jenis === "Penambahan Barang Baru";
    });

    if (query) {
      results = results.filter((b) => b.id.toLowerCase().includes(query) || b.nama.toLowerCase().includes(query));
    }

    renderListBarangTable(results);
  }

  btnSearch.addEventListener("click", performSearchList);
  searchInput.addEventListener("keyup", (e) => {
    if (e.key === "Enter") {
      performSearchList();
    } else if (searchInput.value.length > 2 || searchInput.value.length === 0) {
      performSearchList();
    }
  });
}

function renderListBarangTable(data) {
  const tbody = document.getElementById("listBarangTableBody");
  if (!tbody) return;

  // ✅ FILTER: Hanya tampilkan "Penambahan Barang Baru" yang masih punya stok
  const filteredData = data.filter((item) => {
    const jenis = item.jenisTransaksi || "Penambahan Barang Baru";
    
    // Hanya tampilkan "Tambah Barang Baru"
    if (jenis !== "Penambahan Barang Baru") return false;
    
    // ✅ Opsional: Filter yang total stok gabungan > 0
    // const banyakItem = item.banyakItemPerTurunan || 1;
    // const totalStokBM1 = (item.stokKelompokBM1 || 0) * banyakItem + (item.stokTurunanBM1 || 0);
    // const totalStokBM2 = (item.stokKelompokBM2 || 0) * banyakItem + (item.stokTurunanBM2 || 0);
    // return (totalStokBM1 + totalStokBM2) > 0;
    
    return true;
  });

  if (filteredData.length === 0) {
    tbody.innerHTML = '<tr><td colspan="9" class="table-empty">Tidak ada data barang yang ditemukan.</td></tr>';
    return;
  }

  tbody.innerHTML = data
    .map((item) => {
      const kelompokLabel = getKelompokLabel(item.jenisKelompok || "Satuan");
      const turunanLabel = item.jenisTurunan || getSatuanTurunanLabel(item.jenisKelompok || "Satuan");

      const banyakItem = item.banyakItemPerTurunan || 1;

      const stokKelompokToko = STORE_ID === "BM1" ? item.stokKelompokBM1 || 0 : item.stokKelompokBM2 || 0;
      const stokTurunanToko = STORE_ID === "BM1" ? item.stokTurunanBM1 || 0 : item.stokTurunanBM2 || 0;
      const totalStokToko = stokKelompokToko * banyakItem + stokTurunanToko;

      const totalStokBM1 = (item.stokKelompokBM1 || 0) * banyakItem + (item.stokTurunanBM1 || 0);
      const totalStokBM2 = (item.stokKelompokBM2 || 0) * banyakItem + (item.stokTurunanBM2 || 0);
      const totalStokGabungan = totalStokBM1 + totalStokBM2;

      return `<tr>
        <td>${item.id}</td>
        <td>${formatDate(item.tanggal)}</td>
        <td>${item.nama}</td>
        <td>${formatRupiah(item.hargaJualKelompok)}</td>
        <td>${formatRupiah(item.hargaJualTurunan)}</td>
        <td>${stokKelompokToko} ${kelompokLabel}</td>
        <td>${stokTurunanToko} ${turunanLabel}</td>
        <td><strong>${totalStokToko} ${turunanLabel}</strong></td>
        <td><strong style="color: #3b82f6;">${totalStokGabungan} ${turunanLabel}</strong></td>
      </tr>`;
    })
    .join("");
}

function resetRefundProcess() {
  activeRefundTransaction = null;
  refundItems = [];
  addedExchangeItems = [];

  const refundProcessSection = document.getElementById("refundProcessSection");
  if (refundProcessSection) {
    refundProcessSection.style.display = "none";
  }

  const searchRefundName = document.getElementById("searchRefundName");
  const searchRefundDate = document.getElementById("searchRefundDate");
  const searchBarangRefund = document.getElementById("searchBarangRefund");
  const refundNote = document.getElementById("refundNote");

  if (searchRefundName) searchRefundName.value = "";
  if (searchRefundDate) searchRefundDate.value = "";
  if (searchBarangRefund) searchBarangRefund.value = "";
  if (refundNote) refundNote.value = "";

  const refundTransactionTableBody = document.getElementById("refundTransactionTableBody");
  const searchResultsRefund = document.getElementById("searchResultsRefund");

  if (refundTransactionTableBody) {
    refundTransactionTableBody.innerHTML = '<tr><td colspan="5" class="table-empty">Cari transaksi untuk memulai proses.</td></tr>';
  }
  if (searchResultsRefund) searchResultsRefund.innerHTML = "";

  const refundRefundTotal = document.getElementById("refundRefundTotal");
  const refundExchangeTotal = document.getElementById("refundExchangeTotal");
  const refundDifference = document.getElementById("refundDifference");

  if (refundRefundTotal) refundRefundTotal.textContent = formatRupiah(0);
  if (refundExchangeTotal) refundExchangeTotal.textContent = formatRupiah(0);
  if (refundDifference) {
    refundDifference.textContent = formatRupiah(0);
    refundDifference.className = "total-neutral";
  }
}

function initRefundSearch() {
  const btnSearchRefund = document.getElementById("btnSearchRefund");
  const searchRefundName = document.getElementById("searchRefundName");
  const searchRefundDate = document.getElementById("searchRefundDate");
  const btnSearchRefundAdd = document.getElementById("btnSearchRefundAdd");
  const searchBarangRefund = document.getElementById("searchBarangRefund");
  const refundTypeSelector = document.getElementById("refundTypeSelector");
  const btnFinishRefund = document.getElementById("btnFinishRefund");

  if (btnSearchRefund) {
    btnSearchRefund.addEventListener("click", performRefundSearch);
  }

  if (searchRefundName) {
    searchRefundName.addEventListener("keyup", (e) => {
      if (e.key === "Enter") performRefundSearch();
    });
  }

  if (searchRefundDate) {
    searchRefundDate.addEventListener("change", performRefundSearch);
  }

  if (btnSearchRefundAdd) {
    btnSearchRefundAdd.addEventListener("click", performRefundAddSearch);
  }

  if (searchBarangRefund) {
    searchBarangRefund.addEventListener("keyup", (e) => {
      if (e.key === "Enter" || searchBarangRefund.value.length > 2) {
        performRefundAddSearch();
      }
    });
  }

  if (refundTypeSelector) {
    refundTypeSelector.addEventListener("change", (e) => {
      updateRefundDisplay(e.target.value);
      updateRefundTotals();
    });
  }

  if (btnFinishRefund) {
    btnFinishRefund.addEventListener("click", finishRefundProcess);
  }

  updateRefundDisplay("refund");
}

function updateRefundDisplay(type) {
  const isRefund = type === "refund";
  const exchangeTotalRow = document.getElementById("exchangeTotalRow");
  const exchangeAddSection = document.getElementById("exchangeAddSection");
  const diffRowSpan = document.getElementById("refundDiffRow")?.querySelector("span");

  if (exchangeTotalRow) {
    exchangeTotalRow.style.display = isRefund ? "none" : "flex";
  }

  if (exchangeAddSection) {
    exchangeAddSection.style.display = isRefund ? "none" : "block";
  }

  if (diffRowSpan) {
    diffRowSpan.textContent = isRefund ? "Uang Kembali (Nilai Dikembalikan):" : "Selisih (Uang Keluar/Masuk):";
  }
}

function performRefundSearch() {
  const searchRefundName = document.getElementById("searchRefundName");
  const searchRefundDate = document.getElementById("searchRefundDate");

  const queryName = searchRefundName?.value.toLowerCase().trim() || "";
  const queryDate = searchRefundDate?.value || "";

  const results = transaksiData
    .filter(
      (t) =>
        t.jenis === "Pemasukan" &&
        t.status !== "Dibatalkan" &&
        t.stokSource === STORE_ID &&
        (queryName === "" || t.nama.toLowerCase().includes(queryName)) &&
        (queryDate === "" || t.tanggal === queryDate)
    )
    .sort((a, b) => new Date(b.waktu) - new Date(a.waktu));

  renderRefundTransactionList(results);
}

function renderRefundTransactionList(results) {
  const tbody = document.getElementById("refundTransactionTableBody");

  if (!tbody) return;

  if (results.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" class="table-empty">Transaksi tidak ditemukan.</td></tr>';
    return;
  }

  tbody.innerHTML = results
    .map((t) => {
      const barang = t.items
        ? t.items.map((item) => item.nama + " (" + item.qty + ") [" + (item.stokSource || STORE_ID) + "]").join(", ")
        : t.barang || "-";

      return (
        "<tr>" +
        "<td>" +
        formatDate(t.tanggal) +
        " " +
        formatDateTime(t.waktu).slice(-8) +
        "</td>" +
        "<td>" +
        t.nama +
        "</td>" +
        "<td>" +
        formatRupiah(t.total) +
        "</td>" +
        "<td>" +
        barang +
        "</td>" +
        "<td>" +
        '<button class="btn-primary btn-select-refund" onclick="selectTransactionForRefund(' +
        t.id +
        ')">' +
        "Pilih" +
        "</button>" +
        "</td>" +
        "</tr>"
      );
    })
    .join("");
}

window.selectTransactionForRefund = async function (transactionIdOrName) {
  const searchId = transactionIdOrName.toString();

  let transaction = transaksiData.find((t) => t.id.toString() === searchId && t.stokSource === STORE_ID);

  if (!transaction && typeof transactionIdOrName === "string" && isNaN(transactionIdOrName)) {
    const searchName = transactionIdOrName.toLowerCase();
    const matches = transaksiData.filter(
      (t) => t.jenis === "Pemasukan" && t.status !== "Dibatalkan" && t.stokSource === STORE_ID && t.nama.toLowerCase().includes(searchName)
    );

    if (matches.length === 0) {
      alert("❌ Transaksi tidak ditemukan di " + STORE_ID + "!");
      return;
    } else if (matches.length === 1) {
      transaction = matches[0];
    } else {
      const options = matches
        .map((t, idx) => {
          const barang = t.items ? t.items.map((item) => item.nama + " (" + item.qty + ")").join(", ") : t.barang || "-";
          return idx + 1 + ". " + t.nama + " - " + formatDate(t.tanggal) + " - " + formatRupiah(t.total) + "\n   Barang: " + barang;
        })
        .join("\n\n");

      const choice = prompt(
        "Ditemukan " +
          matches.length +
          " transaksi dengan nama tersebut di " +
          STORE_ID +
          ".\n" +
          "Pilih nomor transaksi untuk diproses:\n\n" +
          options +
          "\n\n" +
          "Masukkan nomor (1-" +
          matches.length +
          "):"
      );

      const choiceNum = parseInt(choice);
      if (choiceNum >= 1 && choiceNum <= matches.length) {
        transaction = matches[choiceNum - 1];
      } else {
        alert("❌ Pilihan tidak valid!");
        return;
      }
    }
  }

  if (!transaction) {
    alert("❌ Transaksi tidak ditemukan di " + STORE_ID + "!");
    return;
  }

  if (transaction.stokSource !== STORE_ID) {
    alert("❌ Transaksi ini dilakukan di " + transaction.stokSource + ", tidak bisa diproses di " + STORE_ID + "!");
    return;
  }

  activeRefundTransaction = transaction;

  if (transaction.items && transaction.items.length > 0) {
    refundItems = transaction.items
      .filter((item) => item.qty > 0)
      .map((item) => ({
        id: item.id,
        nama: item.nama,
        harga: item.harga,
        qty: item.qty,
        isKotak: item.typeBarang === "kelompok",
        typeBarang: item.typeBarang || (item.isKotak ? "kelompok" : "turunan"),
        hargaModalUnit: item.hargaModalUnit || 0,
        qtyOriginal: item.qtyOriginal || item.qty,
        isRefunded: true,
        isTukar: false,
        stokSource: item.stokSource || STORE_ID,
        jenisKelompok: item.jenisKelompok || "Satuan",
        banyakItemPerTurunan: item.banyakItemPerTurunan || 1,
        jenisTurunan: item.jenisTurunan || "satuan",
      }));
  } else {
    alert("❌ Transaksi ini tidak memiliki detail barang!");
    return;
  }

  addedExchangeItems = [];

  const refundTypeSelector = document.getElementById("refundTypeSelector");
  if (refundTypeSelector) {
    refundTypeSelector.value = "refund";
  }

  const refundOriginalTransInfo = document.getElementById("refundOriginalTransInfo");
  if (refundOriginalTransInfo) {
    refundOriginalTransInfo.textContent =
      transaction.nama + " (" + formatDate(transaction.tanggal) + " - " + formatRupiah(transaction.total) + ")";
  }

  const refundProcessSection = document.getElementById("refundProcessSection");
  if (refundProcessSection) {
    refundProcessSection.style.display = "block";
  }

  updateRefundDisplay("refund");
  renderRefundItems();
  updateRefundTotals();
};

function renderRefundItems() {
  const container = document.getElementById("refundItems");
  if (!container) return;

  const allItems = [...refundItems, ...addedExchangeItems];

  if (allItems.length === 0) {
    container.innerHTML = '<p class="refund-empty">Tidak ada barang dalam proses.</p>';
    updateRefundTotals();
    return;
  }

  container.innerHTML = allItems
    .map((item, globalIndex) => {
      const isRefund = item.isRefunded;
      const subtotal = item.harga * item.qty;

      const localIndex = isRefund ? globalIndex : globalIndex - refundItems.length;

      const maxStock = isRefund
        ? item.qtyOriginal
        : (() => {
            const barang = barangData.find((b) => b.id === item.id);
            if (!barang) return item.qty;
            const banyakItem = barang.banyakItemPerTurunan || 1;
            const stokKelompok = item.stokSource === "BM1" ? barang.stokKelompokBM1 || 0 : barang.stokKelompokBM2 || 0;
            const stokTurunan = item.stokSource === "BM1" ? barang.stokTurunanBM1 || 0 : barang.stokTurunanBM2 || 0;
            return stokKelompok * banyakItem + stokTurunan;
          })();

      const borderClass = isRefund ? "refund-item-border" : "exchange-item-border";
      const labelQty = isRefund ? "Dikembalikan" : "Dibeli";
      const labelHeader = isRefund ? "(Awal - Dikembalikan)" : "(Tambah - Dibeli)";
      const updateQtyFunc = isRefund ? "updateRefundItemQty(" + localIndex + ", this.value)" : "updateExchangeItemQty(" + localIndex + ", this.value)";
      const updatePriceFunc = isRefund
        ? "updateRefundItemPrice(" + localIndex + ", this.value)"
        : "updateExchangeItemPrice(" + localIndex + ", this.value)";
      const removeFunc = isRefund ? "removeRefundItem(" + localIndex + ")" : "removeExchangeItem(" + localIndex + ")";

      const stokBadge = item.stokSource
        ? '<span class="stok-badge stok-' + item.stokSource.toLowerCase() + '">' + item.stokSource + "</span>"
        : "";

      const typeLabel = item.typeBarang === "kelompok" ? "Kelompok" : "Turunan";

      return (
        '<div class="cart-item ' +
        borderClass +
        '">' +
        '<div class="cart-item-header">' +
        '<span class="cart-item-name">' +
        item.nama +
        " " +
        labelHeader +
        " " +
        stokBadge +
        " <small>(" +
        typeLabel +
        ")</small></span>" +
        '<button class="btn-remove" onclick="' +
        removeFunc +
        '">' +
        '<i class="fas fa-trash"></i>' +
        "</button>" +
        "</div>" +
        '<div class="cart-item-controls">' +
        '<div class="qty-control">' +
        "<label>" +
        labelQty +
        ":</label>" +
        '<input type="number" class="qty-input qty-input-small" value="' +
        item.qty +
        '" ' +
        'onchange="' +
        updateQtyFunc +
        '" ' +
        'min="1" max="' +
        maxStock +
        '">' +
        "</div>" +
        '<div class="price-control-group">' +
        "<label>Harga Satuan:</label>" +
        '<input type="number" class="price-manual-input price-input-medium" value="' +
        item.harga +
        '" ' +
        'onchange="' +
        updatePriceFunc +
        '" placeholder="Harga">' +
        "</div>" +
        "</div>" +
        '<div class="cart-item-total cart-item-subtotal-row">' +
        "<span>Subtotal:</span>" +
        "<span>" +
        formatRupiah(subtotal) +
        "</span>" +
        "</div>" +
        "</div>"
      );
    })
    .join("");
}

window.updateRefundItemQty = function (index, value) {
  const qty = parseInt(value);
  const originalQty = refundItems[index].qtyOriginal;

  if (qty > 0 && qty <= originalQty) {
    refundItems[index].qty = qty;
    renderRefundItems();
    updateRefundTotals();
  } else if (qty > originalQty) {
    alert("❌ Jumlah pengembalian tidak boleh melebihi pembelian awal (" + originalQty + ")!");
    refundItems[index].qty = originalQty;
    renderRefundItems();
    updateRefundTotals();
  } else {
    alert("❌ Kuantitas minimal 1 untuk pengembalian!");
    refundItems[index].qty = 1;
    renderRefundItems();
    updateRefundTotals();
  }
};

window.updateRefundItemPrice = function (index, value) {
  const newPrice = parseFloat(value);
  if (!isNaN(newPrice) && newPrice >= 0) {
    refundItems[index].harga = newPrice;
    renderRefundItems();
    updateRefundTotals();
  } else {
    alert("❌ Harga tidak valid!");
    renderRefundItems();
  }
};

window.removeRefundItem = function (index) {
  refundItems.splice(index, 1);
  renderRefundItems();
  updateRefundTotals();
};

window.updateExchangeItemQty = function (index, value) {
  const qty = parseInt(value);
  if (qty > 0) {
    const barangAsli = barangData.find((b) => b.id === addedExchangeItems[index].id);
    if (!barangAsli) {
      alert("❌ Barang tidak ditemukan!");
      return;
    }

    const banyakItem = barangAsli.banyakItemPerTurunan || 1;
    const stokSource = addedExchangeItems[index].stokSource || STORE_ID;
    const stokKelompok = stokSource === "BM1" ? barangAsli.stokKelompokBM1 || 0 : barangAsli.stokKelompokBM2 || 0;
    const stokTurunan = stokSource === "BM1" ? barangAsli.stokTurunanBM1 || 0 : barangAsli.stokTurunanBM2 || 0;
    const maxStock = stokKelompok * banyakItem + stokTurunan;

    if (qty <= maxStock) {
      addedExchangeItems[index].qty = qty;
      renderRefundItems();
      updateRefundTotals();
    } else {
      alert("❌ Stok barang hanya tersedia " + maxStock + "!");
      addedExchangeItems[index].qty = maxStock > 0 ? maxStock : 1;
      renderRefundItems();
      updateRefundTotals();
    }
  } else {
    alert("❌ Kuantitas minimal 1!");
    addedExchangeItems[index].qty = 1;
    renderRefundItems();
    updateRefundTotals();
  }
};

window.updateExchangeItemPrice = function (index, value) {
  const newPrice = parseFloat(value);
  if (!isNaN(newPrice) && newPrice >= 0) {
    addedExchangeItems[index].harga = newPrice;
    renderRefundItems();
    updateRefundTotals();
  } else {
    alert("❌ Harga tidak valid!");
    renderRefundItems();
  }
};

window.removeExchangeItem = function (index) {
  addedExchangeItems.splice(index, 1);
  renderRefundItems();
  updateRefundTotals();
};

function performRefundAddSearch() {
  const searchInput = document.getElementById("searchBarangRefund");
  if (!searchInput) return;

  const query = searchInput.value.toLowerCase().trim();
  if (!query) {
    const resultsContainer = document.getElementById("searchResultsRefund");
    if (resultsContainer) resultsContainer.innerHTML = "";
    return;
  }

  const results = barangData.filter((b) => {
    const jenis = b.jenisTransaksi || "Penambahan Barang Baru";
    const isMainBarang = jenis === "Penambahan Barang Baru";
    return isMainBarang && (b.id.toLowerCase().includes(query) || b.nama.toLowerCase().includes(query));
  });

  renderRefundAddSearchResults(results);
}

function renderRefundAddSearchResults(results) {
  const container = document.getElementById("searchResultsRefund");
  if (!container) return;

  if (results.length === 0) {
    container.innerHTML = '<p class="search-empty-small">Barang tidak ditemukan</p>';
    return;
  }

  container.innerHTML = results
    .map((item) => {
      const banyakItem = item.banyakItemPerTurunan || 1;
      const totalStokBM1 = (item.stokKelompokBM1 || 0) * banyakItem + (item.stokTurunanBM1 || 0);
      const totalStokBM2 = (item.stokKelompokBM2 || 0) * banyakItem + (item.stokTurunanBM2 || 0);
      const totalStok = totalStokBM1 + totalStokBM2;

      return (
        '<div class="search-item search-item-small" onclick="addExchangeItem(\'' +
        item.id +
        "')\">" +
        item.nama +
        " - " +
        formatRupiah(item.hargaJualTurunan) +
        " (Stok: " +
        totalStok +
        ")" +
        "</div>"
      );
    })
    .join("");
}

window.addExchangeItem = function (itemId) {
  const barang = barangData.find((b) => b.id === itemId);
  if (!barang) return;

  const banyakItem = barang.banyakItemPerTurunan || 1;
  const stokKelompok = STORE_ID === "BM1" ? barang.stokKelompokBM1 || 0 : barang.stokKelompokBM2 || 0;
  const stokTurunan = STORE_ID === "BM1" ? barang.stokTurunanBM1 || 0 : barang.stokTurunanBM2 || 0;
  const maxStock = stokKelompok * banyakItem + stokTurunan;

  if (maxStock <= 0) {
    alert("❌ Stok barang habis!");
    return;
  }

  const hargaModalUnit = barang.modalBarang && banyakItem > 0 ? barang.modalBarang / banyakItem : barang.modalBarang || 0;

  addedExchangeItems.push({
    id: barang.id,
    nama: barang.nama,
    harga: barang.hargaJualTurunan,
    qty: 1,
    isKotak: false,
    typeBarang: "turunan",
    hargaModalUnit: hargaModalUnit,
    isRefunded: false,
    isTukar: true,
    qtyOriginal: 1,
    stokSource: STORE_ID,
    jenisKelompok: barang.jenisKelompok || "Satuan",
    banyakItemPerTurunan: banyakItem,
    jenisTurunan: barang.jenisTurunan || "satuan",
  });

  const searchResultsRefund = document.getElementById("searchResultsRefund");
  const searchBarangRefund = document.getElementById("searchBarangRefund");

  if (searchResultsRefund) searchResultsRefund.innerHTML = "";
  if (searchBarangRefund) searchBarangRefund.value = "";

  renderRefundItems();
  updateRefundTotals();
};

function updateRefundTotals() {
  const refundTypeSelector = document.getElementById("refundTypeSelector");
  const type = refundTypeSelector?.value || "refund";
  const isRefund = type === "refund";

  const refundTotalValue = refundItems.reduce((sum, item) => sum + item.harga * item.qty, 0);

  const exchangeTotalValue = isRefund ? 0 : addedExchangeItems.reduce((sum, item) => sum + item.harga * item.qty, 0);

  const netDifference = exchangeTotalValue - refundTotalValue;

  const refundRefundTotal = document.getElementById("refundRefundTotal");
  if (refundRefundTotal) {
    refundRefundTotal.textContent = formatRupiah(refundTotalValue);
  }

  const refundExchangeTotal = document.getElementById("refundExchangeTotal");
  if (refundExchangeTotal) {
    refundExchangeTotal.textContent = formatRupiah(exchangeTotalValue);
  }

  const refundDifference = document.getElementById("refundDifference");
  if (refundDifference) {
    if (isRefund) {
      refundDifference.textContent = formatRupiah(refundTotalValue);
      refundDifference.className = "total-danger";
    } else {
      refundDifference.textContent = formatRupiah(Math.abs(netDifference));

      if (netDifference > 0) {
        refundDifference.className = "total-success";
      } else if (netDifference < 0) {
        refundDifference.className = "total-danger";
      } else {
        refundDifference.className = "total-neutral";
      }
    }
  }
}

async function finishRefundProcess() {
  if (!activeRefundTransaction) {
    alert("❌ Silakan pilih transaksi terlebih dahulu.");
    return;
  }

  const isCurrentlyOnline = isOnline();
  
  if (!isCurrentlyOnline) {
    alert(
      "❌ Refund/Tukar Memerlukan Koneksi Online\n\n" +
      "Proses refund/tukar memerlukan sinkronisasi real-time.\n" +
      "Silakan coba lagi saat koneksi internet tersedia."
    );
    return;
  }

  const refundTypeSelector = document.getElementById("refundTypeSelector");
  const type = refundTypeSelector?.value || "refund";
  const isRefund = type === "refund";

  const refundNote = document.getElementById("refundNote");
  const note = refundNote?.value || "Proses " + (isRefund ? "Pengembalian" : "Penukaran") + " Barang dari " + STORE_ID + ".";

  const refundTotalValue = refundItems.reduce(function (sum, item) {
    return sum + item.harga * item.qty;
  }, 0);

  const exchangeTotalValue = isRefund
    ? 0
    : addedExchangeItems.reduce(function (sum, item) {
        return sum + item.harga * item.qty;
      }, 0);

  const netDifference = exchangeTotalValue - refundTotalValue;

  if (refundItems.length === 0 && addedExchangeItems.length === 0) {
    alert("❌ Tidak ada barang dalam proses refund/tukar.");
    return;
  }

  if (isRefund && refundTotalValue > activeRefundTransaction.total) {
    alert("❌ Nilai barang yang dikembalikan tidak boleh melebihi total transaksi awal.");
    return;
  }

  const diffText = netDifference > 0 ? "Pelanggan Menambah" : netDifference < 0 ? "Pelanggan Menerima" : "Tukar Setara";

  const confirmed = confirm(
    "Anda akan menyelesaikan proses " +
      (isRefund ? "Refund" : "Exchange") +
      " dari " +
      STORE_ID +
      ".\n\n" +
      "Nilai Dikembalikan: " +
      formatRupiah(refundTotalValue) +
      "\n" +
      "Nilai Barang Baru: " +
      formatRupiah(exchangeTotalValue) +
      "\n" +
      "Selisih Uang: " +
      formatRupiah(Math.abs(netDifference)) +
      " (" +
      diffText +
      ")\n\n" +
      "Lanjutkan?"
  );

  if (!confirmed) return;

  const affectedItemIds = new Set();
  refundItems.forEach((item) => affectedItemIds.add(item.id));
  addedExchangeItems.forEach((item) => affectedItemIds.add(item.id));

  const barangListRefund = refundItems
    .map(function (i) {
      const typeLabel = i.typeBarang === "kelompok" ? "Kelompok" : "Turunan";
      return i.nama + " (-" + i.qty + " " + typeLabel + ") [" + (i.stokSource || STORE_ID) + "]";
    })
    .join(", ");

  const barangListExchange = addedExchangeItems
    .map(function (i) {
      const typeLabel = i.typeBarang === "kelompok" ? "Kelompok" : "Turunan";
      return i.nama + " (+" + i.qty + " " + typeLabel + ") [" + (i.stokSource || STORE_ID) + "]";
    })
    .join(", ");

  const refundTrans = {
    id: Date.now() + 1,
    tanggal: getTodayWIB(),
    waktu: getNowWIB(),
    jenis: isRefund ? "Pengeluaran" : netDifference > 0 ? "Pemasukan" : netDifference < 0 ? "Pengeluaran" : "Pemasukan",
    nama: activeRefundTransaction.nama,
    alamat: activeRefundTransaction.alamat,
    banyaknya:
      refundItems.reduce(function (sum, item) {
        return sum + item.qty;
      }, 0) +
      addedExchangeItems.reduce(function (sum, item) {
        return sum + item.qty;
      }, 0),
    barang: barangListRefund + (addedExchangeItems.length > 0 ? ", " + barangListExchange : ""),
    total: isRefund ? refundTotalValue : Math.abs(netDifference),
    status: isRefund ? "Selesai" : netDifference === 0 ? "Tukar Setara" : "Selesai",
    catatan: note,
    items: refundItems.concat(addedExchangeItems),
    tipeAwal: activeRefundTransaction.id.toString(),
    tipeProses: type,
    netDifference: netDifference,
    stokSource: STORE_ID,
  };

  const originalTrans = JSON.parse(JSON.stringify(activeRefundTransaction));
  let newItemsOriginal = JSON.parse(JSON.stringify(originalTrans.items));

  refundItems.forEach(function (refundedItem) {
    const itemIndex = newItemsOriginal.findIndex(function (item) {
      return item.id === refundedItem.id;
    });
    if (itemIndex !== -1) {
      newItemsOriginal[itemIndex].qty -= refundedItem.qty;
    }
  });

  if (!isRefund && addedExchangeItems.length > 0) {
    addedExchangeItems.forEach(function (exchangeItem) {
      const existingIndex = newItemsOriginal.findIndex(function (item) {
        return item.id === exchangeItem.id;
      });
      if (existingIndex !== -1) {
        newItemsOriginal[existingIndex].qty += exchangeItem.qty;
      } else {
        newItemsOriginal.push({
          id: exchangeItem.id,
          nama: exchangeItem.nama,
          harga: exchangeItem.harga,
          qty: exchangeItem.qty,
          isKotak: exchangeItem.typeBarang === "kelompok",
          typeBarang: exchangeItem.typeBarang || "turunan",
          hargaModalUnit: exchangeItem.hargaModalUnit,
          qtyOriginal: exchangeItem.qty,
          isRefunded: false,
          isTukar: true,
          stokSource: exchangeItem.stokSource || STORE_ID,
        });
      }
    });
  }

  newItemsOriginal = newItemsOriginal.filter(function (item) {
    return item.qty > 0;
  });

  const newTotalAwal = newItemsOriginal.reduce(function (sum, item) {
    return sum + item.harga * item.qty;
  }, 0);

  originalTrans.status = "Diubah";
  originalTrans.catatan = "Diubah karena " + type + " dari " + STORE_ID + " (ID Proses: " + refundTrans.id + "): " + note;
  originalTrans.items = newItemsOriginal;
  originalTrans.total = newTotalAwal;
  originalTrans.banyaknya = newItemsOriginal.reduce(function (sum, item) {
    return sum + item.qty;
  }, 0);

  const detailRefundData = refundItems.concat(addedExchangeItems).map(function (item) {
    return {
      idTrans: refundTrans.id,
      tanggal: refundTrans.tanggal,
      id: item.id,
      nama: item.nama,
      harga: item.harga,
      qty: item.qty,
      isKotak: item.typeBarang === "kelompok",
      typeBarang: item.typeBarang || "turunan",
      hargaModalUnit: item.hargaModalUnit,
      qtyOriginal: item.qtyOriginal || item.qty,
      isRefunded: item.isRefunded,
      isTukar: item.isTukar || false,
      stokSource: item.stokSource || STORE_ID,
    };
  });

  updateStockAfterRefund(refundItems);

  if (!isRefund) {
    updateStockAfterSale(addedExchangeItems);
  }

  const promotionResults = [];

  for (const itemId of affectedItemIds) {
    const needsPromotion = checkIfNeedsPromotion(itemId);

    if (needsPromotion) {
      const promotionInfo = performBatchPromotion(itemId);

      if (promotionInfo && promotionInfo.success) {
        promotionResults.push({
          itemId,
          promoted: true,
          promotionId: promotionInfo.promotionId,
          batchDate: promotionInfo.batchDate,
        });
      } else {
        promotionResults.push({ itemId, promoted: false });
      }
    }
  }

  const finalBarangToSave = getBarangToSave(affectedItemIds, promotionResults);

  try {
    showLoading(true);

    await saveTransaksiData([refundTrans], detailRefundData);

    await saveTransaksiData([originalTrans], []);

    await updateDetailTransaksi(originalTrans.id, newItemsOriginal);

    // ✅ Simpan barang yang diupdate
    const saveResult = await saveBarangData(finalBarangToSave.toSave);

    // ✅ HAPUS batch yang sudah promoted dari Google Sheets
    if (finalBarangToSave.toDelete && finalBarangToSave.toDelete.length > 0) {
      for (const batchInfo of finalBarangToSave.toDelete) {
        try {
          await deleteEmptyBatch(
            batchInfo.id, 
            batchInfo.tanggal, 
            "Penambahan Stok Lama"
          );
          console.log(`✅ Batch ${batchInfo.id} dari ${batchInfo.tanggal} berhasil dihapus`);
        } catch (error) {
          console.warn(`⚠️ Gagal menghapus batch ID ${batchInfo.id}:`, error);
        }
      }
    }

    const [barang, transaksi, deposit] = await Promise.all([loadBarangData(), loadTransaksiData(), loadDepositData()]);

    barangData = barang;
    transaksiData = Array.isArray(transaksi) ? transaksi : transaksi.transactions || [];
    depositData = deposit;

    let successMessage =
      "✅ Berhasil! " +
      (type === "refund" ? "Refund" : "Exchange") +
      " berhasil diproses dari " +
      STORE_ID +
      "!\n\n" +
      "Transaksi Original (ID: " +
      originalTrans.id +
      ") telah diupdate:\n" +
      "- Qty lama: " +
      activeRefundTransaction.banyaknya +
      "\n" +
      "- Qty baru: " +
      originalTrans.banyaknya +
      "\n" +
      "- Total baru: " +
      formatRupiah(originalTrans.total);

    const promotedItems = promotionResults.filter((r) => r.promoted);
    if (promotedItems.length > 0) {
      successMessage += "\n\n📦 Batch Promotion: " + promotedItems.length + " barang dipromosikan";
    }

    alert(successMessage);

    resetRefundProcess();

    const transaksiNav = document.querySelector('.nav-item[data-page="transaksi"]');
    if (transaksiNav) {
      transaksiNav.click();
    }
  } catch (error) {
    alert("❌ Gagal memproses refund/tukar. Silakan cek koneksi dan coba lagi.\n\nError: " + error.message);
  } finally {
    showLoading(false);
  }
}

function updateStockAfterRefund(items) {
  items.forEach(function (rItem) {
    const barang = barangData.find(function (b) {
      return b.id === rItem.id;
    });
    if (!barang) {
      return;
    }

    const jenisKelompok = barang.jenisKelompok || "Satuan";
    const banyakItem = barang.banyakItemPerTurunan || 1;
    const stokSource = rItem.stokSource || STORE_ID;

    let qtyToReturn = rItem.qty;

    if (rItem.typeBarang === "kelompok" && jenisKelompok.toLowerCase() !== "satuan") {
      qtyToReturn = rItem.qty * banyakItem;
    }

    if (stokSource === "BM1") {
      const totalStokBM1 = (barang.stokKelompokBM1 || 0) * banyakItem + (barang.stokTurunanBM1 || 0);
      const newTotalStokBM1 = totalStokBM1 + qtyToReturn;

      const stokResult = convertStokToSeparate(newTotalStokBM1, banyakItem);
      barang.stokKelompokBM1 = stokResult.stokKelompok;
      barang.stokTurunanBM1 = stokResult.stokTurunan;
    } else {
      const totalStokBM2 = (barang.stokKelompokBM2 || 0) * banyakItem + (barang.stokTurunanBM2 || 0);
      const newTotalStokBM2 = totalStokBM2 + qtyToReturn;

      const stokResult = convertStokToSeparate(newTotalStokBM2, banyakItem);
      barang.stokKelompokBM2 = stokResult.stokKelompok;
      barang.stokTurunanBM2 = stokResult.stokTurunan;
    }

    barang.stokBM1 = (barang.stokKelompokBM1 || 0) * banyakItem + (barang.stokTurunanBM1 || 0);
    barang.stokBM2 = (barang.stokKelompokBM2 || 0) * banyakItem + (barang.stokTurunanBM2 || 0);
  });
}

window.printInvoiceByName = function () {
  const customerName = prompt("Masukkan nama pelanggan untuk mencetak invoice:");
  if (!customerName || customerName.trim() === "") {
    alert("❌ Nama pelanggan tidak boleh kosong!");
    return;
  }
  printInvoice(customerName.trim());
};

window.selectRefundByName = function () {
  const customerName = prompt("Masukkan nama pelanggan untuk proses refund/tukar:");
  if (!customerName || customerName.trim() === "") {
    alert("❌ Nama pelanggan tidak boleh kosong!");
    return;
  }
  selectTransactionForRefund(customerName.trim());
};

window.addEventListener("online", async () => {
  console.log("🌐 Koneksi online terdeteksi");
  
  updateConnectionStatus();
  
  // Tunggu 2 detik untuk memastikan koneksi stabil
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Cek apakah masih online
  if (!isOnline()) {
    console.log("⚠️ Koneksi tidak stabil, skip sync");
    return;
  }
  
  // Sync pending data
  if (hasPendingChanges()) {
    console.log("📤 Memulai sinkronisasi data pending...");
    
    try {
      const syncResult = await syncPendingData();
      
      if (syncResult.success) {
        console.log("✅ Sinkronisasi berhasil:", syncResult);
        
        // Reload data setelah sync
        await refreshData();
        
        // Tampilkan notifikasi sukses
        const totalSynced = 
          syncResult.results.barang.success +
          syncResult.results.transaksi.success +
          syncResult.results.deposit.success +
          syncResult.results.delete.success;
        
        if (totalSynced > 0) {
          alert(
            "✅ Sinkronisasi Berhasil!\n\n" +
            `${totalSynced} data berhasil tersinkronisasi ke server.`
          );
        }
      } else {
        console.warn("⚠️ Sinkronisasi gagal:", syncResult);
      }
    } catch (error) {
      console.error("❌ Error saat sync:", error);
    }
  }
});

function updatePendingIndicator() {
  const statusText = document.getElementById("statusText");
  if (!statusText) return;
  
  const pending = hasPendingChanges();
  const online = isOnline();
  
  if (pending && online) {
    statusText.textContent = "Online (Syncing...)";
    statusText.style.color = "#f59e0b";
  } else if (pending && !online) {
    statusText.textContent = "Offline (Pending)";
    statusText.style.color = "#ef4444";
  } else if (online) {
    statusText.textContent = "Online";
    statusText.style.color = "#10b981";
  } else {
    statusText.textContent = "Offline";
    statusText.style.color = "#6b7280";
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  try {
    console.log("🚀 Memulai inisialisasi aplikasi...");
    
    // Load data dengan retry
    let loadSuccess = false;
    let attempts = 0;
    const maxAttempts = 3;
    
    while (!loadSuccess && attempts < maxAttempts) {
      attempts++;
      try {
        loadSuccess = await loadAllData();
      } catch (error) {
        console.warn(`Attempt ${attempts} gagal:`, error);
        if (attempts < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }
    }
    
    if (!loadSuccess) {
      alert(
        "⚠️ Gagal memuat data dari server.\n\n" +
        "Aplikasi akan menggunakan data cache.\n" +
        "Silakan refresh halaman untuk mencoba lagi."
      );
    }
  } catch (error) {
    console.error("❌ Error fatal di initialization:", error);
    alert("❌ Terjadi kesalahan. Silakan refresh halaman.");
    return;
  }

  // Initialize semua komponen
  initNavigation();
  initSearch();
  initCheckout();
  initListBarangSearch();
  initRefundSearch();
  initDepositSearch();

  updateDateTime();
  setInterval(updateDateTime, 1000);
  
  updatePendingIndicator();

  const activeNavItem = document.querySelector(".nav-item.active");
  const initialPage = activeNavItem ? activeNavItem.dataset.page : "transaksi";

  setTimeout(() => {
    loadPageData(initialPage);
  }, 100);

  // Event listener untuk reload data
  window.addEventListener("dataReloaded", async () => {
    await refreshData();
    const currentNavItem = document.querySelector(".nav-item.active");
    const currentPage = currentNavItem ? currentNavItem.dataset.page : null;
    if (currentPage) {
      renderPage(currentPage);
    }
  });
  
  // Event listener untuk sync completed
  window.addEventListener("dataSynced", (event) => {
    console.log("✅ Data synced event received:", event.detail);
    updatePendingIndicator();
  });
  
  console.log("✅ Aplikasi berhasil diinisialisasi");
});
