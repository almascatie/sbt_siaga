// ===========================================================
// KOLABORATOR SCRIPT — PUSAT KOORDINASI BANTUAN SBT
// ===========================================================

mapboxgl.accessToken = CONFIG.MAPBOX_TOKEN;

let laporanList = [];
let markers = [];
let activeTab = 'Verifikasi';
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
            nama_lengkap: sessionStorage.getItem('sbt_nama_lengkap') || sessionStorage.getItem('sbt_username'),
            nama_lembaga: sessionStorage.getItem('sbt_nama_lembaga'),
            role: sessionStorage.getItem('sbt_role'),
            telp_posko: sessionStorage.getItem('sbt_telp_posko')
        };
        
        if (currentUser.role === 'superadmin') {
            window.location.href = 'admin.html';
            return;
        }

        // Set status online di database saat halaman kolaborator berhasil dimuat
        updateStatusOnlineDB('ONLINE');

        inisialisasiSesiHeader();
        ambilDataLaporan();
        setInterval(ambilDataLaporan, 5000);
    } else {
        window.location.href = 'login.html';
    }
};

// Fungsi bantu untuk memperbarui status online/offline ke Supabase secara konsisten
async function updateStatusOnlineDB(statusText) {
    const userIdAktif = sessionStorage.getItem('sbt_user_id');
    const usernameAktif = sessionStorage.getItem('sbt_username');
    
    if (!userIdAktif && !usernameAktif) return;

    try {
        let query = supabaseClient.from('users').update({ status_online: statusText });
        if (userIdAktif) {
            query = query.eq('id', userIdAktif);
        } else {
            query = query.eq('username', usernameAktif);
        }
        await query;
    } catch (err) {
        console.warn('Gagal memperbarui status online:', err);
    }
}

// Fungsi Logout Session yang tuntas menunggu update offline ke Supabase
async function logoutSession() {
    await updateStatusOnlineDB('OFFLINE');
    sessionStorage.clear();
    window.location.href = 'login.html';
}

// Penanganan otomatis ketika petugas menutup tab/browser secara langsung tanpa klik tombol Keluar
window.addEventListener('beforeunload', () => {
    const userIdAktif = sessionStorage.getItem('sbt_user_id');
    const usernameAktif = sessionStorage.getItem('sbt_username');
    
    if (!userIdAktif && !usernameAktif) return;

    const supabaseUrl = window.CONFIG ? window.CONFIG.SUPABASE_URL : window.SUPABASE_URL;
    const supabaseKey = window.CONFIG ? window.CONFIG.SUPABASE_ANON_KEY : window.SUPABASE_ANON_KEY;

    if (supabaseUrl && supabaseKey) {
        const targetQuery = userIdAktif ? `id=eq.${userIdAktif}` : `username=eq.${usernameAktif}`;
        const endpoint = `${supabaseUrl}/rest/v1/users?${targetQuery}`;
        const payload = JSON.stringify({ status_online: 'OFFLINE' });

        fetch(endpoint, {
            method: 'PATCH',
            headers: {
                'apikey': supabaseKey,
                'Authorization': `Bearer ${supabaseKey}`,
                'Content-Type': 'application/json',
                'Prefer': 'return=minimal'
            },
            body: payload,
            keepalive: true
        }).catch(err => console.log('Unload status update error:', err));
    }
});

function inisialisasiSesiHeader() {
    const sapaan = document.getElementById('header-sapaan');
    if (sapaan) {
        sapaan.innerText = `Mitra: ${currentUser.nama_lembaga} (${currentUser.username})`;
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
        renderCards();
        renderMarkers();
    } catch (err) {
        console.error('Gagal memuat data kolaborasi:', err);
    }
}

