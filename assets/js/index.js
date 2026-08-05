mapboxgl.accessToken = CONFIG.MAPBOX_TOKEN;

let laporanList = [];
let selectedCoords = { lng: 130.4850, lat: -3.1500 };
let markersPublik = [];
let markersFaskes = [];
let mapPicker = null;
let dataWilayahKemendagri = [];
let dataFaskesSBT = [];

const map = new mapboxgl.Map({
    container: 'map',
    style: 'mapbox://styles/mapbox/streets-v12',
    center: [130.48809, -3.10517],
    zoom: 12.32
});

// Load JSON Wilayah & Faskes saat awal
async function loadMasterData() {
    try {
        const resWilayah = await fetch('data/wilayah.json');
        const jsonWilayah = await resWilayah.json();
        dataWilayahKemendagri = jsonWilayah.kecamatan || [];
        populateKecamatanDropdown();

        const resFaskes = await fetch('data/faskes.json');
        const jsonFaskes = await resFaskes.json();
        dataFaskesSBT = jsonFaskes.faskes || [];
    } catch (err) {
        console.error("Gagal memuat master data JSON:", err);
    }
}

function populateKecamatanDropdown() {
    const selectKec = document.getElementById('select-kecamatan');
    if (!selectKec) return;
    selectKec.innerHTML = '<option value="">-- Pilih Kecamatan --</option>';
    dataWilayahKemendagri.forEach(kec => {
        const opt = document.createElement('option');
        opt.value = kec.nama_kecamatan;
        opt.textContent = kec.nama_kecamatan;
        selectKec.appendChild(opt);
    });
}

function updateDropdownDesa() {
    const selectedKecName = document.getElementById('select-kecamatan').value;
    const selectDesa = document.getElementById('select-desa');
    selectDesa.innerHTML = '<option value="">-- Pilih Desa --</option>';
    
    const kecamatanObj = dataWilayahKemendagri.find(k => k.nama_kecamatan === selectedKecName);
    if (kecamatanObj && kecamatanObj.desa_kelurahan) {
        kecamatanObj.desa_kelurahan.forEach(desa => {
            const opt = document.createElement('option');
            opt.value = desa.nama;
            opt.textContent = desa.nama + (desa.status ? ` (${desa.status})` : '');
            selectDesa.appendChild(opt);
        });
    }
}

async function ambilDataLaporan() {
    const { data, error } = await supabaseClient.from('laporan').select('*').order('created_at', { ascending: false });
    if (!error) {
        laporanList = data || [];
        renderSidebar();
        renderMarkersPublik();
    }
}

// Cek Sesi / Akun Aktif untuk Lembaga Utama & Pimpinan
async function cekAkunOnlineRealtime() {
    try {
        // Asumsi tabel session / users di Supabase mencatat status login aktif
        const { data, error } = await supabaseClient.from('users').select('username, role, lembaga_terkait, status_online').eq('status_online', 'ONLINE');
        if (error || !data) return;

        const lembagaUtamaList = ['BPBD SBT', 'Damkar Kab. SBT', 'Call Center 112'];
        const onlineLembaga = data.filter(u => lembagaUtamaList.includes(u.lembaga_terkait)).map(u => u.lembaga_terkait);
        const onlinePimpinan = data.filter(u => u.role === 'PIMPINAN').map(u => u.username);

        const elLembaga = document.getElementById('status-lembaga-utama');
        const elPimpinan = document.getElementById('status-pimpinan-online');

        if (elLembaga) {
            elLembaga.textContent = onlineLembaga.length > 0 ? [...new Set(onlineLembaga)].join(', ') + ' Online' : 'Standby (Offline)';
        }
        if (elPimpinan) {
            elPimpinan.textContent = onlinePimpinan.length > 0 ? onlinePimpinan.join(', ') + ' Memantau' : 'Belum Terpantau';
        }
    } catch (e) {
        console.error("Gagal cek status online:", e);
    }
}

