mapboxgl.accessToken = CONFIG.MAPBOX_TOKEN;

let laporanList = [];
let markers = [];
let activeTab = 'Semua';
let currentUser = null;
let daftarKolaborasi = [];
let selectedReportId = null;

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
            id: sessionStorage.getItem('sbt_user_id'),
            username: sessionStorage.getItem('sbt_username'),
            nama_lembaga: sessionStorage.getItem('sbt_nama_lembaga'),
            role: sessionStorage.getItem('sbt_role'),
            telp_posko: sessionStorage.getItem('sbt_telp_posko')
        };
        
        if (currentUser.role === 'superadmin') {
            window.location.href = 'admin.html';
            return;
        }

        if (currentUser.role === 'petugas_kolaborasi') {
            window.location.href = 'kolaborator.html';
            return;
        }

        inisialisasiSesiHeader();
        muatFilterLembaga();
        ambilDataLaporan();
        setInterval(ambilDataLaporan, 5000);
    } else {
        window.location.href = 'login.html';
    }
};

async function logoutSession() {
    const usernameAktif = sessionStorage.getItem('sbt_username');
    
    if (usernameAktif) {
        await supabaseClient
            .from('users')
            .update({ status_online: 'OFFLINE' })
            .eq('username', usernameAktif);
    }

    sessionStorage.clear();
    window.location.href = 'index.html';
}

function inisialisasiSesiHeader() {
    const sapaan = document.getElementById('header-sapaan');
    const badge = document.getElementById('badge-role');

    if (currentUser.role === 'pimpinan') {
        sapaan.innerText = `Mode Pimpinan: ${currentUser.nama_lembaga}`;
        badge.innerText = 'MONITORING PIMPINAN';
        badge.className = 'bg-amber-600 text-[10px] px-2.5 py-1 rounded font-bold uppercase text-white';
    } else if (currentUser.nama_lembaga && currentUser.nama_lembaga.toLowerCase().includes('112')) {
        sapaan.innerText = `Call Center 112: ${currentUser.username}`;
        badge.innerText = 'OPERATOR 112';
        badge.className = 'bg-purple-600 text-[10px] px-2.5 py-1 rounded font-bold uppercase text-white';
    } else {
        sapaan.innerText = `Hi, ${currentUser.nama_lembaga} (${currentUser.username})`;
        badge.innerText = 'OPERASIONAL';
        badge.className = 'bg-[var(--sbt-orange)] text-[10px] px-2.5 py-1 rounded font-bold uppercase text-white';
    }
}

async function muatFilterLembaga() {
    const select = document.getElementById('select-filter-lembaga');
    if (!select) return;
    const { data, error } = await supabaseClient.from('lembaga').select('nama_lembaga').order('nama_lembaga');
    if (!error && data) {
        select.innerHTML = '<option value="">-- Semua Lembaga --</option>';
        data.forEach(item => {
            let opt = document.createElement('option');
            opt.value = item.nama_lembaga;
            opt.textContent = item.nama_lembaga;
            select.appendChild(opt);
        });
    }
}

async function ambilDataLaporan() {
    try {
        const { data: dataLaporan, error: errLaporan } = await supabaseClient.from('laporan').select('*').order('created_at', { ascending: false });
        if (errLaporan) console.error('Error laporan:', errLaporan.message);

        let dataKolaborasi = [];
        const { data: dataKolab, error: errKolab } = await supabaseClient.from('bantuan_kolaborasi').select('*');
        if (!errKolab && dataKolab) {
            dataKolaborasi = dataKolab;
        }

        laporanList = dataLaporan || [];
        daftarKolaborasi = dataKolaborasi;
        
        hitungBadgeTab();
        cekWarningKritis();
        renderTabel();
        renderMarkers();
    } catch (err) {
        console.error('Terjadi kesalahan saat memuat data:', err);
    }
}

