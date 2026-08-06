// ==========================================================
// INDEX SCRIPT — SIAGA DARURAT SBT
// ==========================================================

let laporanList = [];
let selectedCoords = { lng: 130.4850, lat: -3.1500 };
let markersPublik = [];
let markersFaskes = [];
let mapPicker = null;
let selectedReportId = null;

const map = new mapboxgl.Map({
    container: 'map',
    style: 'mapbox://styles/mapbox/streets-v12',
    center: [130.48809, -3.10517],
    zoom: 12.32
});

async function ambilDataLaporan() {
    const { data, error } = await supabaseClient.from('laporan').select('*').order('created_at', { ascending: false });
    if (!error) {
        laporanList = data || [];
        renderSidebar();
        renderMarkersPublik();
    }
}

// Pengecekan status online/offline riil untuk Satgas dan Pimpinan berdasarkan database
async function cekAkunOnlineRealtime() {
    try {
        const { data, error } = await supabaseClient.from('users').select('status_online, role, nama_lembaga');
        if (error || !data) return;

        // Cek apakah ada akun lembaga operasional/satgas yang status_online-nya 'ONLINE'
        const adaSatgasOnline = data.some(u => 
            (u.status_online === 'ONLINE' || u.status_online === 'online') && 
            u.role !== 'pimpinan' && 
            u.role !== 'superadmin' &&
            !u.nama_lembaga?.toLowerCase().includes('112')
        );

        // Cek apakah ada akun pimpinan yang status_online-nya 'ONLINE'
        const adaPimpinanOnline = data.some(u => 
            (u.status_online === 'ONLINE' || u.status_online === 'online') && 
            (u.role === 'pimpinan' || u.role === 'eksekutif')
        );

        const elSatgas = document.getElementById('status-lembaga-utama');
        const elPimpinan = document.getElementById('status-pimpinan-online');

        // Render Status Satgas (Dinamis sesuai login)
        if (elSatgas) {
            if (adaSatgasOnline) {
                elSatgas.textContent = 'Online';
                elSatgas.className = 'font-medium text-emerald-600';
            } else {
                elSatgas.textContent = 'Offline';
                elSatgas.className = 'font-medium text-slate-400';
            }
        }

        // Render Status Pimpinan (Dinamis sesuai login)
        if (elPimpinan) {
            if (adaPimpinanOnline) {
                elPimpinan.textContent = 'Online';
                elPimpinan.className = 'font-medium text-blue-600';
            } else {
                elPimpinan.textContent = 'Offline';
                elPimpinan.className = 'font-medium text-slate-400';
            }
        }
    } catch (err) {
        console.error('Gagal memuat status online:', err);
    }
}

function bunyiPeringatanDarurat() {
    try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return;
        const audioCtx = new AudioContext();

        if (audioCtx.state === 'suspended') {
            audioCtx.resume();
        }

        const oscillator = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(880, audioCtx.currentTime);
        gainNode.gain.setValueAtTime(0.15, audioCtx.currentTime);
        
        oscillator.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        
        oscillator.start();
        oscillator.stop(audioCtx.currentTime + 0.3);
    } catch (e) {
        console.log("Audio diblokir browser perangkat seluler:", e);
    }
}

function renderSidebar() {
    const container = document.getElementById('sidebar-list');
    if (!container) return;
    container.innerHTML = '';
    
    const counterEl = document.getElementById('counter-laporan');
    if (counterEl) counterEl.innerText = `${laporanList.length} Kasus`;

    if (laporanList.length === 0) {
        container.innerHTML = `<p class="text-xs text-slate-400 text-center py-4">Belum ada laporan masuk.</p>`;
        return;
    }

    const now = new Date();
    let adaKritis30Min = false;

    laporanList.forEach(item => {
        const badgeColor = item.jenis === 'Kebakaran' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700';
        
        let cleanDateStr = item.created_at;
        if (cleanDateStr && !cleanDateStr.includes('Z') && !cleanDateStr.includes('+')) {
            cleanDateStr = cleanDateStr.replace(' ', 'T') + '+09:00';
        }
        const waktuBuat = new Date(cleanDateStr);
        const selisihMenit = (now - waktuBuat) / (1000 * 60);
        
        const isKritis = ((item.status === 'Baru' || item.status === 'Sedang Dicek') && selisihMenit > 30);

        if (isKritis) {
            adaKritis30Min = true;
        }

        const badgeHtml = renderBadgeStatus(item.status, isKritis);
        const jamWaktu = formatJamLaporan(item.created_at);
        const cardStyleClass = getCardClassByStatus(item.status, isKritis);
        
        let estimasiHtml = '';
        if (item.status === 'Sedang Ditangani' && item.estimasi_selesai) {
            const estimasiJam = new Date(item.estimasi_selesai).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
            estimasiHtml = `<div class="mt-1 text-[10px] text-orange-800 bg-orange-100 px-1.5 py-0.5 rounded font-medium">⏱️ Target Selesai: Pukul ${estimasiJam} WIT</div>`;
        }

        const card = document.createElement('div');
        card.className = `p-2.5 rounded-lg shadow-sm border cursor-pointer transition ${cardStyleClass} border-slate-200 hover:brightness-95`;
        card.innerHTML = `
            <div class="flex justify-between items-center mb-1">
                <div class="flex items-center gap-1.5">
                    <span class="text-[9px] font-bold px-1.5 py-0.5 rounded ${badgeColor}">${item.jenis}</span>
                    <span class="text-[10px] font-mono text-slate-500 font-semibold">🕒 ${jamWaktu}</span>
                </div>
                <div>${badgeHtml}</div>
            </div>
            <h3 class="text-xs font-bold text-slate-800">${item.lokasi}</h3>
            <p class="text-[11px] text-slate-600 truncate">${item.ket || '-'}</p>
            ${estimasiHtml}
            <div class="flex justify-between items-center mt-1 pt-1 border-t border-slate-200/60 text-[9px] text-slate-400">
                <span>ID: <code class="font-bold text-slate-600">${item.id}</code></span>
                <span class="text-blue-600 font-semibold">Ketuk peta →</span>
            </div>
        `;
        
        card.onclick = () => {
            selectedReportId = item.id;
            renderSidebar();
            renderMarkersPublik();
            map.flyTo({ center: [item.lng, item.lat], zoom: 14 });
        };

        container.appendChild(card);
    });

    if (adaKritis30Min) {
        bunyiPeringatanDarurat();
    }
}