function hitungBadgeTab() {
    const countVerif = laporanList.filter(i => i.status === 'Terverifikasi' || i.status === 'Baru').length;
    const countProses = laporanList.filter(i => i.status === 'Proses' && !i.minta_bantuan).length;
    const countDarurat = laporanList.filter(i => i.status === 'Proses' && i.minta_bantuan === true).length;

    const elVerif = document.getElementById('count-Verifikasi');
    const elProses = document.getElementById('count-Proses');
    const elDarurat = document.getElementById('count-Darurat');

    if (elVerif) elVerif.innerText = countVerif;
    if (elProses) elProses.innerText = countProses;
    if (elDarurat) elDarurat.innerText = countDarurat;
}

function gantiTab(tab) {
    activeTab = tab;
    ['Verifikasi', 'Proses', 'Darurat', 'BantuanSaya'].forEach(t => {
        const btn = document.getElementById(`tab-${t}`);
        if (btn) {
            if (t === tab) {
                btn.className = 'py-3 px-1 border-b-2 border-purple-600 text-purple-700 bg-purple-50/50 font-bold transition';
            } else {
                btn.className = 'py-3 px-1 text-slate-600 hover:text-slate-900 transition font-normal';
            }
        }
    });

    renderCards();
}

// Format ringkas timeline (3 aktivitas terakhir)
function ambilRingkasanTimeline(catatan) {
    if (!catatan) return '<div class="text-[10px] text-slate-400 italic">Belum ada aktivitas tercatat.</div>';
    const baris = catatan.trim().split('\n').filter(b => b.trim() !== '');
    const ambilTigaTerakhir = baris.slice(-3);
    
    return ambilTigaTerakhir.map(b => `<div class="text-[10.5px] text-slate-600 font-mono leading-tight">• ${b}</div>`).join('');
}