function hitungBadgeTab() {
    const elBaru = document.getElementById('count-Baru');
    const elVerif = document.getElementById('count-Terverifikasi');
    const elProses = document.getElementById('count-Proses');
    const elSelesai = document.getElementById('count-Selesai');

    if (elBaru) elBaru.innerText = laporanList.filter(i => i.status === 'Baru').length;
    if (elVerif) elVerif.innerText = laporanList.filter(i => i.status === 'Terverifikasi').length;
    if (elProses) elProses.innerText = laporanList.filter(i => i.status === 'Proses').length;
    if (elSelesai) elSelesai.innerText = laporanList.filter(i => i.status === 'Selesai').length;
}

function cekWarningKritis() {
    const sekarang = new Date().getTime();
    const adaKritis = laporanList.some(item => {
        if (item.status === 'Baru') {
            const waktuLapor = new Date(item.created_at).getTime();
            const selisihMenit = (sekarang - waktuLapor) / (1000 * 60);
            return selisihMenit > 30;
        }
        return false;
    });

    const warningBox = document.getElementById('warning-box-30m');
    if (warningBox) {
        if (adaKritis) warningBox.classList.remove('hidden');
        else warningBox.classList.add('hidden');
    }
}

function gantiTab(tab) {
    activeTab = tab;
    ['Baru', 'Terverifikasi', 'Proses', 'Selesai', 'Semua'].forEach(t => {
        const btn = document.getElementById(`tab-${t}`);
        if (btn) {
            if (t === tab) {
                btn.className = 'py-3 px-1 border-b-2 border-red-600 text-red-700 bg-white font-bold transition';
            } else {
                btn.className = 'py-3 px-1 text-slate-600 hover:text-slate-900 font-normal transition';
            }
        }
    });

    const filterContainer = document.getElementById('filter-container');
    if (filterContainer) {
        if (tab === 'Semua') {
            filterContainer.classList.remove('hidden');
            muatFilterLembaga(); // Memastikan opsi dropdown filter terisi saat tab Semua dibuka
        } else {
            filterContainer.classList.add('hidden');
            const selectFilter = document.getElementById('select-filter-lembaga');
            if (selectFilter) selectFilter.value = '';
        }
    }

    renderTabel();
}

function renderTombolKontakAman(nomor) {
    if (!nomor) return '<span class="text-slate-400">-</span>';
    let cleanNum = nomor.replace(/[^0-9+]/g, '');
    if (cleanNum.startsWith('0')) {
        cleanNum = '62' + cleanNum.slice(1);
    }
    return `
        <div class="inline-flex items-center gap-1.5 mt-1">
            <a href="tel:${nomor}" title="Panggilan Telepon" class="bg-blue-600 hover:bg-blue-700 text-white px-2 py-1 rounded shadow-sm transition flex items-center justify-center text-[10px] font-bold">📞 Call</a>
            <a href="https://wa.me/${cleanNum}" target="_blank" title="WhatsApp Pelapor" class="bg-emerald-600 hover:bg-emerald-700 text-white px-2 py-1 rounded shadow-sm transition flex items-center justify-center text-[10px] font-bold">💬 WhatsApp</a>
        </div>
    `;
}

function formatIdentitasRingkas(namaUser, namaLembaga) {
    const lSingkat = namaLembaga ? namaLembaga.split(' ')[0] : 'Sektor';
    return `${namaUser || 'Petugas'} (${lSingkat})`;
}