function renderMarkersPublik() {
    markersPublik.forEach(m => m.remove());
    markersPublik = [];

    const sekarang = new Date().getTime();

    laporanList.forEach(item => {
        const waktuBuat = new Date(item.created_at).getTime();
        const selisihMenit = (sekarang - waktuBuat) / (1000 * 60);
        const isKritis = (item.status === 'Sedang Dicek' || item.status === 'Baru') && selisihMenit > 30;

        const el = buatElemenMarkerGlobal(item, selectedReportId, isKritis);

        const popup = new mapboxgl.Popup({ offset: 25 }).setHTML(`
            <div class="p-1 text-xs space-y-1">
                <b class="text-slate-800">${item.lokasi}</b><br>
                <span>Jenis: <b>${item.jenis}</b></span><br>
                <span>Status: <b>${item.status}</b></span>
                ${item.minta_bantuan ? '<br><span class="text-[10px] bg-red-100 text-red-700 font-bold px-1 rounded">🆘 MEMBUTUHKAN BANTUAN!</span>' : ''}
            </div>
        `);

        el.addEventListener('click', () => {
            selectedReportId = item.id;
            renderSidebar();
            renderMarkersPublik();
        });

        const marker = new mapboxgl.Marker(el)
            .setLngLat([item.lng, item.lat])
            .setPopup(popup)
            .addTo(map);

        markersPublik.push(marker);
    });
}

function toggleLayerFaskes(checkbox) {
    if (checkbox.checked) {
        dataFaskesSBTGlobal.forEach(f => {
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
    const kecamatanVal = document.getElementById('input-kecamatan').value;
    const desaVal = document.getElementById('input-desa').value;
    const lokasiGabungan = `Desa ${desaVal}, Kec. ${kecamatanVal}`;

    const idBaru = 'SBT-' + Math.floor(1000 + Math.random() * 9000);
    const dataBaru = {
        id: idBaru,
        nama: document.getElementById('warga-nama').value,
        telp: document.getElementById('warga-telp').value,
        jenis: document.getElementById('warga-jenis').value,
        lokasi: lokasiGabungan,
        ket: document.getElementById('warga-ket').value,
        status: 'Sedang Dicek',
        penanggung_jawab: '-',
        telp_petugas: '-',
        estimasi_selesai: null,
        lembaga_verifikasi: '-',
        lembaga_proses: '-',
        catatan_lapangan: '',
        lng: selectedCoords.lng,
        lat: selectedCoords.lat,
        created_at: buatTimestampLokal()
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
        const estimasiStr = data.estimasi_selesai ? new Date(data.estimasi_selesai).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WIT' : '-';
        hasilDiv.innerHTML = `
            <p><b>ID Laporan:</b> <code class="font-bold">${data.id}</code></p>
            <p><b>Lokasi:</b> ${data.lokasi}</p>
            <p><b>Jenis:</b> ${data.jenis}</p>
            <p><b>Status:</b> <span class="text-blue-600 font-bold">${data.status}</span></p>
            <p><b>Estimasi Selesai:</b> <span class="text-orange-600 font-bold">${estimasiStr}</span></p>
            <p><b>Instansi PJ:</b> ${data.penanggung_jawab}</p>
            <p><b>Kontak Posko:</b> ${data.telp_petugas !== '-' ? `<a href="tel:${data.telp_petugas}" class="text-blue-600 underline font-bold">${data.telp_petugas}</a>` : '-'}</p>
            <p><b>Keterangan:</b> ${data.ket}</p>
        `;
    } else {
        hasilDiv.innerHTML = `<p class="text-red-600 font-semibold">Nomor laporan tidak ditemukan.</p>`;
    }
}

window.addEventListener('click', () => {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (AudioContext) {
        const tempCtx = new AudioContext();
        if (tempCtx.state === 'suspended') {
            tempCtx.resume();
        }
    }
}, { once: true });

map.on('load', () => {
    loadMasterDataGlobal();
    ambilDataLaporan();
    cekAkunOnlineRealtime();
    
    setInterval(ambilDataLaporan, 5000);
    setInterval(cekAkunOnlineRealtime, 10000);
});
