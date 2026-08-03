        mapboxgl.accessToken = CONFIG.MAPBOX_TOKEN;

        let laporanList = [];
        let markers = [];
        let activeTab = 'Verifikasi'; // Default tab awal diarahkan ke Verifikasi agar langsung terlihat
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
                
                if (currentUser.role !== 'petugas_kolaborasi') {
                    window.location.href = 'petugas.html';
                    return;
                }

                document.getElementById('header-sapaan').innerText = `Mitra: ${currentUser.nama_lembaga} (${currentUser.username})`;
                
                gantiTab('Verifikasi'); // Aktifkan tab verifikasi saat pertama buka
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

        async function ambilDataLaporan() {
            try {
                const { data: dataLaporan } = await supabaseClient.from('laporan').select('*').order('created_at', { ascending: false });
                const { data: dataKolab } = await supabaseClient.from('bantuan_kolaborasi').select('*');

                laporanList = dataLaporan || [];
                daftarKolaborasi = dataKolab || [];

                hitungBadgeTab();
                renderTabel();
                renderMarkers();
            } catch (err) {
                console.error(err);
            }
        }

        function hitungBadgeTab() {
            // Deteksi fleksibel berbagai variasi status verifikasi di database
            const countVerif = laporanList.filter(i => {
                const st = (i.status || '').toLowerCase();
                return st.includes('verif') || st.includes('pending') || st.includes('menunggu');
            }).length;

            const countProses = laporanList.filter(i => {
                const st = (i.status || '').toLowerCase();
                return st.includes('proses') && !i.minta_bantuan;
            }).length;

            const countDarurat = laporanList.filter(i => {
                const st = (i.status || '').toLowerCase();
                return st.includes('proses') && i.minta_bantuan;
            }).length;

            document.getElementById('count-Verifikasi').innerText = countVerif;
            document.getElementById('count-Proses').innerText = countProses;
            document.getElementById('count-Darurat').innerText = countDarurat;
        }

        function gantiTab(tab) {
            activeTab = tab;
            ['Verifikasi', 'Proses', 'Darurat', 'BantuanSaya'].forEach(t => {
                const btn = document.getElementById(`tab-${t}`);
                if (t === tab) {
                    btn.className = 'py-3 px-1 border-b-2 border-purple-600 text-purple-700 bg-white font-bold';
                } else {
                    btn.className = 'py-3 px-1 text-slate-600 hover:text-slate-900 font-normal';
                }
            });
            renderTabel();
        }

        function renderTabel() {
            const tbody = document.getElementById('table-body');
            const thAksi = document.getElementById('header-kolom-aksi');
            tbody.innerHTML = '';

            let filtered = [];
            const idsDibantu = daftarKolaborasi.filter(k => k.nama_lembaga === currentUser.nama_lembaga).map(k => k.laporan_id);

            if (activeTab === 'Verifikasi') {
                filtered = laporanList.filter(i => {
                    const st = (i.status || '').toLowerCase();
                    return st.includes('verif') || st.includes('pending') || st.includes('menunggu');
                });
                thAksi.style.display = 'none'; 
            } else {
                thAksi.style.display = '';
                if (activeTab === 'Proses') {
                    filtered = laporanList.filter(i => {
                        const st = (i.status || '').toLowerCase();
                        return st.includes('proses') && !i.minta_bantuan && !idsDibantu.includes(i.id);
                    });
                } else if (activeTab === 'Darurat') {
                    filtered = laporanList.filter(i => {
                        const st = (i.status || '').toLowerCase();
                        return st.includes('proses') && i.minta_bantuan && !idsDibantu.includes(i.id);
                    });
                } else if (activeTab === 'BantuanSaya') {
                    filtered = laporanList.filter(i => idsDibantu.includes(i.id));
                }
            }

            if (filtered.length === 0) {
                tbody.innerHTML = `<tr><td colspan="4" class="p-6 text-center text-slate-400">Tidak ada data laporan pada kategori ini.</td></tr>`;
                return;
            }

            filtered.forEach(item => {
                const kolabLaporan = daftarKolaborasi.filter(k => k.laporan_id === item.id);
                const sudahTerdaftar = kolabLaporan.some(k => k.nama_lembaga === currentUser.nama_lembaga);

                let badgeKolab = '';
                if (kolabLaporan.length > 0) {
                    badgeKolab = `<div class="mt-1 text-[10px] text-purple-700 font-semibold">🤝 Tim Terjun: ` + kolabLaporan.map(k => `[${k.nama_lembaga}]`).join(', ') + `</div>`;
                }

                let statusBadge = '';
                const stLower = (item.status || '').toLowerCase();
                if (stLower.includes('verif') || stLower.includes('pending') || stLower.includes('menunggu')) {
                    statusBadge = `<div class="mt-1 bg-amber-100 text-amber-700 px-2 py-0.5 rounded text-[10px] font-bold inline-block">🔍 DALAM VERIFIKASI</div>`;
                } else if (item.minta_bantuan) {
                    statusBadge = `<div class="mt-1 bg-red-100 text-red-700 px-2 py-0.5 rounded text-[10px] font-bold animate-pulse inline-block">🚨 BUTUH BANTUAN SEKTOR!</div>`;
                }

                let aksiHTML = '';
                if (activeTab !== 'Verifikasi') {
                    if (sudahTerdaftar) {
                        aksiHTML = `
                            <span class="bg-purple-100 text-purple-700 px-2 py-1 rounded text-[10px] font-bold block mb-1">✓ Anda Telah Bergabung</span>
                            <button onclick="bukaModalCatatan('${item.id}')" class="bg-emerald-600 text-white px-2 py-1 rounded text-[10px] font-bold hover:bg-emerald-700">➕ Log Catatan</button>
                        `;
                    } else {
                        aksiHTML = `<button onclick="bukaModalKolaborasi('${item.id}')" class="bg-purple-600 text-white px-2.5 py-1.5 rounded text-[10px] font-bold hover:bg-purple-700 shadow">🤝 Ikut Terjun</button>`;
                    }
                }

                const tr = document.createElement('tr');
                tr.className = 'border-b hover:bg-slate-50 cursor-pointer';
                tr.innerHTML = `
                    <td class="p-2 font-mono align-top">${item.id}<br><span class="text-[9px] text-slate-400">${new Date(item.created_at).toLocaleTimeString()}</span></td>
                    <td class="p-2 align-top"><b>${item.nama || 'Warga'}</b></td>
                    <td class="p-2 align-top">
                        <b>${item.lokasi}</b> <span class="text-[9px] bg-blue-100 text-blue-700 px-1 rounded">${item.jenis}</span><br>
                        <span class="text-slate-600 text-[11px] italic">"${item.ket || '-'}"</span>
                        ${statusBadge}
                        ${badgeKolab}
                    </td>
                    <td class="p-2 text-center align-top" onclick="event.stopPropagation()">
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

            laporanList.forEach(item => {
                const el = document.createElement('div');
                const stLower = (item.status || '').toLowerCase();

                if (stLower.includes('verif') || stLower.includes('pending') || stLower.includes('menunggu')) {
                    el.className = `rounded-full shadow-md cursor-pointer border-2 border-white`;
                    el.style.width = '24px';
                    el.style.height = '24px';
                    el.style.backgroundColor = '#f59e0b'; // Amber
                } else if (stLower.includes('proses')) {
                    if (item.minta_bantuan) {
                        el.className = `rounded-full shadow-2xl cursor-pointer border-4 border-white siaga-kritis flex items-center justify-center font-black text-white text-[10px]`;
                        el.style.width = '36px';
                        el.style.height = '36px';
                        el.style.backgroundColor = '#dc2626';
                        el.innerText = '🆘';
                    } else {
                        el.className = `rounded-full shadow-md cursor-pointer border-2 border-white`;
                        el.style.width = '26px';
                        el.style.height = '26px';
                        el.style.backgroundColor = '#3b82f6';
                    }
                } else {
                    return; 
                }

                const marker = new mapboxgl.Marker(el)
                    .setLngLat([item.lng, item.lat])
                    .setPopup(new mapboxgl.Popup().setHTML(`<b>${item.lokasi}</b><br>${item.jenis} (${item.status})`))
                    .addTo(map);
                markers.push(marker);
            });
        }

        function bukaModalKolaborasi(id) {
            document.getElementById('kolaborasi-id-laporan').value = id;
            document.getElementById('label-lembaga-kolaborasi').innerText = currentUser.nama_lembaga;
            document.getElementById('form-kolaborasi').reset();
            document.getElementById('modal-kolaborasi').classList.remove('hidden');
        }
        function tutupModalKolaborasi() { document.getElementById('modal-kolaborasi').classList.add('hidden'); }

        document.getElementById('form-kolaborasi').addEventListener('submit', async (e) => {
            e.preventDefault();
            const id = document.getElementById('kolaborasi-id-laporan').value;
            const jenisBantuan = document.getElementById('input-jenis-bantuan').value;
            const ketBantuan = document.getElementById('input-ket-bantuan').value.trim();

            const { error } = await supabaseClient.from('bantuan_kolaborasi').insert([{
                laporan_id: id,
                nama_lembaga: currentUser.nama_lembaga,
                username_petugas: currentUser.username,
                jenis_bantuan: `${jenisBantuan}${ketBantuan ? ' - ' + ketBantuan : ''}`
            }]);

            if (error) {
                alert('Gagal: ' + error.message);
            } else {
                tutupModalKolaborasi();
                alert('Berhasil bergabung dalam penanganan!');
                gantiTab('BantuanSaya');
                ambilDataLaporan();
            }
        });

        function bukaModalCatatan(id) {
            document.getElementById('catatan-id-laporan').value = id;
            document.getElementById('form-catatan').reset();
            document.getElementById('modal-catatan').classList.add('hidden');
        }
        function tutupModalCatatan() { document.getElementById('modal-catatan').classList.add('hidden'); }

        document.getElementById('form-catatan').addEventListener('submit', async (e) => {
            e.preventDefault();
            const id = document.getElementById('catatan-id-laporan').value;
            const teks = document.getElementById('input-teks-catatan').value;

            const itemLama = laporanList.find(i => i.id === id);
            const logBaru = `[${new Date().toLocaleTimeString()}] (${currentUser.nama_lembaga}): ${teks}\n`;
            
            await supabaseClient.from('laporan').update({
                catatan_lapangan: (itemLama.catatan_lapangan || '') + logBaru
            }).eq('id', id);

            tutupModalCatatan();
            ambilDataLaporan();
        });
