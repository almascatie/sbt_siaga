mapboxgl.accessToken = CONFIG.MAPBOX_TOKEN;

let laporanList = [];
let daftarKolaborasi = [];
let markers = [];
let activeTab = 'LogAktivitas';
let filterStatusTabel = 'Semua';
let currentUser = null;

// Inisialisasi Mapbox dengan style terang
const map = new mapboxgl.Map({
    container: 'map',
    style: 'mapbox://styles/mapbox/streets-v12',
    center: [130.4850, -3.1500],
    zoom: 11
});

window.onload = () => {
    const isLogged = sessionStorage.getItem('sbt_logged_in');
    if (isLogged === 'true') {
        currentUser = {
            username: sessionStorage.getItem('sbt_username'),
            nama_lembaga: sessionStorage.getItem('sbt_nama_lembaga'),
            role: sessionStorage.getItem('sbt_role')
        };

        document.getElementById('header-sapaan').innerText = `Pemantauan Eksekutif: ${sederhanakanTeks(currentUser.nama_lembaga, 30)}`;
        
        ambilDataPimpinan();
        setInterval(ambilDataPimpinan, 5000);
    } else {
        window.location.href = 'login.html';
    }
};

function logoutSession() {
    sessionStorage.clear();
    window.location.href = 'login.html';
}

function sederhanakanTeks(teks, batasMaksimal = 25) {
    if (!teks) return '-';
    if (teks.length <= batasMaksimal) return teks;
    return teks.substring(0, batasMaksimal) + '...';
}

async function ambilDataPimpinan() {
    try {
        const { data: dataLaporan } = await supabaseClient.from('laporan').select('*').order('created_at', { ascending: false });
        const { data: dataKolab } = await supabaseClient.from('bantuan_kolaborasi').select('*');

        laporanList = dataLaporan || [];
        daftarKolaborasi = dataKolab || [];

        hitungStatistik();
        renderPanel();
        renderMarkers();
    } catch (err) {
        console.error(err);
    }
}

function hitungStatistik() {
    let verif = 0, proses = 0, darurat = 0, selesai = 0;

    laporanList.forEach(i => {
        const st = (i.status || '').toLowerCase();
        if (st.includes('verif') || st.includes('pending') || st.includes('menunggu')) {
            verif++;
        } else if (st.includes('proses')) {
            proses++;
            if (i.minta_bantuan) darurat++;
        } else if (st.includes('selesai')) {
            selesai++;
        }
    });

    document.getElementById('stat-verif').innerText = verif;
    document.getElementById('stat-proses').innerText = proses;
    document.getElementById('stat-darurat').innerText = darurat;
    document.getElementById('stat-selesai').innerText = selesai;
}

function filterDariStatistik(kategori) {
    filterStatusTabel = kategori;
    gantiTab('SemuaLaporan');
}

function gantiTab(tab) {
    activeTab = tab;
    ['LogAktivitas', 'SemuaLaporan', 'KolaborasiLembaga'].forEach(t => {
        const btn = document.getElementById(`tab-${t}`);
        if (t === tab) {
            btn.className = 'py-3 px-1 border-b-2 border-amber-500 text-amber-600 bg-slate-100 font-bold';
        } else {
            btn.className = 'py-3 px-1 text-slate-500 hover:text-slate-900 font-normal bg-transparent';
        }
    });
    renderPanel();
}