function renderSidebar() {
    const container = document.getElementById('sidebar-list');
    container.innerHTML = '';
    document.getElementById('counter-laporan').innerText = `${laporanList.length} Kasus`;

    if (laporanList.length === 0) {
        container.innerHTML = `<p class="text-xs text-slate-400 text-center py-4">Belum ada laporan masuk.</p>`;
        return;
    }

    const now = new Date();

    laporanList.forEach(item => {
        const badgeColor = item.jenis === 'Kebakaran' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700';
        
        // Logika Waktu > 30 Menit Belum Ditangani (Kritis -> Warna Merah Menyala di Sidebar)
        const waktuBuat = new Date(item.created_at);
        const selisihMenit = (now - waktuBuat) / (1000 * 60);
        const isKritis = item.status === 'Baru' && selisihMenit > 30;

        const statusColor = isKritis ? 'text-white bg-red-600 animate-pulse font-extrabold' : 
                            item.status === 'Baru' ? 'text-red-600 bg-red-50' : 
                            item.status === 'Terverifikasi' ? 'text-amber-600 bg-amber-50' : 
                            item.status === 'Proses' ? 'text-blue-600 bg-blue-50' : 'text-green-600 bg-green-50';

        const card = document.createElement('div');
        card.className = `p-2.5 rounded-lg shadow-sm border cursor-pointer transition ${isKritis ? 'bg-red-50 border-red-300' : 'bg-slate-50 border-slate-200 hover:bg-slate-100'}`;
        card.innerHTML = `
            <div class="flex justify-between items-start mb-1">
                <span class="text-[9px] font-bold px-1.5 py-0.5 rounded ${badgeColor}">${item.jenis}</span>
                <span class="text-[10px] font-bold px-2 py-0.5 rounded ${statusColor}">${isKritis ? '⚠️ KRITIS (>30m)' : item.status}</span>
            </div>
            <h3 class="text-xs font-bold text-slate-800">${item.lokasi}</h3>
            <p class="text-[11px] text-slate-600 truncate">${item.ket}</p>
            <p class="text-[10px] text-slate-400 mt-1">ID: <code class="font-bold">${item.id}</code></p>
        `;
        card.onclick = () => map.flyTo({ center: [item.lng, item.lat], zoom: 14 });
        container.appendChild(card);
    });
}

function renderMarkersPublik() {
    markersPublik.forEach(m => m.remove());
    markersPublik = [];

    laporanList.forEach(item => {
        const color = item.jenis === 'Kebakaran' ? '#ef4444' : '#3b82f6';
        const el = document.createElement('div');
        el.className = 'rounded-full shadow-md cursor-pointer border-2 border-white';
        el.style.width = '24px';
        el.style.height = '24px';
        el.style.backgroundColor = color;

        const popup = new mapboxgl.Popup({ offset: 25 }).setHTML(`
            <div class="p-1 text-xs">
                <b class="text-slate-800">${item.lokasi}</b><br>
                <span>Jenis: <b>${item.jenis}</b></span><br>
                <span>Status: <b>${item.status}</b></span>
            </div>
        `);

        const marker = new mapboxgl.Marker(el)
            .setLngLat([item.lng, item.lat])
            .setPopup(popup)
            .addTo(map);
        markersPublik.push(marker);
    });
}

// Toggle Layer Tambahan Faskes / RSUD di Peta
function toggleLayerFaskes(checkbox) {
    if (checkbox.checked) {
        dataFaskesSBT.forEach(f => {
            const el = document.createElement('div');
            el.className = 'rounded-full shadow-md cursor-pointer bg-teal-600 border-2 border-white flex items-center justify-center text-[10px] text-white font-bold';
            el.style.width = '22px';
            el.style.height = '22px';
            el.innerHTML = '🏥';

            const popup = new mapboxgl.Popup({ offset: 25 }).setHTML(`
                <div class="p-1 text-xs">
                    <b class="text-teal-700">${f.nama}</b><br>
                    <span>Tipe: <b>${f.tipe.toUpperCase()}</b></span><br>
                    <span>Desa: ${f.desa}, Kec. ${f.kecamatan}</span>
                </div>
            `);

            const marker = new mapboxgl.Marker(el)
                .setLngLat([f.lng, f.lat])
                .setPopup(popup)
                .addTo(map);
            markersFaskes.push(marker);
        });
    } else {
        markersFaskes.forEach(m => m.remove());
        markersFaskes = [];
    }
}