function renderTabel() {
    const tbody = document.getElementById('table-body');
    if (!tbody) return;
    tbody.innerHTML = '';

    let filtered = laporanList;
    if (activeTab !== 'Semua') {
        filtered = laporanList.filter(i => i.status === activeTab);
    } else {
        const selectFilter = document.getElementById('select-filter-lembaga');
        const selectedLembagaFilter = selectFilter ? selectFilter.value : '';
        if (selectedLembagaFilter) {
            filtered = filtered.filter(i =>
                (i.lembaga_verifikasi && i.lembaga_verifikasi.includes(selectedLembagaFilter)) ||
                (i.lembaga_proses && i.lembaga_proses.includes(selectedLembagaFilter)) ||
                daftarKolaborasi.some(k => k.laporan_id === i.id && k.nama_lembaga.includes(selectedLembagaFilter))
            );
        }
    }

    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" class="p-8 text-center text-slate-400">Tidak ada data pada kategori ini.</td></tr>`;
        return;
    }

    const is112 = currentUser && currentUser.nama_lembaga && currentUser.nama_lembaga.toLowerCase().includes('112');
    const isPimpinan = currentUser && currentUser.role === 'pimpinan';

    filtered.forEach(item => {
        const badgeColor = item.jenis === 'Kebakaran' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700';

        const jamLapor = new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const waktuIdHTML = `
            <div class="leading-tight">
                <span class="font-display font-bold text-slate-900 text-sm">${jamLapor}</span><br>
                <span class="font-mono text-[10px] text-slate-400">${item.id}</span>
            </div>
        `;

        let tombolKontakHTML = '';
        if (item.status === 'Baru' || item.status === 'Terverifikasi') {
            tombolKontakHTML = renderTombolKontakAman(item.telp);
        }

        let infoStatus = `<span class="text-red-600 font-bold">Baru (Belum Verif)</span>`;
        if (item.status === 'Terverifikasi') {
            infoStatus = `
                <div class="text-[11px] space-y-0.5">
                    <span class="text-amber-600 font-bold">Diverifikasi Oleh:</span><br>
                    <span class="text-slate-700 font-medium">${item.nama_petugas_verif || '-'}</span>   
                </div>
            `;
        } else if (item.status === 'Proses') {
            const kolabLaporan = daftarKolaborasi.filter(k => k.laporan_id === item.id);
            let kolabBlokHTML = '';
            if (kolabLaporan.length > 0) {
                // TAMPILAN KOLABORASI: Bersih, hanya menampilkan nama lembaga saja tanpa deskripsi panjang
                kolabBlokHTML = `
                    <div class="mt-2 pt-1.5 border-t border-slate-100">
                        <p class="text-[10px] font-bold text-purple-700 uppercase">🤝 KOLABORASI LINTAS SEKTOR:</p>
                        <div class="text-[10px] text-slate-700 font-semibold mt-0.5 space-y-0.5">
                            ${kolabLaporan.map(k => `<div>• ${k.nama_lembaga}</div>`).join('')}
                        </div>
                    </div>
                `;
            }

            let alertDaruratHTML = '';
            if (item.minta_bantuan && kolabLaporan.length === 0) {
                alertDaruratHTML = `<div class="mt-1.5 bg-red-100 text-red-700 px-2 py-1 rounded text-[10px] font-bold animate-pulse text-center">🚨 BUTUH BANTUAN SEGERA!</div>`;
            }

            infoStatus = `
                <div class="space-y-1 text-[11px]">
                    <div class="bg-blue-50/70 p-2 rounded-lg border border-blue-100">
                        <p class="font-bold text-blue-900 text-[10px] uppercase">👨‍🚒 PENANGGUNG JAWAB UTAMA</p>
                        <p class="font-semibold text-slate-800">${item.lembaga_proses || '-'}</p>
                    </div>
                    ${alertDaruratHTML}
                    ${kolabBlokHTML}
                </div>
            `;
        } else if (item.status === 'Selesai') {
            infoStatus = `
                <div class="text-[11px] bg-green-50 p-2 rounded-lg border border-green-200">
                    <span class="text-green-700 font-bold block">🏁 Selesai Ditangani</span>
                    <span class="text-[10px] text-slate-600">${item.nama_petugas_selesai || ''}</span>
                </div>
            `;
        }

        let logRingkasHTML = '';
        if (item.catatan_lapangan) {
            const barisLog = item.catatan_lapangan.trim().split('\n');
            const updateTerakhir = barisLog[barisLog.length - 1];
            logRingkasHTML = `
                <div class="mt-2 p-2 bg-amber-50/60 border border-amber-200/80 rounded-lg text-[10.5px] text-slate-700">
                    <div class="flex justify-between items-center mb-0.5">
                        <p class="font-bold text-amber-800 text-[10px]">📝 Update Log Lapangan:</p>
                        <button onclick="event.stopPropagation(); bukaModalDetailLog('${item.id}')" class="text-[10px] text-blue-600 hover:underline font-bold">🔍 Lihat Semua (${barisLog.length})</button>
                    </div>
                    <p class="font-mono text-[10px] text-slate-600 leading-tight">${updateTerakhir}</p>
                </div>
            `;
        }

        const ketLaporan = item.ket ? `<p class="mt-1.5 text-slate-600 text-[11.5px] italic leading-relaxed">"${item.ket}"</p>` : `<p class="mt-1 text-slate-400 text-[11px] italic">Tanpa keterangan tambahan</p>`;

        let aksiHTML = '';
        if (isPimpinan) {
            aksiHTML = '<span class="text-[10px] text-slate-400 italic">Read-Only (Pimpinan)</span>';
        } else if (is112) {
            if (item.status === 'Baru') {
                aksiHTML = `<button onclick="event.stopPropagation(); aksiVerifikasi('${item.id}')" class="w-full bg-amber-600 text-white px-3 py-2 rounded-lg font-bold hover:bg-amber-700 text-xs shadow-sm transition">✅ Verifikasi (112)</button>`;
            } else {
                aksiHTML = `<span class="text-[10px] text-purple-700 font-semibold bg-purple-50 px-2.5 py-1 rounded-lg block text-center">Terkunci (Diteruskan)</span>`;
            }
        } else {
            let tombolKolaborasiHTML = '';
            let tombolMintaBantuanHTML = '';

            if (item.status === 'Proses') {
                const sudahKolab = daftarKolaborasi.some(k => k.laporan_id === item.id && k.nama_lembaga === currentUser.nama_lembaga);
                const isLembagaUtama = item.lembaga_proses === currentUser.nama_lembaga;

                if (!isLembagaUtama) {
                    if (sudahKolab) {
                        tombolKolaborasiHTML = `<span class="block text-center bg-purple-100 text-purple-700 px-3 py-1.5 rounded-lg text-[11px] font-bold">✓ Sudah Tergabung</span>`;
                    } else {
                        tombolKolaborasiHTML = `<button onclick="event.stopPropagation(); bukaModalKolaborasi('${item.id}')" class="w-full bg-purple-600 text-white px-3 py-2 rounded-lg font-bold hover:bg-purple-700 text-xs shadow-sm transition">🤝 Ikut Kolaborasi</button>`;
                    }
                }

                if (isLembagaUtama) {
                    if (item.minta_bantuan) {
                        tombolMintaBantuanHTML = `<button onclick="event.stopPropagation(); aksiMintaBantuan('${item.id}', false)" class="w-full bg-slate-500 text-white px-3 py-2 rounded-lg font-bold hover:bg-slate-600 text-xs shadow-sm transition">❌ Batalkan Minta Bantuan</button>`;
                    } else {
                        tombolMintaBantuanHTML = `<button onclick="event.stopPropagation(); aksiMintaBantuan('${item.id}', true)" class="w-full bg-red-600 text-white px-3 py-2 rounded-lg font-bold hover:bg-red-700 text-xs shadow-sm transition animate-pulse">🚨 Minta Bantuan</button>`;
                    }
                }
            }

            aksiHTML = `
                <div class="space-y-1.5 mt-2">
                    ${item.status === 'Baru' ? `<button onclick="event.stopPropagation(); aksiVerifikasi('${item.id}')" class="w-full bg-amber-600 text-white px-3 py-2 rounded-lg font-bold hover:bg-amber-700 text-xs shadow-sm transition">✅ Verifikasi</button>` : ''}
                    ${item.status === 'Terverifikasi' ? `<button onclick="event.stopPropagation(); bukaModalProses('${item.id}')" class="w-full bg-[var(--sbt-blue)] text-white px-3 py-2 rounded-lg font-bold hover:brightness-110 text-xs shadow-sm transition">🚀 Mulai Proses Utama</button>` : ''}
                    ${item.status === 'Proses' ? `
                        <button onclick="event.stopPropagation(); bukaModalCatatan('${item.id}')" class="w-full bg-emerald-600 text-white px-3 py-2 rounded-lg font-bold hover:bg-emerald-700 text-xs shadow-sm transition">➕ Tambah Log Lapangan</button>
                        ${tombolMintaBantuanHTML}
                        ${item.lembaga_proses === currentUser.nama_lembaga ? `<button onclick="event.stopPropagation(); aksiSelesai('${item.id}')" class="w-full bg-green-600 text-white px-3 py-2 rounded-lg font-bold hover:bg-green-700 text-xs shadow-sm transition">🏁 Selesai Penanganan</button>` : ''}
                    ` : ''}
                    ${tombolKolaborasiHTML}
                </div>
            `;
        }

        const tr = document.createElement('tr');
        const isSelected = selectedReportId === item.id;
        tr.className = `border-b transition-all duration-200 cursor-pointer ${
            selectedReportId !== null 
                ? (isSelected ? 'laporan-row-active' : 'laporan-row-dim') 
                : 'hover:bg-slate-50'
        }`;

        tr.innerHTML = `
            <td class="p-3 align-top">${waktuIdHTML}</td>
            <td class="p-3 align-top">
                <p class="font-bold text-slate-800">${item.nama || 'Warga'}</p>
                ${tombolKontakHTML}
            </td>
            <td class="p-3 align-top">
                <div class="flex items-center gap-2 mb-1">
                    <span class="font-bold text-slate-900 text-xs">📍 ${item.lokasi}</span>
                    <span class="text-[10px] px-2 py-0.5 rounded-md font-semibold ${badgeColor}">${item.jenis}</span>
                </div>
                ${ketLaporan}
                ${logRingkasHTML}
            </td>
            <td class="p-3 align-top">
                ${infoStatus}
                ${aksiHTML}
            </td>
        `;

        tr.onclick = () => {
            selectedReportId = item.id;
            renderTabel();
            renderMarkers();
            map.flyTo({ center: [item.lng, item.lat], zoom: 14 });
        };

        tbody.appendChild(tr);
    });
}

