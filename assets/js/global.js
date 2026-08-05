// ==========================================================
// GLOBAL CORE SCRIPT — SIAGA DARURAT SBT
// ==========================================================

const supabaseClient = supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);
mapboxgl.accessToken = CONFIG.MAPBOX_TOKEN;

// Konfigurasi Status, Warna Badge, dan Kelas Latar Belakang Kartu
const STATUS_CONFIG = {
    'Sedang Dicek': { 
        text: 'Proses Cek', 
        badgeClass: 'bg-emerald-100 text-emerald-800 border border-emerald-200',
        cardClass: 'card-proses-cek'
    },
    'Terverifikasi': { 
        text: 'Terverifikasi', 
        badgeClass: 'bg-sky-100 text-sky-800 border border-sky-200',
        cardClass: 'card-terverifikasi'
    },
    'Sedang Ditangani': { 
        text: 'Sedang Ditangani', 
        badgeClass: 'bg-orange-100 text-orange-800 border border-orange-200',
        cardClass: 'card-sedang-ditangani'
    },
    'Selesai': { 
        text: 'Selesai', 
        badgeClass: 'bg-emerald-100 text-emerald-800 border border-emerald-200',
        cardClass: 'card-selesai'
    },
    'Tidak Valid': { 
        text: 'Tidak Valid', 
        badgeClass: 'bg-slate-200 text-slate-700 border border-slate-300',
        cardClass: 'card-tidak-valid'
    }
};

function renderBadgeStatus(status, isKritis30Min = false) {
    if (isKritis30Min) {
        return `<span class="bg-amber-100 text-amber-800 font-bold px-2 py-0.5 rounded border border-amber-300 text-[10px]">⏳ Proses Cek (>30m)</span>`;
    }
    const cfg = STATUS_CONFIG[status] || { text: status, badgeClass: 'bg-slate-100 text-slate-700', cardClass: 'card-proses-cek' };
    return `<span class="px-2 py-0.5 rounded font-bold text-[10px] ${cfg.badgeClass}">${cfg.text}</span>`;
}

function getCardClassByStatus(status, isKritis30Min = false) {
    if (isKritis30Min) return 'card-proses-cek border-amber-300';
    const cfg = STATUS_CONFIG[status];
    return cfg ? cfg.cardClass : 'card-proses-cek';
}

// Format Jam Laporan Paksa Zona Waktu WIT (Asia/Jayapura - UTC+9)
function formatJamLaporan(isoString) {
    if (!isoString) return '';
    const date = new Date(isoString);
    return date.toLocaleTimeString('id-ID', { 
        timeZone: 'Asia/Jayapura', 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: false 
    }) + ' WIT';
}

function sederhanakanTeks(teks, batasMaksimal = 25) {
    if (!teks) return '-';
    if (teks.length <= batasMaksimal) return teks;
    return teks.substring(0, batasMaksimal) + '...';
}

function openModal(id) {
    const el = document.getElementById(id);
    if (el) el.classList.remove('hidden');
}

function closeModal(id) {
    const el = document.getElementById(id);
    if (el) el.classList.add('hidden');
}

// Pemantau Status Online Realtime
async function cekAkunOnlineRealtime() {
    try {
        const { data, error } = await supabaseClient
            .from('users')
            .select('nama_lembaga, role, status_online')
            .eq('status_online', 'ONLINE');

        if (error || !data) return;

        const lembagaUtamaList = ['BPBD SBT', 'Damkar Kab. SBT', 'Call Center 112'];
        const adaPetugasOnline = data.some(u => lembagaUtamaList.includes(u.nama_lembaga));
        const adaPimpinanOnline = data.some(u => u.role && u.role.toLowerCase() === 'pimpinan');

        const elLembaga = document.getElementById('status-lembaga-utama');
        const elPimpinan = document.getElementById('status-pimpinan-online');

        if (elLembaga) {
            elLembaga.textContent = adaPetugasOnline ? '🟢 Siaga' : '⚪ Off';
            elLembaga.className = adaPetugasOnline ? 'font-medium text-emerald-600' : 'font-medium text-slate-400';
        }
        
        if (elPimpinan) {
            elPimpinan.textContent = adaPimpinanOnline ? '🟢 On' : '⚪ Off';
            elPimpinan.className = adaPimpinanOnline ? 'font-medium text-blue-600' : 'font-medium text-slate-400';
        }
    } catch (e) {
        console.error("Gagal cek status online:", e);
    }
}

// Master Data Wilayah Kemendagri & Faskes
let dataWilayahKemendagriGlobal = [];
let dataFaskesSBTGlobal = [];

async function loadMasterDataGlobal() {
    try {
        const resWilayah = await fetch('data/wilayah.json');
        const jsonWilayah = await resWilayah.json();
        dataWilayahKemendagriGlobal = jsonWilayah.kecamatan || [];
        populateKecamatanDatalistGlobal();

        const resFaskes = await fetch('data/faskes.json');
        const jsonFaskes = await resFaskes.json();
        dataFaskesSBTGlobal = jsonFaskes.faskes || [];
    } catch (err) {
        console.error("Gagal memuat master data JSON global:", err);
    }
}

// Generator Timestamp Waktu Lokal untuk Laporan Baru
function buatTimestampLokal() {
    return new Date().toISOString();
}

function populateKecamatanDatalistGlobal() {
    const datalistKec = document.getElementById('list-kecamatan');
    if (!datalistKec) return;
    datalistKec.innerHTML = '';
    
    dataWilayahKemendagriGlobal.forEach(kec => {
        const opt = document.createElement('option');
        opt.value = kec.nama_kecamatan;
        datalistKec.appendChild(opt);
    });
}

function updateDaftarDesaGlobal() {
    const inputKec = document.getElementById('input-kecamatan');
    const datalistDesa = document.getElementById('list-desa');
    if (!inputKec || !datalistDesa) return;

    const selectedKecName = inputKec.value;
    datalistDesa.innerHTML = '';
    
    const kecamatanObj = dataWilayahKemendagriGlobal.find(k => k.nama_kecamatan === selectedKecName);
    if (kecamatanObj && kecamatanObj.desa_kelurahan) {
        kecamatanObj.desa_kelurahan.forEach(desa => {
            const opt = document.createElement('option');
            let namaBersih = desa.nama.replace(/\(Desa\)/gi, '').trim();
            opt.value = namaBersih;
            datalistDesa.appendChild(opt);
        });
    }
}