function renderCards() {
    const container = document.getElementById('card-container');
    if (!container) return;
    container.innerHTML = '';

    let filtered = [];

    if (activeTab === 'Verifikasi') {
        filtered = laporanList.filter(i => i.status === 'Baru' || i.status === 'Terverifikasi');
    } else if (activeTab === 'Proses') {
        filtered = laporanList.filter(i => i.status === 'Proses' && !i.minta_bantuan);
    } else if (activeTab === 'Darurat') {
        filtered = laporanList.filter(i => i.status === 'Proses' && i.minta_bantuan === true);
    } else if (activeTab === 'BantuanSaya') {
        // Menyaring laporan di mana lembaga pengguna saat ini sudah tergabung dalam bantuan_kolaborasi
        const idLaporanDibantu = daftarKolaborasi
            .filter(k => k.nama_lembaga === currentUser.nama_lembaga)
            .map(k => k.laporan_id);
        
        filtered = laporanList.filter(i => idLaporanDibantu.includes(i.id) && i.status !== 'Selesai');
    }

    if (filtered.length === 0) {
        container.innerHTML = `
            <div class="p-10 text-center text-slate-400 text-xs bg-white rounded-xl border border-dashed border-slate-200 mt-4">
                Tidak ada laporan pada kategori ini saat ini.
            </div>
        `;
        return;
    }

    filtered.forEach(item => {
        const jamLapor = new Date(item.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', hour12: false });
        const badgeColor = item.jenis === 'Kebakaran' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700';

        // Cek apakah lembaga saat ini sudah bergabung di laporan ini
        const sudahGabung = daftarKolaborasi.some(k => k.laporan_id === item.id && k.nama_lembaga === currentUser.nama_lembaga);
        
        // Daftar instansi lain yang ikut membantu
        const instansiBantu = daftarKolaborasi.filter(k => k.laporan_id === item.id).map(k => k.nama_lembaga);
        const uniqueInstansi = [...new Set(instansiBantu)];

        let statusBadgeHTML = '';
        if (item.status === 'Baru' || item.status === 'Terverifikasi') {
            statusBadgeHTML = `<span class="bg-amber-100 text-amber-800 text-[10px] px-2.5 py-1 rounded-full font-bold">🟡 Dalam Verifikasi</span>`;
        } else if (item.status === 'Proses' && !item.minta_bantuan) {
            statusBadgeHTML = `<span class="bg-blue-100 text-blue-800 text-[10px] px-2.5 py-1 rounded-full font-bold">🔵 Sedang Diproses (${item.lembaga_proses || 'Sektor Utama'})</span>`;
        } else if (item.status === 'Proses' && item.minta_bantuan) {
            statusBadgeHTML = `<span class="bg-red-100 text-red-700 text-[10px] px-2.5 py-1 rounded-full font-bold animate-pulse">🚨 Butuh Bantuan Sektoral!</span>`;
        }

        // Tombol CTA Sesuai Kondisi
        let ctaButtonHTML = '';
        if (activeTab === 'Verifikasi') {
            ctaButtonHTML = `<div class="text-[10px] text-slate-400 italic text-center py-1 bg-slate-50 rounded">Menunggu verifikasi & penanganan sektor utama</div>`;
        } else {
            if (sudahGabung) {
                ctaButtonHTML = `
                    <button onclick="bukaModalCatatan('${item.id}')" class="w-full bg-slate-800 hover:bg-slate-900 text-white py-2 rounded-lg font-bold text-xs shadow-sm transition flex items-center justify-center gap-1.5">
                        📝 Tambah Catatan Progress
                    </button>
                `;
            } else {
                ctaButtonHTML = `
                    <button onclick="bukaModalKolaborasi('${item.id}')" class="w-full bg-purple-700 hover:bg-purple-800 text-white py-2 rounded-lg font-bold text-xs shadow-sm transition flex items-center justify-center gap-1.5">
                        🤝 Ikut Membantu
                    </button>
                `;
            }
        }

        const isSelected = selectedReportId === item.id;
        const cardClass = isSelected 
            ? 'bg-white border-2 border-purple-600 rounded-xl p-4 shadow-md kolab-card' 
            : 'bg-white border border-slate-200 rounded-xl p-4 shadow-xs kolab-card';

        const card = document.createElement('div');
        card.className = cardClass;
        card.innerHTML = `
            <div class="flex justify-between items-start mb-2">
                <div>
                    <div class="flex items-center gap-2">
                        <span class="font-bold text-slate-900 text-sm">📍 ${item.lokasi}</span>
                        <span class="text-[10px] px-2 py-0.5 rounded-md font-semibold ${badgeColor}">${item.jenis}</span>
                    </div>
                    <p class="text-[10px] text-slate-400 font-mono mt-0.5">${item.id} • ${jamLapor}</p>
                </div>
                <div>${statusBadgeHTML}</div>
            </div>

            <div class="space-y-1.5 my-2.5 text-xs">
                <p class="text-slate-700 italic bg-slate-50 p-2 rounded border border-slate-100">"${item.ket || 'Tanpa keterangan tambahan.'}"</p>
                <div class="flex justify-between text-[11px] text-slate-500 px-0.5">
                    <span>Pelapor: <b class="text-slate-700">${item.nama || 'Warga'}</b></span>
                    <span>Utama: <b class="text-slate-700">${item.lembaga_proses || '-'}</b></span>
                </div>
            </div>

            ${uniqueInstansi.length > 0 ? `
                <div class="my-2 p-2 bg-purple-50/50 rounded-lg border border-purple-100 text-[11px]">
                    <span class="font-bold text-purple-900">🤝 Instansi Tergabung:</span>
                    <span class="text-slate-700">${uniqueInstansi.join(', ')}</span>
                </div>
            ` : ''}

            <div class="my-2 pt-2 border-t border-slate-100 space-y-1">
                <p class="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Ringkasan Timeline:</p>
                <div class="bg-slate-50 p-2 rounded space-y-1">
                    ${ambilRingkasanTimeline(item.catatan_lapangan)}
                </div>
            </div>

            <div class="mt-3 pt-2 border-t border-slate-100">
                ${ctaButtonHTML}
            </div>
        `;

        card.onclick = () => {
            selectedReportId = item.id;
            renderCards();
            renderMarkers();
            map.flyTo({ center: [item.lng, item.lat], zoom: 14 });
        };

        container.appendChild(card);
    });
}

function renderMarkers() {
    markers.forEach(m => m.remove());
    markers = [];

    laporanList.forEach(item => {
        let color = '#f59e0b';
        if (item.status === 'Proses' && !item.minta_bantuan) color = '#3b82f6';
        if (item.status === 'Proses' && item.minta_bantuan) color = '#dc2626';

        const el = document.createElement('div');
        const isSelected = selectedReportId === item.id;

        if (isSelected) {
            el.className = `rounded-full shadow-xl cursor-pointer border-4 border-white flex items-center justify-center font-black text-white text-xs`;
            el.style.width = '38px';
            el.style.height = '38px';
            el.style.backgroundColor = color;
            el.style.boxShadow = '0 0 0 5px rgba(147, 51, 234, 0.4)';
            el.innerText = '★';
        } else if (item.minta_bantuan) {
            el.className = `rounded-full shadow-lg cursor-pointer border-2 border-white siaga-kritis flex items-center justify-center font-bold text-white text-[10px]`;
            el.style.width = '32px';
            el.style.height = '32px';
            el.style.backgroundColor = '#dc2626';
            el.innerText = '🚨';
        } else {
            el.className = `rounded-full shadow-sm cursor-pointer border-2 border-white`;
            el.style.width = '24px';
            el.style.height = '24px';
            el.style.backgroundColor = color;
        }

        const popup = new mapboxgl.Popup({ offset: 25 }).setHTML(`
            <div class="p-1 text-xs space-y-1">
                <b class="text-slate-800">${item.lokasi} (${item.jenis})</b><br>
                <p class="italic text-slate-600">"${item.ket || 'Tanpa keterangan'}"</p>
                <span>Status: <b class="text-purple-700">${item.status}</b></span>
            </div>
        `);

        el.addEventListener('click', () => {
            selectedReportId = item.id;
            renderCards();
            renderMarkers();
        });

        const marker = new mapboxgl.Marker(el)
            .setLngLat([item.lng, item.lat])
            .setPopup(popup)
            .addTo(map);
        
        markers.push(marker);
    });
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

document.getElementById('form-kolaborasi')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('kolaborasi-id-laporan').value;
    const jenisBantuan = document.getElementById('input-jenis-bantuan').value;
    const ketBantuan = document.getElementById('input-ket-bantuan').value.trim();

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
    const logBaru = `[${new Date().toLocaleTimeString()}] ⚡ BANTUAN MASUK dari <b>${currentUser.nama_lembaga}</b>: [${jenisBantuan}] ${ketBantuan}\n`;
    const gabungLog = (itemLama.catatan_lapangan || '') + logBaru;

    const updatePayload = { catatan_lapangan: gabungLog };
    if (itemLama.minta_bantuan) updatePayload.minta_bantuan = false;

    await supabaseClient.from('laporan').update(updatePayload).eq('id', id);

    tutupModalKolaborasi();
    alert('Berhasil bergabung dalam penanganan laporan ini!');
    ambilDataLaporan();
});

function bukaModalCatatan(id) {
    document.getElementById('catatan-id-laporan').value = id;
    document.getElementById('input-teks-catatan').value = '';
    document.getElementById('modal-catatan').classList.remove('hidden');
}

function tutupModalCatatan() {
    document.getElementById('modal-catatan').classList.add('hidden');
}

document.getElementById('form-catatan')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('catatan-id-laporan').value;
    const teks = document.getElementById('input-teks-catatan').value.trim();

    const ringkas = `${currentUser.username} (${currentUser.nama_lembaga.split(' ')[0]})`;
    const itemLama = laporanList.find(i => i.id === id);
    const logBaru = `[${new Date().toLocaleTimeString()}] (${ringkas}): ${teks}\n`;
    const gabungLog = (itemLama.catatan_lapangan || '') + logBaru;

    const { error } = await supabaseClient.from('laporan').update({
        catatan_lapangan: gabungLog
    }).eq('id', id);

    if (error) {
        alert('Gagal mengirim catatan: ' + error.message);
    } else {
        tutupModalCatatan();
        ambilDataLaporan();
    }
});

map.on('load', () => {
    ambilDataLaporan();
    setInterval(ambilDataLaporan, 5000);
});
