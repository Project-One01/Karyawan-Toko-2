function parseYYYYMMDD(dateString) {
  if (!dateString) return new Date();
  if (dateString instanceof Date) return dateString;
  const match = dateString.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    const year = parseInt(match[1]);
    const month = parseInt(match[2]) - 1;
    const day = parseInt(match[3]);
    return new Date(year, month, day);
  }
  return new Date(dateString);
}

function getTodayWIB() {
  const now = new Date();
  const wibTime = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Jakarta" }));
  const year = wibTime.getFullYear();
  const month = String(wibTime.getMonth() + 1).padStart(2, "0");
  const day = String(wibTime.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getNowWIB() {
  const now = new Date();
  const wibTime = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Jakarta" }));
  const year = wibTime.getFullYear();
  const month = String(wibTime.getMonth() + 1).padStart(2, "0");
  const day = String(wibTime.getDate()).padStart(2, "0");
  const hours = String(wibTime.getHours()).padStart(2, "0");
  const minutes = String(wibTime.getMinutes()).padStart(2, "0");
  const seconds = String(wibTime.getSeconds()).padStart(2, "0");
  const ms = String(wibTime.getMilliseconds()).padStart(3, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}.${ms}+07:00`;
}

function getLocalDateString(dateInput) {
  if (!dateInput) return getTodayWIB();
  if (typeof dateInput === "string") {
    const match = dateInput.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) {
      return `${match[1]}-${match[2]}-${match[3]}`;
    }
  }
  const date = new Date(dateInput);
  if (isNaN(date.getTime())) {
    return getTodayWIB();
  }
  const wibTime = new Date(date.toLocaleString("en-US", { timeZone: "Asia/Jakarta" }));
  const year = wibTime.getFullYear();
  const month = String(wibTime.getMonth() + 1).padStart(2, "0");
  const day = String(wibTime.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseToWIBDate(dateString) {
  if (!dateString) return new Date();
  if (dateString instanceof Date) return dateString;
  const match = dateString.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    const year = parseInt(match[1]);
    const month = parseInt(match[2]) - 1;
    const day = parseInt(match[3]);
    const wibDate = new Date(year, month, day, 0, 0, 0);
    return wibDate;
  }
  const date = new Date(dateString);
  return new Date(date.toLocaleString("en-US", { timeZone: "Asia/Jakarta" }));
}

function isSameDay(date1, date2) {
  const d1 = getLocalDateString(date1);
  const d2 = getLocalDateString(date2);
  return d1 === d2;
}

function isOnline() {
  return navigator.onLine;
}

function formatRupiah(number) {
  if (isNaN(number) || number === null) number = 0;
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(number);
}

function formatDate(dateInput) {
  if (!dateInput) return "-";
  const date = parseToWIBDate(dateInput);
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

function formatDateTime(dateInput) {
  if (!dateInput) return "-";
  const date = new Date(dateInput);
  const wibTime = new Date(date.toLocaleString("en-US", { timeZone: "Asia/Jakarta" }));
  const day = String(wibTime.getDate()).padStart(2, "0");
  const month = String(wibTime.getMonth() + 1).padStart(2, "0");
  const year = wibTime.getFullYear();
  const hours = String(wibTime.getHours()).padStart(2, "0");
  const minutes = String(wibTime.getMinutes()).padStart(2, "0");
  const seconds = String(wibTime.getSeconds()).padStart(2, "0");
  return `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;
}

function updateDateTime() {
  const now = new Date();
  const options = {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Jakarta",
  };
  const dateTimeEl = document.getElementById("dateTime");
  if (dateTimeEl) {
    dateTimeEl.textContent = now.toLocaleString("id-ID", options);
  }
  const currentDateTime = document.getElementById("currentDateTime");
  if (currentDateTime) {
    currentDateTime.textContent = now.toLocaleString("id-ID", options);
  }
}

function getKelompokLabel(jenisKelompok) {
  const labels = {
    satuan: "Satuan",
    kotak: "Kotak",
    kodi: "Kodi",
    meter: "Meter",
    kilogram: "Kg",
    keping: "Keping",
    dumptruck: "Dump Truck"
  };
  return labels[jenisKelompok.toLowerCase()] || "Satuan";
}

function getSatuanTurunanLabel(jenisKelompok) {
  const labels = {
    satuan: "Satuan",
    kotak: "Satuan",
    kodi: "Satuan",
    meter: "Sentimeter",
    kilogram: "Gram",
    keping: "Keping",
    dumptruck: "Dump Truck"
  };
  return labels[jenisKelompok.toLowerCase()] || "Satuan";
}

function getDisplayLabel(item, barangData) {
  const barang = barangData ? barangData.find((b) => b.id === item.id) : null;
  const jenisKelompok = item.jenisKelompok || (barang ? barang.jenisKelompok : null) || "Satuan";
  const typeBarang = item.typeBarang || (item.isKotak ? "kelompok" : "turunan");

  if (typeBarang === "kelompok") {
    return getKelompokLabel(jenisKelompok);
  } else {
    return getSatuanTurunanLabel(jenisKelompok);
  }
}

function getBanyakItemPerTurunan(jenisKelompok, customValue = null) {
  const jenisLower = jenisKelompok.toLowerCase();

  if (jenisLower === "kodi") return 20;
  if (jenisLower === "meter") return 100;
  if (jenisLower === "kilogram") return 1000;
  if (jenisLower === "satuan") return 1;
  if (jenisLower === "keping") return 1;
  if (jenisLower === "dumptruck") return 1;
  if (jenisLower === "kotak") {
    return customValue && customValue > 0 ? customValue : 1;
  }
  return 1;
}

function calculateTotalStokForBarang(idBarang, barangDataArray, source = "BM1") {
  const allRecords = barangDataArray.filter((b) => b.id === idBarang);

  let totalStok = 0;

  allRecords.forEach((record) => {
    const banyakItem = record.banyakItemPerTurunan || 1;
    let stokKelompok = 0;
    let stokTurunan = 0;

    if (source === "BM1") {
      stokKelompok = record.stokKelompokBM1 || 0;
      stokTurunan = record.stokTurunanBM1 || 0;
    } else {
      stokKelompok = record.stokKelompokBM2 || 0;
      stokTurunan = record.stokTurunanBM2 || 0;
    }

    totalStok += stokKelompok * banyakItem + stokTurunan;
  });

  return totalStok;
}

function isKelompokFixed(jenisKelompok) {
  const fixedTypes = ["kodi", "meter", "kilogram"];
  return fixedTypes.includes(jenisKelompok.toLowerCase());
}

function getBarangModalPrice(barang, isKelompok) {
  if (!barang) return 0;
  const jenisKelompok = barang.jenisKelompok || "satuan";
  const banyakItemPerTurunan = barang.banyakItemPerTurunan || 1;
  const modalBarang = barang.modalBarang || 0;
  if (jenisKelompok.toLowerCase() === "satuan") {
    return modalBarang;
  }
  if (isKelompok) {
    return modalBarang;
  } else {
    return banyakItemPerTurunan > 0 ? modalBarang / banyakItemPerTurunan : modalBarang;
  }
}

function convertStokToSeparate(totalStok, banyakItemPerTurunan) {
  if (banyakItemPerTurunan <= 1) {
    return {
      stokKelompok: totalStok,
      stokTurunan: 0,
    };
  }

  const stokKelompok = Math.floor(totalStok / banyakItemPerTurunan);
  const stokTurunan = totalStok % banyakItemPerTurunan;
  return { stokKelompok, stokTurunan };
}

function convertStokToTotal(stokKelompok, stokTurunan, banyakItemPerTurunan) {
  return stokKelompok * banyakItemPerTurunan + stokTurunan;
}

async function reloadPageData() {
  window.dispatchEvent(new CustomEvent("dataReloaded"));
}

function updateConnectionStatus() {
  const statusEl = document.getElementById("connectionStatus");
  const statusText = document.getElementById("statusText");
  if (!statusEl || !statusText) return;
  
  if (isOnline()) {
    statusEl.className = "connection-status online";
    statusText.textContent = "Online";
    
    if (hasPendingChanges()) {
      statusText.textContent = "Online (Syncing...)";
    }
  } else {
    statusEl.className = "connection-status offline";
    statusText.textContent = "Offline";
    
    if (hasPendingChanges()) {
      statusText.textContent = "Offline (Pending changes)";
    }
  }
}

window.addEventListener("online", () => {
  updateConnectionStatus();
  reloadPageData();
});

window.addEventListener("offline", () => {
  updateConnectionStatus();
});

window.addEventListener("dataSynced", () => {
  updateConnectionStatus();
  reloadPageData();
});

function terbilang(angka) {
  const bilangan = [
    "",
    "Satu",
    "Dua",
    "Tiga",
    "Empat",
    "Lima",
    "Enam",
    "Tujuh",
    "Delapan",
    "Sembilan",
    "Sepuluh",
    "Sebelas",
  ];

  if (angka === 0) return "Nol";
  if (angka < 12) return bilangan[angka];
  if (angka < 20) return terbilang(angka - 10) + " Belas";

  if (angka < 100) {
    const puluhan = terbilang(Math.floor(angka / 10)) + " Puluh";
    const satuan = angka % 10;
    return satuan > 0 ? puluhan + " " + terbilang(satuan) : puluhan;
  }

  if (angka < 200) {
    const sisa = angka - 100;
    return sisa > 0 ? "Seratus " + terbilang(sisa) : "Seratus";
  }

  if (angka < 1000) {
    const ratusan = terbilang(Math.floor(angka / 100)) + " Ratus";
    const sisa = angka % 100;
    return sisa > 0 ? ratusan + " " + terbilang(sisa) : ratusan;
  }

  if (angka < 2000) {
    const sisa = angka - 1000;
    return sisa > 0 ? "Seribu " + terbilang(sisa) : "Seribu";
  }

  if (angka < 1000000) {
    const ribuan = terbilang(Math.floor(angka / 1000)) + " Ribu";
    const sisa = angka % 1000;
    return sisa > 0 ? ribuan + " " + terbilang(sisa) : ribuan;
  }

  if (angka < 1000000000) {
    const jutaan = terbilang(Math.floor(angka / 1000000)) + " Juta";
    const sisa = angka % 1000000;
    return sisa > 0 ? jutaan + " " + terbilang(sisa) : jutaan;
  }

  if (angka < 1000000000000) {
    const miliaran = terbilang(Math.floor(angka / 1000000000)) + " Miliar";
    const sisa = angka % 1000000000;
    return sisa > 0 ? miliaran + " " + terbilang(sisa) : miliaran;
  }

  return "Angka terlalu besar";
}

function initGlobalAPI() {
  updateDateTime();
  setInterval(updateDateTime, 1000);
  updateConnectionStatus();
  setInterval(updateConnectionStatus, 5000);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initGlobalAPI);
} else {
  initGlobalAPI();
}