function renderMarkers() {
    markers.forEach(m => m.remove());
    markers = [];

    const sekarang = new Date().getTime();
    const filterStatusSelect = document.getElementById('map-filter-status');
    const filterJenisSelect = document.getElementById('map-filter-jenis');
    const filterStatus = filterStatusSelect ? filterStatusSelect.value : 'Semua';
    const filterJenis = filterJenisSelect ? filterJenisSelect.value : 'Semua';

    laporanList.forEach(item => {
        if (filterStatus !== 'Semua' && item.status !== filterStatus) return;
        if (filterJenis !== 'Semua' && item.jenis !== filterJenis) return;

        let color = '#ef4444';
        let isKritis = false;

        const waktuLapor = new Date(item.created_at).getTime();
        const selisihMenit = (sekarang - waktuLapor) / (1000 * 60);

        // Validasi ketat: Hanya Kritis jika status BARU dan benar-benar > 30 menit
        if (item.status === 'Baru') {
            color = '#ef4444';
            if (selisihMenit > 30) {
                isKritis = true;
            }
        } else if (item.status === 'Terverifikasi') {
            color = '#f59e0b';
        } else if (item.status === 'Proses') {
            color = '#3b82f6';
        } else if (item.status === 'Selesai') {
            color = '#22c55e';
        }

        const el = document.createElement('div');
        const isSelectedMarker = selectedReportId === item.id;

        if (isSelectedMarker) {
            el.className = `rounded-full shadow-2xl cursor-pointer border-4 border-white flex items-center justify-center font-black text-white text-xs`;
            el.style.width = '42px';
            el.style.height = '42px';
            el.style.backgroundColor = color;
            el.style.boxShadow = '0 0 0 6px rgba(198, 106, 61, 0.4)';
            el.innerText = '★';
        } else if (isKritis || item.minta_bantuan) {
            // Marker peta tetap ada penanda khusus untuk laporan yang sudah >30 menit atau minta bantuan
            el.className = `rounded-full shadow-2xl cursor-pointer border-4 border-white siaga-kritis flex items-center justify-center font-black text-white text-[10px]`;
            el.style.width = '36px';
            el.style.height = '36px';
            el.style.backgroundColor = '#dc2626';
            el.innerText = item.minta_bantuan ? '🆘' : '🚨';
        } else {
            el.className = `rounded-full shadow-md cursor-pointer border-2 border-white`;
            el.style.width = '28px';
            el.style.height = '28px';
            el.style.backgroundColor = color;
        }

        const popup = new mapboxgl.Popup({ offset: 25 }).setHTML(`
            <div class="p-1.5 text-xs space-y-1">
                <b class="text-slate-800">${item.lokasi} (${item.jenis})</b><br>
                <p class="italic text-slate-600">"${item.ket || 'Tanpa keterangan'}"</p>
                <span>Status: <b class="text-red-600">${item.status}</b></span>
                ${item.minta_bantuan ? '<br><span class="text-[10px] bg-red-100 text-red-700 font-bold px-1 rounded">🆘 MEMBUTUHKAN BANTUAN!</span>' : ''}
            </div>
        `);

        el.addEventListener('click', () => {
            selectedReportId = item.id;
            renderTabel();
            renderMarkers();
        });

        const marker = new mapboxgl.Marker(el)
            .setLngLat([item.lng, item.lat])
            .setPopup(popup)
            .addTo(map);
        
        markers.push(marker);
    });
}