function renderPanel() {
    const container = document.getElementById('panel-konten');
    
    if (activeTab === 'LogAktivitas') {
        if (laporanList.length === 0) {
            container.innerHTML = `<div class="p-8 text-center text-slate-400 text-xs">Belum ada data laporan.</div>`;
            return;
        }

        // Jika container belum punya struktur list, bersihkan sekali
        if (!container.dataset.renderedTab || container.dataset.renderedTab !== 'LogAktivitas') {
            container.innerHTML = '';
            container.dataset.renderedTab = 'LogAktivitas';
        }

        laporanList.forEach(item => {
            const inputId = `input-komentar-${item.id}`;
            const existingInput = document.getElementById(inputId);
            const teksSedangDiketik = existingInput ? existingInput.value : '';

            let card = document.getElementById(`card-laporan-${item.id}`);
            
            if (!card) {
                card = document.createElement('div');
                card.id = `card-laporan-${item.id}`;
                card.className = 'bg-white border border-slate-200 rounded-xl p-4 space-y-3 shadow-sm';
                container.appendChild(card);
            }

            let catatanBersih = item.catatan_lapangan || 'Belum ada aktivitas penanganan lapangan tercatat.';
            let namaPelapor = sederhanakanTeks(item.nama || 'Warga', 20);
            let lokasiLaporan = sederhanakanTeks(item.lokasi, 35);
            
            card.innerHTML = `
                <div class="flex justify-between items-start border-b border-slate-100 pb-2 cursor-pointer" onclick="map.flyTo({ center: [${item.lng}, ${item.lat}], zoom: 14 })">
                    <div>
                        <span class="bg-amber-100 text-amber-700 font-bold text-[10px] px-2 py-0.5 rounded uppercase">${item.jenis}</span>
                        <h3 class="text-slate-900 font-bold text-sm mt-1">📍 Lokasi: ${lokasiLaporan}</h3>
                        <p class="text-slate-500 text-[11px]">Pelapor: <b class="text-slate-700">${namaPelapor}</b> | Waktu: ${new Date(item.created_at).toLocaleString()}</p>
                    </div>
                    <span class="text-[10px] bg-slate-100 text-slate-700 px-2 py-1 rounded font-semibold">${item.status}</span>
                </div>
                
                <div class="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-1.5">
                    <p class="text-[10px] text-amber-600 font-bold uppercase tracking-wider">Kronologi & Aktivitas Lapangan:</p>
                    <div class="text-slate-700 text-xs whitespace-pre-line leading-relaxed font-sans">${catatanBersih}</div>
                </div>

                <div class="pt-1 flex gap-2">
                    <input type="text" id="${inputId}" placeholder="Tulis instruksi atau apresiasi pimpinan..." class="flex-1 bg-white border border-slate-300 rounded p-2 text-xs text-slate-900 outline-none focus:border-blue-500">
                    <button onclick="kirimKomentarPimpinan('${item.id}')" class="bg-blue-600 hover:bg-blue-700 text-white font-bold px-4 py-2 rounded transition text-xs shadow">Kirim Pesan</button>
                </div>
            `;

            const newInput = document.getElementById(inputId);
            if (newInput && teksSedangDiketik) {
                newInput.value = teksSedangDiketik;
            }
        });

    } else {
        // Untuk tab Lainnya (SemuaLaporan & KolaborasiLembaga)
        container.dataset.renderedTab = activeTab;
        container.innerHTML = '';

        if (activeTab === 'SemuaLaporan') {
            if (laporanList.length === 0) {
                container.innerHTML = `<div class="p-8 text-center text-slate-400 text-xs">Tidak ada data laporan.</div>`;
                return;
            }

            const filterBar = document.createElement('div');
            filterBar.className = 'flex justify-between items-center mb-2 px-1 text-xs';
            filterBar.innerHTML = `
                <span class="text-slate-600 font-semibold">Filter Status: <b class="text-blue-600">${filterStatusTabel}</b></span>
                <button onclick="filterStatusTabel='Semua'; renderPanel();" class="text-slate-500 hover:text-slate-900 text-[11px] underline">Tampilkan Semua</button>
            `;
            container.appendChild(filterBar);

            const tableWrap = document.createElement('div');
            tableWrap.innerHTML = `
                <table class="w-full text-left border-collapse text-xs">
                    <thead class="bg-slate-100 sticky top-0 text-[10px] text-slate-600 uppercase border-b border-slate-200">
                        <tr>
                            <th class="p-2.5">Waktu Laporan & Pelapor</th>
                            <th class="p-2.5">Lokasi & Kejadian</th>
                            <th class="p-2.5">Penanggung Jawab</th>
                            <th class="p-2.5 text-center">Status</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-slate-100" id="tabel-semua-body"></tbody>
                </table>
            `;
            container.appendChild(tableWrap);

            const tbody = document.getElementById('tabel-semua-body');
            
            const laporanFiltered = laporanList.filter(item => {
                const stLower = (item.status || '').toLowerCase();
                if (filterStatusTabel === 'Verifikasi') return stLower.includes('verif') || stLower.includes('pending') || stLower.includes('menunggu');
                if (filterStatusTabel === 'Proses') return stLower.includes('proses') && !item.minta_bantuan;
                if (filterStatusTabel === 'Darurat') return stLower.includes('proses') && item.minta_bantuan;
                if (filterStatusTabel === 'Selesai') return stLower.includes('selesai');
                return true;
            });

            if (laporanFiltered.length === 0) {
                tbody.innerHTML = `<tr><td colspan="4" class="p-6 text-center text-slate-400">Tidak ada laporan dengan filter "${filterStatusTabel}".</td></tr>`;
                return;
            }

            laporanFiltered.forEach(item => {
                let badgeStatus = `<span class="bg-blue-100 text-blue-700 px-2 py-0.5 rounded text-[10px] font-bold">${item.status}</span>`;
                const stLower = (item.status || '').toLowerCase();
                if (stLower.includes('verif')) {
                    badgeStatus = `<span class="bg-amber-100 text-amber-700 px-2 py-0.5 rounded text-[10px] font-bold">Verifikasi</span>`;
                } else if (item.minta_bantuan) {
                    badgeStatus = `<span class="bg-red-100 text-red-700 px-2 py-0.5 rounded text-[10px] font-bold animate-pulse">Darurat</span>`;
                } else if (stLower.includes('selesai')) {
                    badgeStatus = `<span class="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded text-[10px] font-bold">Selesai</span>`;
                }

                const listKolab = daftarKolaborasi.filter(k => k.laporan_id === item.id);
                let infoPenanganan = '-';

                if (stLower.includes('verif')) {
                    infoPenanganan = `<span class="text-amber-600 italic">Menunggu verifikasi...</span>`;
                } else {
                    let teksLembaga = [];
                    if (item.catatan_lapangan) {
                        if (item.catatan_lapangan.includes('Damkar')) teksLembaga.push('Damkar SBT');
                        if (item.catatan_lapangan.includes('BPBD')) teksLembaga.push('BPBD SBT');
                    }
                    if (listKolab.length > 0) {
                        listKolab.forEach(k => teksLembaga.push(k.nama_lembaga));
                    }

                    if (teksLembaga.length > 0) {
                        infoPenanganan = `Ditangani: <b class="text-slate-800">${sederhanakanTeks([...new Set(teksLembaga)].join(', '), 30)}</b>`;
                    } else {
                        infoPenanganan = `<span class="text-slate-500">Petugas Utama</span>`;
                    }
                }

                const tr = document.createElement('tr');
                tr.className = 'hover:bg-slate-50 cursor-pointer';
                tr.innerHTML = `
                    <td class="p-2.5 font-mono text-[11px]">
                        <b class="text-slate-800">${sederhanakanTeks(item.nama || 'Warga', 18)}</b><br>
                        <span class="text-[10px] text-slate-400">${new Date(item.created_at).toLocaleString()}</span>
                    </td>
                    <td class="p-2.5">
                        <b class="text-amber-700">${sederhanakanTeks(item.lokasi, 25)}</b><br>
                        <span class="text-[10px] text-slate-500">${item.jenis}</span>
                    </td>
                    <td class="p-2.5 text-[11px] text-slate-600">${infoPenanganan}</td>
                    <td class="p-2.5 text-center">${badgeStatus}</td>
                `;
                tr.onclick = () => map.flyTo({ center: [item.lng, item.lat], zoom: 14 });
                tbody.appendChild(tr);
            });

        } else if (activeTab === 'KolaborasiLembaga') {
            if (laporanList.length === 0) {
                container.innerHTML = `<div class="p-8 text-center text-slate-400 text-xs">Belum ada data laporan.</div>`;
                return;
            }

            laporanList.forEach(item => {
                const listBantuan = daftarKolaborasi.filter(k => k.laporan_id === item.id);
                const card = document.createElement('div');
                card.className = 'bg-white border border-slate-200 rounded-xl p-4 space-y-3 shadow-sm';
                
                let daftarLembagaHtml = '';
                if (listBantuan.length > 0) {
                    listBantuan.forEach(b => {
                        daftarLembagaHtml += `
                            <div class="bg-slate-50 border border-slate-200 p-2.5 rounded-lg text-xs">
                                <span class="text-blue-700 font-bold">🏛️ ${sederhanakanTeks(b.nama_lembaga, 30)}</span> 
                                <span class="text-slate-500 text-[11px] ml-1">bantuan:</span>
                                <b class="text-slate-800 block mt-0.5">${sederhanakanTeks(b.jenis_bantuan, 40)}</b>
                            </div>
                        `;
                    });
                } else {
                    daftarLembagaHtml = `<p class="text-slate-400 text-xs italic">Belum ada bantuan kolaborasi lintas sektor.</p>`;
                }

                card.innerHTML = `
                    <div class="flex justify-between items-start border-b border-slate-100 pb-2 cursor-pointer" onclick="map.flyTo({ center: [${item.lng}, ${item.lat}], zoom: 14 })">
                        <div>
                            <span class="bg-purple-100 text-purple-700 font-bold text-[10px] px-2 py-0.5 rounded uppercase">${item.jenis}</span>
                            <h3 class="text-slate-900 font-bold text-sm mt-1">📍 Lokasi: ${sederhanakanTeks(item.lokasi, 35)}</h3>
                            <p class="text-slate-500 text-[11px]">Waktu: ${new Date(item.created_at).toLocaleString()} | Pelapor: <b class="text-slate-700">${sederhanakanTeks(item.nama || 'Warga', 20)}</b></p>
                        </div>
                        <span class="text-[10px] bg-slate-100 text-slate-700 px-2 py-1 rounded font-semibold">${item.status}</span>
                    </div>
                    <div class="space-y-2">
                        <p class="text-[10px] text-amber-600 font-bold uppercase tracking-wider">Daftar Lembaga Kolaborator:</p>
                        <div class="space-y-2">${daftarLembagaHtml}</div>
                    </div>
                `;
                container.appendChild(card);
            });
        }
    }
}

