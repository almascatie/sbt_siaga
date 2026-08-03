
        mapboxgl.accessToken = CONFIG.MAPBOX_TOKEN;

        let currentUser = null;
        let selectedCoords = null;
        let marker = null;

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

                document.getElementById('info-petugas-login').innerText = `${currentUser.nama_lembaga} (Petugas: ${currentUser.username})`;
            } else {
                window.location.href = 'login.html';
            }
        };

        // Event klik pada peta untuk menentukan titik koordinat laporan
        map.on('click', (e) => {
            const lng = e.lngLat.lng;
            const lat = e.lngLat.lat;
            selectedCoords = { lng, lat };

            document.getElementById('input-lng').value = lng.toFixed(5);
            document.getElementById('input-lat').value = lat.toFixed(5);

            if (marker) {
                marker.setLngLat([lng, lat]);
            } else {
                marker = new mapboxgl.Marker({ color: '#2563eb' })
                    .setLngLat([lng, lat])
                    .addTo(map);
            }
        });

        // Eksekusi Simpan Laporan Mandiri
        document.getElementById('form-laporan-mandiri').addEventListener('submit', async (e) => {
            e.preventDefault();

            if (!selectedCoords) {
                alert('Silakan klik dan tentukan titik lokasi kejadian terlebih dahulu pada peta!');
                return;
            }

            const namaPelapor = document.getElementById('input-nama').value.trim();
            const telpPelapor = document.getElementById('input-telp').value.trim() || '-';
            const jenisKrisis = document.getElementById('input-jenis').value;
            const namaLokasi = document.getElementById('input-lokasi').value.trim();
            const ketDetail = document.getElementById('input-ket').value.trim();

            // ID Unik Laporan (SBT-XXXX)
            const idUnik = 'SBT-' + Math.floor(1000 + Math.random() * 9000);
            const detailPetugasPencatat = `${currentUser.nama_lembaga} (Input Mandiri oleh: ${currentUser.username})`;

            const laporanBaru = {
                id: idUnik,
                nama: namaPelapor,
                telp: telpPelapor,
                jenis: jenisKrisis,
                lokasi: namaLokasi,
                ket: ketDetail,
                lng: selectedCoords.lng,
                lat: selectedCoords.lat,
                status: 'Baru',
                catatan_lapangan: `[${new Date().toLocaleTimeString()}] Laporan diterbitkan secara mandiri oleh ${detailPetugasPencatat}\n`
            };

            const { error } = await supabaseClient.from('laporan').insert([laporanBaru]);

            if (error) {
                alert('Gagal menyimpan laporan mandiri: ' + error.message);
            } else {
                alert(`Laporan mandiri berhasil disimpan dengan ID: ${idUnik}`);
                window.location.href = 'petugas.html';
            }
        });