async function aksiVerifikasi(id) {
    if (!confirm(`Verifikasi laporan ini atas nama instansi [${currentUser.nama_lembaga}]?`)) return;

    const ringkas = formatIdentitasRingkas(currentUser.username, currentUser.nama_lembaga);

    const { error } = await supabaseClient.from('laporan').update({
        status: 'Terverifikasi',
        lembaga_verifikasi: currentUser.nama_lembaga,
        nama_petugas_verif: ringkas
    }).eq('id', id);

    if (error) alert('Gagal: ' + error.message);
    else {
        activeTab = 'Terverifikasi';
        gantiTab('Terverifikasi');
        ambilDataLaporan();
    }
}

function bukaModalProses(id) {
    document.getElementById('proses-id-laporan').value = id;
    document.getElementById('label-lembaga-aktif').innerText = currentUser.nama_lembaga;
    document.getElementById('input-telp-petugas').value = currentUser.telp_posko || '-';
    document.getElementById('modal-proses').classList.remove('hidden');
}

function tutupModalProses() { document.getElementById('modal-proses').classList.add('hidden'); }

document.getElementById('form-proses').addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('proses-id-laporan').value;
    const telp = currentUser.telp_posko || '-';
    const jam = parseFloat(document.getElementById('input-estimasi-jam').value) || 1;

    const ringkas = formatIdentitasRingkas(currentUser.username, currentUser.nama_lembaga);
    const logBaru = `[${new Date().toLocaleTimeString()}] ${ringkas} mulai menangani utama\n`;

    const itemLama = laporanList.find(i => i.id === id);
    const gabungLog = (itemLama.catatan_lapangan || '') + logBaru;

    const { error } = await supabaseClient.from('laporan').update({
        status: 'Proses',
        lembaga_proses: currentUser.nama_lembaga,
        nama_petugas_proses: ringkas,
        penanggung_jawab: currentUser.nama_lembaga,
        telp_petugas: telp,
        catatan_lapangan: gabungLog,
        estimasi_selesai: new Date(Date.now() + (jam * 3600000)).toISOString()
    }).eq('id', id);

    if (error) alert('Gagal: ' + error.message);
    else {
        tutupModalProses();
        activeTab = 'Proses';
        gantiTab('Proses');
        ambilDataLaporan();
    }
});