async function kirimKomentarPimpinan(id) {
    const inputEl = document.getElementById(`input-komentar-${id}`);
    const pesan = inputEl.value.trim();
    if (!pesan) return alert('Tuliskan pesan atau arahan terlebih dahulu.');

    const itemLama = laporanList.find(i => i.id === id);
    
    // Menggunakan username yang sedang aktif login (contoh: bupati, almas, dll)
    const namaPengirim = currentUser.username || 'Pimpinan';
    const formatPesan = `👑 [${new Date().toLocaleTimeStringモリ}] ${namaPengirim}: "${pesan}"\n`;

    const { error } = await supabaseClient.from('laporan').update({
        catatan_lapangan: (itemLama.catatan_lapangan || '') + formatPesan
    }).eq('id', id);

    if (error) {
        alert('Gagal mengirim pesan: ' + error.message);
    } else {
        inputEl.value = '';
        alert('Pesan berhasil ditambahkan ke log lapangan!');
        ambilDataPimpinan();
    }
}

function renderMarkers() {
    markers.forEach(m => m.remove());
    markers = [];

    const filterStatus = document.getElementById('filter-status-peta').value;
    const filterJenis = document.getElementById('filter-jenis-peta').value;

    laporanList.forEach(item => {
        const stLower = (item.status || '').toLowerCase();

        if (filterJenis !== 'Semua' && item.jenis !== filterJenis) return;
        if (filterStatus === 'Verifikasi' && !(stLower.includes('verif') || stLower.includes('pending') || stLower.includes('menunggu'))) return;
        if (filterStatus === 'Proses' && !(stLower.includes('proses') && !item.minta_bantuan)) return;
        if (filterStatus === 'Darurat' && !(stLower.includes('proses') && item.minta_bantuan)) return;
        if (filterStatus === 'Selesai' && !stLower.includes('selesai')) return;

        const el = document.createElement('div');
        if (stLower.includes('verif') || stLower.includes('pending') || stLower.includes('menunggu')) {
            el.className = `rounded-full shadow-md cursor-pointer border-2 border-white`;
            el.style.width = '24px';
            el.style.height = '24px';
            el.style.backgroundColor = '#f59e0b';
        } else if (stLower.includes('proses')) {
            if (item.minta_bantuan) {
                el.className = `rounded-full shadow-2xl cursor-pointer border-2 border-white siaga-kritis flex items-center justify-center font-black text-white text-[10px]`;
                el.style.width = '34px';
                el.style.height = '34px';
                el.style.backgroundColor = '#dc2626';
                el.innerText = '🆘';
            } else {
                el.className = `rounded-full shadow-md cursor-pointer border-2 border-white`;
                el.style.width = '26px';
                el.style.height = '26px';
                el.style.backgroundColor = '#3b82f6';
            }
        } else if (stLower.includes('selesai')) {
            el.className = `rounded-full shadow-md cursor-pointer border-2 border-white`;
            el.style.width = '22px';
            el.style.height = '22px';
            el.style.backgroundColor = '#10b981';
        } else {
            return;
        }

        const popupContent = `
            <div class="text-slate-900 text-xs space-y-1 p-1">
                <p class="font-bold border-b pb-1 text-blue-900">Lokasi: ${sederhanakanTeks(item.lokasi, 30)} (${item.status})</p>
                <p><b>Pelapor:</b> ${sederhanakanTeks(item.nama || 'Warga', 20)}</p>
                <p><b>Jenis:</b> ${item.jenis}</p>
                <p class="italic text-slate-600">"${sederhanakanTeks(item.ket || '-', 50)}"</p>
            </div>
        `;

        const marker = new mapboxgl.Marker(el)
            .setLngLat([item.lng, item.lat])
            .setPopup(new mapboxgl.Popup({ offset: 25 }).setHTML(popupContent))
            .addTo(map);
        markers.push(marker);
    });
}
