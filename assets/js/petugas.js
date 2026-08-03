        mapboxgl.accessToken = CONFIG.MAPBOX_TOKEN;

        let laporanList = [];
        let markers = [];
        let activeTab = 'Semua';
        let currentUser = null;
        let daftarKolaborasi = [];

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

                // PENJAGA: Jika akun kolaborator nekat masuk ke petugas.html, lempar balik ke halamannya
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

        function logoutSession() {
            sessionStorage.clear();
            window.location.href = 'login.html';
        }

        function inisialisasiSesiHeader() {
            const sapaan = document.getElementById('header-sapaan');
            const badge = document.getElementById('badge-role');

            if (currentUser.role === 'pimpinan') {
                sapaan.innerText = `Mode Pimpinan: ${currentUser.nama_lembaga}`;
                badge.innerText = 'MONITORING PIMPINAN';
                badge.className = 'bg-amber-600 text-[10px] px-2.5 py-1 rounded font-bold uppercase';
            } else if (currentUser.nama_lembaga && currentUser.nama_lembaga.toLowerCase().includes('112')) {
                sapaan.innerText = `Call Center 112: ${currentUser.username}`;
                badge.innerText = 'OPERATOR 112 (VERIFIKATOR)';
                badge.className = 'bg-purple-600 text-[10px] px-2.5 py-1 rounded font-bold uppercase';
            } else {
                sapaan.innerText = `Hi, ${currentUser.nama_lembaga} (${currentUser.username})`;
                badge.innerText = 'OPERASIONAL & KOLABORATOR';
                badge.className = 'bg-red-600 text-[10px] px-2.5 py-1 rounded font-bold uppercase';
            }
        }

        async function muatFilterLembaga() {
            const select = document.getElementById('select-filter-lembaga');
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
                renderTabel();
                renderMarkers();
            } catch (err) {
                console.error('Terjadi kesalahan saat memuat data:', err);
            }
        }

        function hitungBadgeTab() {
            document.getElementById('count-Baru').innerText = laporanList.filter(i => i.status === 'Baru').length;
            document.getElementById('count-Terverifikasi').innerText = laporanList.filter(i => i.status === 'Terverifikasi').length;
            document.getElementById('count-Proses').innerText = laporanList.filter(i => i.status === 'Proses').length;
            document.getElementById('count-Selesai').innerText = laporanList.filter(i => i.status === 'Selesai').length;
        }

        function gantiTab(tab) {
            activeTab = tab;
            ['Baru', 'Terverifikasi', 'Proses', 'Selesai', 'Semua'].forEach(t => {
                const btn = document.getElementById(`tab-${t}`);
                if (t === tab) {
                    btn.className = 'py-2.5 px-1 border-b-2 border-red-600 text-red-700 bg-white font-bold';
                } else {
                    btn.className = 'py-2.5 px-1 text-slate-600 hover:text-slate-900 font-normal';
                }
            });

            const filterContainer = document.getElementById('filter-container');
            if (tab === 'Semua') {
                filterContainer.classList.remove('hidden');
            } else {
                filterContainer.classList.add('hidden');
                document.getElementById('select-filter-lembaga').value = '';
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
                    <a href="tel:${nomor}" title="Panggilan Telepon" class="bg-blue-600 hover:bg-blue-700 text-white px-2 py-1 rounded shadow transition flex items-center justify-center text-[10px] font-bold">
                        📞 Call
                    </a>
                    <a href="https://wa.me/${cleanNum}" target="_blank" title="WhatsApp Pelapor" class="bg-emerald-600 hover:bg-emerald-700 text-white px-2 py-1 rounded shadow transition flex items-center justify-center text-[10px] font-bold">
                        💬 WhatsApp
                    </a>
                </div>
            `;
        }

        function renderTabel() {
            const tbody = document.getElementById('table-body');
            tbody.innerHTML = '';

            let filtered = laporanList;
            if (activeTab !== 'Semua') {
                filtered = laporanList.filter(i => i.status === activeTab);
            } else {
                const selectedLembagaFilter = document.getElementById('select-filter-lembaga').value;
                if (selectedLembagaFilter) {
                    filtered = filtered.filter(i =>
                        (i.lembaga_verifikasi && i.lembaga_verifikasi.includes(selectedLembagaFilter)) ||
                        (i.lembaga_proses && i.lembaga_proses.includes(selectedLembagaFilter)) ||
                        daftarKolaborasi.some(k => k.laporan_id === i.id && k.nama_lembaga.includes(selectedLembagaFilter))
                    );
                }
            }

            if (filtered.length === 0) {
                tbody.innerHTML = `<tr><td colspan="4" class="p-6 text-center text-slate-400">Tidak ada data pada kategori ini.</td></tr>`;
                return;
            }

            const is112 = currentUser && currentUser.nama_lembaga && currentUser.nama_lembaga.toLowerCase().includes('112');
            const isPimpinan = currentUser && currentUser.role === 'pimpinan';

            filtered.forEach(item => {
                const badgeColor = item.jenis === 'Kebakaran' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700';

                let infoStatus = `<span class="text-red-600 font-bold">Baru (Belum Verif)</span>`;
                if (item.status === 'Terverifikasi') {
                    infoStatus = `<span class="text-amber-600 font-bold">Terverifikasi oleh:</span><br><span class="text-[11px] text-slate-700">${item.nama_petugas_verif || item.lembaga_verifikasi || '-'}</span>`;
                } else if (item.status === 'Proses') {
                    const kolabLaporan = daftarKolaborasi.filter(k => k.laporan_id === item.id);
                    let badgeKolabHTML = '';
                    if (kolabLaporan.length > 0) {
                        badgeKolabHTML = `<div class="mt-1 pt-1 border-t border-blue-100 text-[10px] text-purple-700 font-semibold">🤝 Kolaborasi: ` +
                            kolabLaporan.map(k => `[${k.nama_lembaga}: ${k.jenis_bantuan}]`).join(', ') +
                            `</div>`;
                    }

                    let tandaMintaBantuanHTML = '';
                    if (item.minta_bantuan && kolabLaporan.length === 0) {
                        tandaMintaBantuanHTML = `<div class="mt-1 bg-red-100 text-red-700 px-2 py-0.5 rounded text-[10px] font-bold animate-pulse text-center">🚨 DARURAT: BUTUH BANTUAN LINTAS SEKTOR!</div>`;
                    }

                    infoStatus = `
                        <span class="text-blue-600 font-bold">Ditangani Utama:</span><br>
                        <span class="text-[11px] text-slate-700">${item.nama_petugas_proses || item.lembaga_proses || '-'}</span><br>
                        <span class="text-[10px] text-slate-500">Posko: ${item.telp_petugas || '-'}</span>
                        ${tandaMintaBantuanHTML}
                        ${badgeKolabHTML}
                    `;
                } else if (item.status === 'Selesai') {
                    infoStatus = `<span class="text-green-600 font-bold">Selesai Ditangani</span><br><span class="text-[10px] text-slate-500">${item.nama_petugas_selesai || ''}</span>`;
                }

                let timelineHTML = '';
                if (item.catatan_lapangan) {
                    timelineHTML = `<div class="mt-1.5 p-1.5 bg-amber-50 border border-amber-200 rounded text-[10px] text-slate-700 whitespace-pre-line font-mono max-h-24 overflow-y-auto"><b>Log Lapangan:</b><br>${item.catatan_lapangan}</div>`;
                }

                const ketLaporan = item.ket ? `<div class="mt-1 text-slate-600 text-[11px] italic bg-slate-50 p-1.5 rounded border border-slate-100">"${item.ket}"</div>` : `<div class="mt-1 text-slate-400 text-[10px] italic">Tanpa keterangan tambahan</div>`;

                let aksiHTML = '';
                if (isPimpinan) {
                    aksiHTML = '<span class="text-[10px] text-slate-400 italic">Read-Only (Pimpinan)</span>';
                } else if (is112) {
                    if (item.status === 'Baru') {
                        aksiHTML = `<button onclick="aksiVerifikasi('${item.id}')" class="bg-amber-600 text-white px-2.5 py-1 rounded font-bold hover:bg-amber-700 text-[10px]">✅ Verifikasi (112)</button>`;
                    } else {
                        aksiHTML = `<span class="text-[10px] text-purple-700 font-semibold bg-purple-50 px-2 py-0.5 rounded">Terkunci (Diteruskan ke Sektor)</span>`;
                    }
                } else {
                    let tombolKolaborasiHTML = '';
                    let tombolMintaBantuanHTML = '';

                    if (item.status === 'Proses') {
                        const sudahKolab = daftarKolaborasi.some(k => k.laporan_id === item.id && k.nama_lembaga === currentUser.nama_lembaga);
                        const isLembagaUtama = item.lembaga_proses === currentUser.nama_lembaga;

                        if (!isLembagaUtama) {
                            if (sudahKolab) {
                                tombolKolaborasiHTML = `<span class="bg-purple-100 text-purple-700 px-2 py-1 rounded text-[10px] font-bold">✓ Sudah Tergabung</span>`;
                            } else {
                                tombolKolaborasiHTML = `<button onclick="bukaModalKolaborasi('${item.id}')" class="bg-purple-600 text-white px-2.5 py-1 rounded font-bold hover:bg-purple-700 text-[10px]">🤝 Ikut Kolaborasi</button>`;
                            }
                        }

                        if (isLembagaUtama) {
                            if (item.minta_bantuan) {
                                tombolMintaBantuanHTML = `<button onclick="aksiMintaBantuan('${item.id}', false)" class="bg-slate-500 text-white px-2.5 py-1 rounded font-bold hover:bg-slate-600 text-[10px]">❌ Batalkan Minta Bantuan</button>`;
                            } else {
                                tombolMintaBantuanHTML = `<button onclick="aksiMintaBantuan('${item.id}', true)" class="bg-red-600 text-white px-2.5 py-1 rounded font-bold hover:bg-red-700 text-[10px] animate-pulse">🚨 Minta Bantuan</button>`;
                            }
                        }
                    }

                    aksiHTML = `
                        <div class="mt-2 flex flex-wrap gap-1 justify-center items-center">
                            ${item.status === 'Baru' ? `<button onclick="aksiVerifikasi('${item.id}')" class="bg-amber-600 text-white px-2.5 py-1 rounded font-bold hover:bg-amber-700 text-[10px]">✅ Verifikasi</button>` : ''}
                            ${item.status === 'Terverifikasi' ? `<button onclick="bukaModalProses('${item.id}')" class="bg-blue-600 text-white px-2.5 py-1 rounded font-bold hover:bg-blue-700 text-[10px]">🚀 Mulai Proses</button>` : ''}
                            ${item.status === 'Proses' ? `
                                <button onclick="bukaModalCatatan('${item.id}')" class="bg-emerald-600 text-white px-2.5 py-1 rounded font-bold hover:bg-emerald-700 text-[10px]">➕ Log Catatan</button>
                                ${tombolMintaBantuanHTML}
                                ${item.lembaga_proses === currentUser.nama_lembaga ? `<button onclick="aksiSelesai('${item.id}')" class="bg-green-600 text-white px-2.5 py-1 rounded font-bold hover:bg-green-700 text-[10px]">🏁 Selesai</button>` : ''}
                            ` : ''}
                            ${tombolKolaborasiHTML}
                        </div>
                    `;
                }

                const tr = document.createElement('tr');
                tr.className = 'border-b hover:bg-slate-50 cursor-pointer';
                tr.innerHTML = `
                    <td class="p-2 font-mono font-bold align-top">${item.id}<br><span class="text-[9px] text-slate-400 font-normal">${new Date(item.created_at).toLocaleTimeString()}</span></td>
                    <td class="p-2 align-top">
                        <b>${item.nama || 'Warga'}</b><br>
                        ${renderTombolKontakAman(item.telp)}
                    </td>
                    <td class="p-2 align-top">
                        <div class="flex items-center gap-1.5 mb-1">
                            <b>${item.lokasi}</b>
                            <span class="text-[9px] px-1.5 py-0.5 rounded ${badgeColor}">${item.jenis}</span>
                        </div>
                        ${ketLaporan}
                    </td>
                    <td class="p-2 text-center align-top" onclick="event.stopPropagation()">
                        <div class="mb-1">${infoStatus}</div>
                        ${timelineHTML}
                        ${aksiHTML}
                    </td>
                `;
                tr.onclick = () => map.flyTo({ center: [item.lng, item.lat], zoom: 14 });
                tbody.appendChild(tr);
            });
        }

        function renderMarkers() {
            markers.forEach(m => m.remove());
            markers = [];

            const sekarang = new Date().getTime();
            const filterStatus = document.getElementById('map-filter-status').value;
            const filterJenis = document.getElementById('map-filter-jenis').value;

            laporanList.forEach(item => {
                if (filterStatus !== 'Semua' && item.status !== filterStatus) return;
                if (filterJenis !== 'Semua' && item.jenis !== filterJenis) return;

                let color = '#ef4444';
                let isKritis = false;

                const waktuLapor = new Date(item.created_at).getTime();
                const selisihMenit = (sekarang - waktuLapor) / (1000 * 60);

                if (item.status === 'Baru') {
                    color = '#ef4444';
                    if (selisihMenit > 30) isKritis = true;
                } else if (item.status === 'Terverifikasi') {
                    color = '#f59e0b';
                } else if (item.status === 'Proses') {
                    color = '#3b82f6';
                } else if (item.status === 'Selesai') {
                    color = '#22c55e';
                }

                const el = document.createElement('div');
                if (isKritis || item.minta_bantuan) {
                    el.className = `rounded-full shadow-2xl cursor-pointer border-4 border-white siaga-kritis flex items-center justify-center font-black text-white text-[10px]`;
                    el.style.width = '38px';
                    el.style.height = '38px';
                    el.style.backgroundColor = '#dc2626';
                    el.innerText = item.minta_bantuan ? '🆘' : '🚨';
                } else {
                    el.className = `rounded-full shadow-md cursor-pointer border-2 border-white`;
                    el.style.width = '28px';
                    el.style.height = '28px';
                    el.style.backgroundColor = color;
                }

                const popup = new mapboxgl.Popup({ offset: 25 }).setHTML(`
                    <div class="p-1 text-xs space-y-1">
                        <b class="text-slate-800">${item.lokasi} (${item.jenis})</b><br>
                        <p class="italic text-slate-600">"${item.ket || 'Tanpa keterangan'}"</p>
                        <span>Status: <b class="text-red-600">${item.status}</b></span>
                        ${item.minta_bantuan ? '<br><span class="text-[10px] bg-red-100 text-red-700 font-bold px-1 rounded">🆘 MEMBUTUHKAN BANTUAN LINTAS SEKTOR!</span>' : ''}
                    </div>
                `);

                const marker = new mapboxgl.Marker(el)
                    .setLngLat([item.lng, item.lat])
                    .setPopup(popup)
                    .addTo(map);
                markers.push(marker);
            });
        }

        async function aksiVerifikasi(id) {
            if (!confirm(`Verifikasi laporan ini atas nama instansi [${currentUser.nama_lembaga}]?`)) return;

            const detailPetugas = `${currentUser.nama_lembaga} (Petugas: ${currentUser.username})`;

            const { error } = await supabaseClient.from('laporan').update({
                status: 'Terverifikasi',
                lembaga_verifikasi: currentUser.nama_lembaga,
                nama_petugas_verif: detailPetugas
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

            const detailPetugas = `${currentUser.nama_lembaga} (Petugas: ${currentUser.username})`;
            const logBaru = `[${new Date().toLocaleTimeString()}] ${detailPetugas} mulai menangani utama (Hotline Posko: ${telp})\n`;

            const itemLama = laporanList.find(i => i.id === id);
            const gabungLog = (itemLama.catatan_lapangan || '') + logBaru;

            const { error } = await supabaseClient.from('laporan').update({
                status: 'Proses',
                lembaga_proses: currentUser.nama_lembaga,
                nama_petugas_proses: detailPetugas,
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

            const detailPetugas = `${currentUser.nama_lembaga} (${currentUser.username})`;
            const itemLama = laporanList.find(i => i.id === id);
            const logBaru = statusBantuan
                ? `[${new Date().toLocaleTimeString()}] 🆘 ${detailPetugas} MENYATAKAN BUTUH BANTUAN LINTAS SEKTOR.\n`
                : `[${new Date().toLocaleTimeString()}] ✓ ${detailPetugas} mencabut status minta bantuan.\n`;

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

            const detailPetugas = `${currentUser.nama_lembaga} (${currentUser.username})`;

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
            const logBaru = `[${new Date().toLocaleTimeString()}] 🤝 Bantuan Kolaborasi dari ${detailPetugas}: [${jenisBantuan}] ${ketBantuan}\n`;
            const gabungLog = (itemLama.catatan_lapangan || '') + logBaru;

            const updatePayload = {
                catatan_lapangan: gabungLog
            };
            if (itemLama.minta_bantuan) {
                updatePayload.minta_bantuan = false;
            }

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

            const detailPetugas = `${currentUser.nama_lembaga} (${currentUser.username})`;
            const itemLama = laporanList.find(i => i.id === id);
            const logBaru = `[${new Date().toLocaleTimeString()}] (${detailPetugas}): ${teks}\n`;
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

            const detailPetugas = `${currentUser.nama_lembaga} (Petugas: ${currentUser.username})`;
            const itemLama = laporanList.find(i => i.id === id);

            const kolabLaporan = daftarKolaborasi.filter(k => k.laporan_id === id);
            let daftarLembagaBantu = itemLama.lembaga_proses || 'Lembaga Utama';
            if (kolabLaporan.length > 0) {
                const namaKolabUnik = [...new Set(kolabLaporan.map(k => k.nama_lembaga))];
                daftarLembagaBantu += ', ' + namaKolabUnik.join(', ');
            }

            const logBaru = `[${new Date().toLocaleTimeString()}] (${detailPetugas}): Penanganan SELESAI ditangani oleh [${daftarLembagaBantu}].\n`;
            const gabungLog = (itemLama.catatan_lapangan || '') + logBaru;

            const { error } = await supabaseClient.from('laporan').update({
                status: 'Selesai',
                nama_petugas_selesai: `${detailPetugas} (Dibantu: ${daftarLembagaBantu})`,
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

        // Memastikan map dimuat dengan aman sebelum mengambil data pertama kali
        map.on('load', () => {
            ambilDataLaporan();
            setInterval(ambilDataLaporan, 5000);
        });