async function aksiMintaBantuan(id, statusBantuan) {
    const pesan = statusBantuan ? 'Aktifkan status Minta Bantuan / Butuh Kolaborasi untuk laporan ini?' : 'Nonaktifkan status Minta Bantuan?';
    if (!confirm(pesan)) return;

    const ringkas = formatIdentitasRingkas(currentUser.username, currentUser.nama_lembaga);
    const itemLama = laporanList.find(i => i.id === id);
    const logBaru = statusBantuan
        ? `[${new Date().toLocaleTimeString()}] 🆘 ${ringkas} BUTUH BANTUAN LINTAS SEKTOR.\n`
        : `[${new Date().toLocaleTimeString()}] ✓ ${ringkas} mencabut status minta bantuan.\n`;

    const gabungLog = (itemLama.catatan_lapangan || '') + logBaru;

    const { error } = await supabaseClient.from('laporan').update({
        minta_bantuan: statusBantuan,
        catatan_lapangan: gabungLog
    }).eq('id', id);

    if (error) alert('Gagal: ' + error.message);
    else ambilDataLaporan();
}

function bukaModalKolaborasi(id) {
    document.getElementById('kolaborasi-id-laporan').value = id;
    document.getElementById('label-lembaga-kolaborasi').innerText = currentUser.nama_lembaga;
    document.getElementById('input-ket-bantuan').value = '';
    document.getElementById('modal-kolaborasi').classList.remove('hidden');
}

