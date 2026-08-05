// ==========================================================
// GLOBAL CORE SCRIPT — SIAGA DARURAT SBT
// Berisi konfigurasi inti, supabase, badge status, master data,
// utilitas modal, dan pemantau status online universal.
// ==========================================================

// 1. Inisialisasi Supabase & Mapbox Token (Pastikan config.js dimuat sebelum file ini)
const supabaseClient = supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);
mapboxgl.accessToken = CONFIG.MAPBOX_TOKEN;

// 2. Konfigurasi Standar 5 Warna Psikologis Badge Status
const STATUS_CONFIG = {
    'Sedang Dicek': { text: 'Sedang Dicek', class: 'bg-amber-100 text-amber-800 border border-amber-200' },
    'Terverifikasi': { text: 'Terverifikasi', class: 'bg-sky-100 text-sky-800 border border-sky-200' },
    'Sedang Ditangani': { text: 'Sedang Ditangani', class: 'bg-orange-100 text-orange-800 border border-orange-200' },
    'Selesai': { text: 'Selesai', class: 'bg-emerald-100 text-emerald-800 border border-emerald-200' },
    'Tidak Valid': { text: 'Tidak Valid', class: 'bg-slate-200 text-slate-700 border border-slate-300' }
};

// Fungsi Render Badge Universal
function renderBadgeStatus(status, isKritis30Min = false) {
    if (isKritis30Min) {
        return `<span class="bg-red-600 text-white font-extrabold px-2 py-0.5 rounded animate-pulse text-[10px]">⏳ Sedang Dicek (>30m)</span>`;
    }
    const cfg = STATUS_CONFIG[status] || { text: status, class: 'bg-slate-100 text-slate-700' };
    return `<span class="px-2 py-0.5 rounded font-bold text-[10px] ${cfg.class}">${cfg.text}</span>`;
}

// 3. Utilitas Pengaman Teks & Modal
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

// 4. Pemantau Status Online Realtime (Satgas & Pimpinan)
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

// 5. Master Data Wilayah Kemendagri & Faskes (Universal Datalist)
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

// 6. Kalkulator Target Estimasi Waktu Selesai (Format ISO Timestamp)
function hitungTargetEstimasiISO(durasiJam) {
    const target = new Date();
    target.setHours(target.getHours() + parseInt(durasiJam || 2));
    return target.toISOString();
}