function bukaFormLapor() {
    openModal('modal-lapor');
    document.getElementById('warga-lng').value = selectedCoords.lng.toFixed(4);
    document.getElementById('warga-lat').value = selectedCoords.lat.toFixed(4);
}

function mulaiPilihPeta() {
    closeModal('modal-lapor');
    document.getElementById('modal-peta-picker').classList.remove('hidden');
    
    if (!mapPicker) {
        setTimeout(() => {
            mapPicker = new mapboxgl.Map({
                container: 'map-picker',
                style: 'mapbox://styles/mapbox/streets-v12',
                center: [selectedCoords.lng, selectedCoords.lat],
                zoom: 13
            });
        }, 200);
    } else {
        mapPicker.resize();
    }
}

function konfirmasiTitikPeta() {
    if (mapPicker) {
        const center = mapPicker.getCenter();
        selectedCoords = { lng: center.lng, lat: center.lat };
    }
    document.getElementById('modal-peta-picker').classList.add('hidden');
    bukaFormLapor();
}

function batalkanPilihPeta() {
    document.getElementById('modal-peta-picker').classList.add('hidden');
    bukaFormLapor();
}

document.getElementById('form-lapor').addEventListener('submit', async (e) => {
    e.preventDefault();
    const kecamatanVal = document.getElementById('select-kecamatan').value;
    const desaVal = document.getElementById('select-desa').value;
    const lokasiGabungan = `Desa ${desaVal}, Kec. ${kecamatanVal}`;

    const idBaru = 'SBT-' + Math.floor(1000 + Math.random() * 9000);
    const dataBaru = {
        id: idBaru,
        nama: document.getElementById('warga-nama').value,
        telp: document.getElementById('warga-telp').value,
        jenis: document.getElementById('warga-jenis').value,
        lokasi: lokasiGabungan,
        ket: document.getElementById('warga-ket').value,
        status: 'Baru',
        penanggung_jawab: '-',
        telp_petugas: '-',
        estimasi_selesai: null,
        lembaga_verifikasi: '-',
        lembaga_proses: '-',
        catatan_lapangan: '',
        lng: selectedCoords.lng,
        lat: selectedCoords.lat
    };

    const { error } = await supabaseClient.from('laporan').insert([dataBaru]);
    if (error) {
        alert('Gagal mengirim laporan: ' + error.message);
    } else {
        alert(`Laporan berhasil dikirim!\n\nNomor Laporan Anda: ${idBaru}\nSimpan nomor ini untuk mengecek status.`);
        document.getElementById('form-lapor').reset();
        closeModal('modal-lapor');
        ambilDataLaporan();
    }
});

function cekStatusLaporan() {
    const kode = document.getElementById('input-kode-cek').value.trim();
    const hasilDiv = document.getElementById('hasil-cek');
    const data = laporanList.find(i => i.id === kode);

    hasilDiv.classList.remove('hidden');
    if (data) {
        hasilDiv.innerHTML = `
            <p><b>ID Laporan:</b> <code class="font-bold">${data.id}</code></p>
            <p><b>Lokasi:</b> ${data.lokasi}</p>
            <p><b>Jenis:</b> ${data.jenis}</p>
            <p><b>Status:</b> <span class="text-blue-600 font-bold">${data.status}</span></p>
            <p><b>Instansi PJ:</b> ${data.penanggung_jawab}</p>
            <p><b>Kontak Posko:</b> ${data.telp_petugas !== '-' ? `<a href="tel:${data.telp_petugas}" class="text-blue-600 underline font-bold">${data.telp_petugas}</a>` : '-'}</p>
            <p><b>Keterangan:</b> ${data.ket}</p>
        `;
    } else {
        hasilDiv.innerHTML = `<p class="text-red-600 font-semibold">Nomor laporan tidak ditemukan.</p>`;
    }
}

function openModal(id) { document.getElementById(id).classList.remove('hidden'); }
function closeModal(id) { document.getElementById(id).classList.add('hidden'); }

map.on('load', () => {
    loadMasterData();
    ambilDataLaporan();
    cekAkunOnlineRealtime();
    setInterval(ambilDataLaporan, 5000);
    setInterval(cekAkunOnlineRealtime, 10000);
});