function tutupModalKolaborasi() {
    document.getElementById('modal-kolaborasi').classList.add('hidden');
}

document.getElementById('form-kolaborasi').addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('kolaborasi-id-laporan').value;
    const jenisBantuan = document.getElementById('input-jenis-bantuan').value;
    const ketBantuan = document.getElementById('input-ket-bantuan').value.trim();

    const ringkas = formatIdentitasRingkas(currentUser.username, currentUser.nama_lembaga);

    const { error: errKolaborasi } = await supabaseClient.from('bantuan_kolaborasi').insert([{
        laporan_id: id,
        nama_lembaga: currentUser.nama_lembaga,
        username_petugas: currentUser.username,
        jenis_bantuan: `${jenisBantuan}${ketBantuan ? ' - ' + ketBantuan : ''}`
    }]);

    if (errKolaborasi) {
        alert('Gagal mencatat kolaborasi: ' + errKolaborasi.message);
        return;
    }

    const itemLama = laporanList.find(i => i.id === id);
    
    // FORMAT LOG BANTUAN: Dibuat mencolok (bold/menyala) agar langsung ternotice di log lapangan
    const logBaru = `[${new Date().toLocaleTimeString()}] ⚡ BANTUAN MASUK dari <b>${currentUser.nama_lembaga}</b>: [${jenisBantuan}] ${ketBantuan}\n`;
    const gabungLog = (itemLama.catatan_lapangan || '') + logBaru;

    const updatePayload = { catatan_lapangan: gabungLog };
    if (itemLama.minta_bantuan) updatePayload.minta_bantuan = false;

    const { error: errUpdate } = await supabaseClient.from('laporan').update(updatePayload).eq('id', id);

    if (errUpdate) {
        alert('Gagal memperbarui log laporan: ' + errUpdate.message);
    } else {
        tutupModalKolaborasi();
        alert('Berhasil bergabung dalam kolaborasi penanganan laporan ini!');
        ambilDataLaporan();
    }
});

function bukaModalCatatan(id) {
    document.getElementById('catatan-id-laporan').value = id;
    document.getElementById('input-teks-catatan').value = '';
    document.getElementById('modal-catatan').classList.remove('hidden');
}

