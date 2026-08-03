        mapboxgl.accessToken = CONFIG.MAPBOX_TOKEN;

        let laporanList = [];
        let daftarKolaborasi = [];
        let markers = [];
        let activeTab = 'LogAktivitas';
        let filterStatusTabel = 'Semua';
        let currentUser = null;

        const map = new mapboxgl.Map({
            container: 'map',
            style: 'mapbox://styles/mapbox/dark-v11',
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

                document.getElementById('header-sapaan').innerText = `Pemantauan Eksekutif: ${currentUser.nama_lembaga}`;
                
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
                    btn.className = 'py-3 px-1 border-b-2 border-amber-500 text-amber-400 bg-slate-900 font-bold';
                } else {
                    btn.className = 'py-3 px-1 text-slate-400 hover:text-white font-normal bg-transparent';
                }
            });
            renderPanel();
        }

        function renderPanel() {
            const container = document.getElementById('panel-konten');
            container.innerHTML = '';

            if (activeTab === 'LogAktivitas') {
                if (laporanList.length === 0) {
                    container.innerHTML = `<div class="p-8 text-center text-slate-500 text-xs">Belum ada data laporan.</div>`;
                    return;
                }

                laporanList.forEach(item => {
                    const card = document.createElement('div');
                    card.className = 'bg-slate-800/90 border border-slate-700 rounded-xl p-4 space-y-3 shadow-lg';
                    
                    let catatanBersih = item.catatan_lapangan || 'Belum ada aktivitas penanganan lapangan tercatat.';
                    
                    card.innerHTML = `
                        <div class="flex justify-between items-start border-b border-slate-700/60 pb-2 cursor-pointer" onclick="map.flyTo({ center: [${item.lng}, ${item.lat}], zoom: 14 })">
                            <div>
                                <span class="bg-amber-500/20 text-amber-300 font-bold text-[10px] px-2 py-0.5 rounded uppercase">${item.jenis}</span>
                                <h3 class="text-white font-bold text-sm mt-1">📍 Lokasi: ${item.lokasi}</h3>
                                <p class="text-slate-400 text-[11px]">Pelapor: <b class="text-slate-200">${item.nama || 'Warga'}</b> | Waktu: ${new Date(item.created_at).toLocaleString()}</p>
                            </div>
                            <span class="text-[10px] bg-slate-700 text-slate-300 px-2 py-1 rounded font-semibold">${item.status}</span>
                        </div>
                        
                        <div class="bg-slate-900/90 border border-slate-800 rounded-lg p-3 space-y-1.5">
                            <p class="text-[10px] text-amber-400 font-bold uppercase tracking-wider">Kronologi & Aktivitas Lapangan:</p>
                            <div class="text-slate-200 text-xs whitespace-pre-line leading-relaxed font-sans">${catatanBersih}</div>
                        </div>

                        <div class="pt-1 flex gap-2">
                            <input type="text" id="input-komentar-${item.id}" placeholder="Tulis instruksi atau apresiasi pimpinan..." class="flex-1 bg-slate-950 border border-slate-700 rounded p-2 text-xs text-white outline-none focus:border-amber-500">
                            <button onclick="kirimKomentarPimpinan('${item.id}')" class="bg-amber-600 hover:bg-amber-700 text-slate-950 font-bold px-4 py-2 rounded transition text-xs shadow">Kirim Pesan</button>
                        </div>
                    `;
                    container.appendChild(card);
                });

            } else if (activeTab === 'SemuaLaporan') {
                if (laporanList.length === 0) {
                    container.innerHTML = `<div class="p-8 text-center text-slate-500 text-xs">Tidak ada data laporan.</div>`;
                    return;
                }

                const filterBar = document.createElement('div');
                filterBar.className = 'flex justify-between items-center mb-2 px-1 text-xs';
                filterBar.innerHTML = `
                    <span class="text-slate-300 font-semibold">Filter Status: <b class="text-amber-400">${filterStatusTabel}</b></span>
                    <button onclick="filterStatusTabel='Semua'; renderPanel();" class="text-slate-400 hover:text-white text-[11px] underline">Tampilkan Semua</button>
                `;
                container.appendChild(filterBar);

                const tableWrap = document.createElement('div');
                tableWrap.innerHTML = `
                    <table class="w-full text-left border-collapse text-xs">
                        <thead class="bg-slate-950 sticky top-0 text-[10px] text-slate-400 uppercase border-b border-slate-800">
                            <tr>
                                <th class="p-2.5">Waktu Laporan & Pelapor</th>
                                <th class="p-2.5">Lokasi & Kejadian</th>
                                <th class="p-2.5">Penanggung Jawab / Keterangan</th>
                                <th class="p-2.5 text-center">Status</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-slate-800" id="tabel-semua-body"></tbody>
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
                    tbody.innerHTML = `<tr><td colspan="4" class="p-6 text-center text-slate-500">Tidak ada laporan dengan filter "${filterStatusTabel}".</td></tr>`;
                    return;
                }

                laporanFiltered.forEach(item => {
                    let badgeStatus = `<span class="bg-blue-950 text-blue-400 px-2 py-0.5 rounded text-[10px] font-bold">${item.status}</span>`;
                    const stLower = (item.status || '').toLowerCase();
                    if (stLower.includes('verif')) {
                        badgeStatus = `<span class="bg-amber-950 text-amber-400 px-2 py-0.5 rounded text-[10px] font-bold">Verifikasi</span>`;
                    } else if (item.minta_bantuan) {
                        badgeStatus = `<span class="bg-red-950 text-red-400 px-2 py-0.5 rounded text-[10px] font-bold animate-pulse">Darurat</span>`;
                    } else if (stLower.includes('selesai')) {
                        badgeStatus = `<span class="bg-emerald-950 text-emerald-400 px-2 py-0.5 rounded text-[10px] font-bold">Selesai</span>`;
                    }

                    // Cari info lembaga yang kolaborasi / menangani dari log lapangan atau tabel bantuan_kolaborasi
                    const listKolab = daftarKolaborasi.filter(k => k.laporan_id === item.id);
                    let infoPenanganan = '-';

                    if (stLower.includes('verif')) {
                        infoPenanganan = `<span class="text-amber-300 italic">Menunggu verifikasi petugas...</span>`;
                    } else {
                        let teksLembaga = [];
                        // Ambil lembaga dari log lapangan jika ada catatan
                        if (item.catatan_lapangan) {
                            if (item.catatan_lapangan.includes('Damkar')) teksLembaga.push('Damkar Kab. SBT');
                            if (item.catatan_lapangan.includes('BPBD')) teksLembaga.push('BPBD SBT');
                        }
                        if (listKolab.length > 0) {
                            listKolab.forEach(k => teksLembaga.push(k.nama_lembaga));
                        }

                        if (teksLembaga.length > 0) {
                            infoPenanganan = `Ditangani oleh: <b class="text-white">${[...new Set(teksLembaga)].join(', ')}</b>`;
                        } else {
                            infoPenanganan = `<span class="text-slate-400">Petugas Utama Sektor</span>`;
                        }
                    }

                    const tr = document.createElement('tr');
                    tr.className = 'hover:bg-slate-800/50 cursor-pointer';
                    tr.innerHTML = `
                        <td class="p-2.5 font-mono text-[11px]">
                            <b class="text-white">${item.nama || 'Warga'}</b><br>
                            <span class="text-[10px] text-slate-400">${new Date(item.created_at).toLocaleString()}</span>
                        </td>
                        <td class="p-2.5">
                            <b class="text-amber-300">${item.lokasi}</b><br>
                            <span class="text-[10px] text-slate-400">${item.jenis}</span>
                        </td>
                        <td class="p-2.5 text-[11px] text-slate-300">
                            ${infoPenanganan}
                        </td>
                        <td class="p-2.5 text-center">${badgeStatus}</td>
                    `;
                    tr.onclick = () => map.flyTo({ center: [item.lng, item.lat], zoom: 14 });
                    tbody.appendChild(tr);
                });

            } else if (activeTab === 'KolaborasiLembaga') {
                if (laporanList.length === 0) {
                    container.innerHTML = `<div class="p-8 text-center text-slate-500 text-xs">Belum ada data laporan.</div>`;
                    return;
                }

                laporanList.forEach(item => {
                    const listBantuan = daftarKolaborasi.filter(k => k.laporan_id === item.id);
                    
                    const card = document.createElement('div');
                    card.className = 'bg-slate-800/90 border border-slate-700 rounded-xl p-4 space-y-3 shadow-lg';
                    
                    let daftarLembagaHtml = '';
                    if (listBantuan.length > 0) {
                        listBantuan.forEach(b => {
                            daftarLembagaHtml += `
                                <div class="bg-slate-900 border border-slate-700/80 p-2.5 rounded-lg text-xs">
                                    <span class="text-amber-400 font-bold">🏛️ ${b.nama_lembaga}</span> 
                                    <span class="text-slate-300 text-[11px] ml-1">menurunkan:</span>
                                    <b class="text-white block mt-0.5">${b.jenis_bantuan}</b>
                                </div>
                            `;
                        });
                    } else {
                        daftarLembagaHtml = `<p class="text-slate-500 text-xs italic">Belum ada bantuan kolaborasi lintas sektor pada laporan ini.</p>`;
                    }

                    card.innerHTML = `
                        <div class="flex justify-between items-start border-b border-slate-700/60 pb-2 cursor-pointer" onclick="map.flyTo({ center: [${item.lng}, ${item.lat}], zoom: 14 })">
                            <div>
                                <span class="bg-purple-500/20 text-purple-300 font-bold text-[10px] px-2 py-0.5 rounded uppercase">${item.jenis}</span>
                                <h3 class="text-white font-bold text-sm mt-1">📍 Lokasi: ${item.lokasi}</h3>
                                <p class="text-slate-400 text-[11px]">Waktu: ${new Date(item.created_at).toLocaleString()} | Pelapor: <b class="text-slate-200">${item.nama || 'Warga'}</b></p>
                            </div>
                            <span class="text-[10px] bg-slate-700 text-slate-300 px-2 py-1 rounded font-semibold">${item.status}</span>
                        </div>
                        
                        <div class="space-y-2">
                            <p class="text-[10px] text-amber-400 font-bold uppercase tracking-wider">Daftar Lembaga Kolaborator yang Terjun:</p>
                            <div class="space-y-2">
                                ${daftarLembagaHtml}
                            </div>
                        </div>
                    `;
                    container.appendChild(card);
                });
            }
        }

        async function kirimKomentarPimpinan(id) {
            const inputEl = document.getElementById(`input-komentar-${id}`);
            const pesan = inputEl.value.trim();
            if (!pesan) return alert('Tuliskan pesan atau apresiasi terlebih dahulu.');

            const itemLama = laporanList.find(i => i.id === id);
            const formatPesan = `👑 [${new Date().toLocaleTimeString()}] ARAHAN/APRESIASI PIMPINAN (${currentUser.nama_lembaga}): "${pesan}"\n`;

            const { error } = await supabaseClient.from('laporan').update({
                catatan_lapangan: (itemLama.catatan_lapangan || '') + formatPesan
            }).eq('id', id);

            if (error) {
                alert('Gagal mengirim pesan: ' + error.message);
            } else {
                inputEl.value = '';
                alert('Arahan/pesan pimpinan berhasil ditambahkan ke log lapangan!');
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
                    el.className = `rounded-full shadow-md cursor-pointer border-2 border-slate-900`;
                    el.style.width = '24px';
                    el.style.height = '24px';
                    el.style.backgroundColor = '#f59e0b';
                } else if (stLower.includes('proses')) {
                    if (item.minta_bantuan) {
                        el.className = `rounded-full shadow-2xl cursor-pointer border-4 border-slate-900 siaga-kritis flex items-center justify-center font-black text-white text-[10px]`;
                        el.style.width = '34px';
                        el.style.height = '34px';
                        el.style.backgroundColor = '#dc2626';
                        el.innerText = '🆘';
                    } else {
                        el.className = `rounded-full shadow-md cursor-pointer border-2 border-slate-900`;
                        el.style.width = '26px';
                        el.style.height = '26px';
                        el.style.backgroundColor = '#3b82f6';
                    }
                } else if (stLower.includes('selesai')) {
                    el.className = `rounded-full shadow-md cursor-pointer border-2 border-slate-900`;
                    el.style.width = '22px';
                    el.style.height = '22px';
                    el.style.backgroundColor = '#10b981';
                } else {
                    return;
                }

                const popupContent = `
                    <div class="text-slate-900 text-xs space-y-1 p-1">
                        <p class="font-bold border-b pb-1 text-purple-900">Lokasi: ${item.lokasi} (${item.status})</p>
                        <p><b>Pelapor:</b> ${item.nama || 'Warga'}</p>
                        <p><b>Jenis Kejadian:</b> ${item.jenis}</p>
                        <p class="italic text-slate-600">"${item.ket || '-'}"</p>
                    </div>
                `;

                const marker = new mapboxgl.Marker(el)
                    .setLngLat([item.lng, item.lat])
                    .setPopup(new mapboxgl.Popup({ offset: 25 }).setHTML(popupContent))
                    .addTo(map);
                markers.push(marker);
            });
        }