function tutupModalCatatan() { document.getElementById('modal-catatan').classList.add('hidden'); }

document.getElementById('form-catatan').addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('catatan-id-laporan').value;
    const teks = document.getElementById('input-teks-catatan').value;

    const ringkas = formatIdentitasRingkas(currentUser.username, currentUser.nama_lembaga);
    const itemLama = laporanList.find(i => i.id === id);
    const logBaru = `[${new Date().toLocaleTimeString()}] (${ringkas}): ${teks}\n`;
    const gabungLog = (itemLama.catatan_lapangan || '') + logBaru;

    const { error } = await supabaseClient.from('laporan').update({
        catatan_lapangan: gabungLog
    }).eq('id', id);

    if (error) alert('Gagal: ' + error.message);
    else {
        tutupModalCatatan();
        ambilDataLaporan();
    }
});

async function aksiSelesai(id) {
    if (!confirm('Tandai laporan ini sudah SELESAI penanganannya?')) return;

    const ringkas = formatIdentitasRingkas(currentUser.username, currentUser.nama_lembaga);
    const itemLama = laporanList.find(i => i.id === id);

    const kolabLaporan = daftarKolaborasi.filter(k => k.laporan_id === id);
    let daftarLembagaBantu = currentUser.nama_lembaga;
    if (kolabLaporan.length > 0) {
        const namaKolabUnik = [...new Set(kolabLaporan.map(k => k.nama_lembaga))];
        daftarLembagaBantu += ', ' + namaKolabUnik.join(', ');
    }

    const logBaru = `[${new Date().toLocaleTimeString()}] (${ringkas}): SELESAI ditangani oleh [${daftarLembagaBantu}].\n`;
    const gabungLog = (itemLama.catatan_lapangan || '') + logBaru;

    const { error } = await supabaseClient.from('laporan').update({
        status: 'Selesai',
        nama_petugas_selesai: `${ringkas} (Dibantu: ${daftarLembagaBantu})`,
        catatan_lapangan: gabungLog,
        minta_bantuan: false
    }).eq('id', id);

    if (error) alert('Gagal: ' + error.message);
    else {
        activeTab = 'Selesai';
        gantiTab('Selesai');
        ambilDataLaporan();
    }
}

function bukaModalDetailLog(id) {
    const item = laporanList.find(i => i.id === id);
    if (!item) return;

    let modal = document.getElementById('modal-view-log');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'modal-view-log';
        modal.className = 'fixed inset-0 bg-black/50 z-50 flex justify-center items-center p-3';
        document.body.appendChild(modal);
    }

    modal.innerHTML = `
        <div class="bg-white rounded-xl max-w-lg w-full p-5 shadow-2xl text-xs space-y-3">
            <div class="flex justify-between items-center border-b pb-2">
                <div>
                    <h3 class="font-bold text-sm text-slate-800">📄 Riwayat Lengkap Log Lapangan</h3>
                    <p class="text-[10px] text-slate-500">ID Laporan: <span class="font-mono">${item.id}</span> - ${item.lokasi}</p>
                </div>
                <button onclick="document.getElementById('modal-view-log').remove()" class="text-slate-400 hover:text-slate-600 font-bold text-base px-2">✕</button>
            </div>
            <div class="bg-slate-50 p-3 rounded-lg border border-slate-200 font-mono text-[11px] text-slate-700 max-h-72 overflow-y-auto whitespace-pre-line leading-relaxed">
                ${item.catatan_lapangan || 'Belum ada catatan log lapangan.'}
            </div>
            <div class="text-right">
                <button onclick="document.getElementById('modal-view-log').remove()" class="bg-slate-700 hover:bg-slate-800 text-white px-4 py-2 rounded-lg font-bold text-xs">Tutup</button>
            </div>
        </div>
    `;
}

map.on('load', () => {
    ambilDataLaporan();
    setInterval(ambilDataLaporan, 5000);
});
