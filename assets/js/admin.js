        window.onload = () => {
            const isLogged = sessionStorage.getItem('sbt_logged_in');
            const role = sessionStorage.getItem('sbt_role');
            if (isLogged !== 'true' || role !== 'superadmin') {
                window.location.href = 'login.html';
                return;
            }
            muatDataLembaga();
            muatDataPetugas();
            muatDataLaporanAdmin();
        };

        function logoutAdmin() {
            sessionStorage.clear();
            window.location.href = 'login.html';
        }

        async function muatDataLembaga() {
            const tbody = document.getElementById('table-lembaga');
            const selectInduk = document.getElementById('select-lembaga-induk');
            tbody.innerHTML = '';
            selectInduk.innerHTML = '<option value="">-- Pilih Lembaga --</option>';

            const { data, error } = await supabaseClient.from('lembaga').select('*').order('nama_lembaga');
            if (!error && data) {
                data.forEach(item => {
                    let opt = document.createElement('option');
                    opt.value = item.nama_lembaga;
                    opt.textContent = `${item.nama_lembaga} (${item.kategori_peran || 'Utama'})`;
                    selectInduk.appendChild(opt);

                    let badgePeran = '<span class="bg-blue-100 text-blue-700 px-2 py-0.5 rounded font-bold">Lembaga Utama</span>';
                    if (item.kategori_peran === 'Bantuan') {
                        badgePeran = '<span class="bg-purple-100 text-purple-700 px-2 py-0.5 rounded font-bold">Kolaborator</span>';
                    } else if (item.kategori_peran === 'Pimpinan') {
                        badgePeran = '<span class="bg-amber-100 text-amber-800 px-2 py-0.5 rounded font-bold">Pimpinan</span>';
                    }

                    const tr = document.createElement('tr');
                    tr.className = 'border-b hover:bg-slate-50';
                    tr.innerHTML = `
                        <td class="p-3 font-bold text-slate-800">${item.nama_lembaga}</td>
                        <td class="p-3 font-mono">${item.hotline_telepon || '-'}</td>
                        <td class="p-3">${badgePeran}</td>
                        <td class="p-3 text-center space-x-2">
                            <button onclick="editLembaga('${item.id}', '${item.nama_lembaga}', '${item.hotline_telepon || ''}', '${item.kategori_peran || 'Utama'}')" class="bg-amber-500 hover:bg-amber-600 text-white px-2.5 py-1 rounded font-semibold">✏️ Edit</button>
                            <button onclick="hapusLembaga('${item.id}')" class="bg-red-600 hover:bg-red-700 text-white px-2.5 py-1 rounded font-semibold">🗑️ Hapus</button>
                        </td>
                    `;
                    tbody.appendChild(tr);
                });
            }
        }

        async function muatDataPetugas() {
            const tbody = document.getElementById('table-petugas');
            tbody.innerHTML = '';

            const { data, error } = await supabaseClient.from('users').select('*').order('username');
            if (!error && data) {
                data.forEach(item => {
                    const tr = document.createElement('tr');
                    tr.className = 'border-b hover:bg-slate-50';
                    tr.innerHTML = `
                        <td class="p-3 font-bold text-slate-800">${item.username}</td>
                        <td class="p-3">${item.nama_lembaga || '-'}</td>
                        <td class="p-3 uppercase font-semibold text-blue-600">${item.role}</td>
                        <td class="p-3 text-center space-x-2">
                            <button onclick="editPetugas('${item.id}', '${item.username}', '${item.password || ''}', '${item.nama_lembaga || ''}', '${item.role}')" class="bg-amber-500 hover:bg-amber-600 text-white px-2.5 py-1 rounded font-semibold">✏️ Edit</button>
                            <button onclick="hapusPetugas('${item.id}')" class="bg-red-600 hover:bg-red-700 text-white px-2.5 py-1 rounded font-semibold">🗑️ Hapus</button>
                        </td>
                    `;
                    tbody.appendChild(tr);
                });
            }
        }

        async function muatDataLaporanAdmin() {
            const tbody = document.getElementById('table-laporan-admin');
            tbody.innerHTML = '';

            const { data, error } = await supabaseClient.from('laporan').select('*').order('created_at', { ascending: false });
            if (!error && data) {
                data.forEach(item => {
                    const tr = document.createElement('tr');
                    tr.className = 'border-b hover:bg-slate-50';
                    tr.innerHTML = `
                        <td class="p-3 font-mono"><b>${item.id}</b><br><span class="text-[10px] text-slate-400">${new Date(item.created_at).toLocaleString()}</span></td>
                        <td class="p-3 font-semibold">${item.nama || 'Warga'}</td>
                        <td class="p-3"><b>${item.lokasi}</b><br><span class="text-[10px] bg-blue-100 text-blue-700 px-1 rounded">${item.jenis}</span></td>
                        <td class="p-3 italic text-slate-600">${item.ket || '-'}</td>
                        <td class="p-3 text-center"><span class="bg-slate-200 text-slate-800 px-2 py-0.5 rounded font-bold">${item.status}</span></td>
                        <td class="p-3 text-center space-x-1">
                            <button onclick='bukaEditLaporan(${JSON.stringify(item)})' class="bg-amber-500 hover:bg-amber-600 text-white px-2 py-1 rounded font-semibold text-[11px]">✏️ Edit</button>
                            <button onclick="hapusLaporanAdmin('${item.id}')" class="bg-red-600 hover:bg-red-700 text-white px-2 py-1 rounded font-semibold text-[11px]">🗑️ Hapus</button>
                        </td>
                    `;
                    tbody.appendChild(tr);
                });
            }
        }

        // --- MANAJEMEN LEMBAGA ---
        function bukaModalLembaga() {
            document.getElementById('lembaga-id').value = '';
            document.getElementById('input-nama-lembaga').value = '';
            document.getElementById('input-hotline-lembaga').value = '';
            document.getElementById('input-kategori-peran').value = 'Utama';
            document.getElementById('modal-lembaga-title').innerText = 'Tambah Lembaga Baru';
            document.getElementById('modal-lembaga').classList.remove('hidden');
        }

        function editLembaga(id, nama, hotline, peran) {
            document.getElementById('lembaga-id').value = id;
            document.getElementById('input-nama-lembaga').value = nama;
            document.getElementById('input-hotline-lembaga').value = hotline;
            document.getElementById('input-kategori-peran').value = peran;
            document.getElementById('modal-lembaga-title').innerText = 'Edit Data Lembaga';
            document.getElementById('modal-lembaga').classList.remove('hidden');
        }

        function tutupModalLembaga() { document.getElementById('modal-lembaga').classList.add('hidden'); }

        document.getElementById('form-lembaga').addEventListener('submit', async (e) => {
            e.preventDefault();
            const id = document.getElementById('lembaga-id').value;
            const nama = document.getElementById('input-nama-lembaga').value.trim();
            const hotline = document.getElementById('input-hotline-lembaga').value.trim();
            const peran = document.getElementById('input-kategori-peran').value;

            if (id) {
                const { error } = await supabaseClient.from('lembaga').update({ nama_lembaga: nama, hotline_telepon: hotline, kategori_peran: peran }).eq('id', id);
                if (error) alert('Gagal update: ' + error.message);
                else { tutupModalLembaga(); muatDataLembaga(); }
            } else {
                const { error } = await supabaseClient.from('lembaga').insert([{ nama_lembaga: nama, hotline_telepon: hotline, kategori_peran: peran }]);
                if (error) alert('Gagal tambah: ' + error.message);
                else { tutupModalLembaga(); muatDataLembaga(); }
            }
        });

        async function hapusLembaga(id) {
            if (!confirm('Yakin ingin menghapus lembaga ini?')) return;
            const { error } = await supabaseClient.from('lembaga').delete().eq('id', id);
            if (error) alert('Gagal hapus: ' + error.message);
            else muatDataLembaga();
        }

        // --- MANAJEMEN PETUGAS ---
        function bukaModalPetugas() {
            document.getElementById('petugas-id').value = '';
            document.getElementById('form-petugas').reset();
            document.getElementById('modal-petugas-title').innerText = 'Tambah Akun Pengguna Baru';
            document.getElementById('modal-petugas').classList.remove('hidden');
        }

        function editPetugas(id, username, password, namaLembaga, role) {
            document.getElementById('petugas-id').value = id;
            document.getElementById('input-username-petugas').value = username;
            document.getElementById('input-password-petugas').value = password;
            document.getElementById('select-lembaga-induk').value = namaLembaga;
            document.getElementById('input-role-petugas').value = role;
            document.getElementById('modal-petugas-title').innerText = 'Edit Akun Pengguna';
            document.getElementById('modal-petugas').classList.remove('hidden');
        }

        function tutupModalPetugas() { document.getElementById('modal-petugas').classList.add('hidden'); }

        document.getElementById('form-petugas').addEventListener('submit', async (e) => {
            e.preventDefault();
            const id = document.getElementById('petugas-id').value;
            const username = document.getElementById('input-username-petugas').value.trim();
            const password = document.getElementById('input-password-petugas').value.trim();
            const namaLembaga = document.getElementById('select-lembaga-induk').value;
            const role = document.getElementById('input-role-petugas').value;

            const { data: dataLembaga } = await supabaseClient.from('lembaga').select('hotline_telepon').eq('nama_lembaga', namaLembaga).single();
            const telpPosko = dataLembaga ? dataLembaga.hotline_telepon : '-';

            if (id) {
                const { error } = await supabaseClient.from('users').update({
                    username, password, nama_lembaga: namaLembaga, role, telp_posko: telpPosko
                }).eq('id', id);

                if (error) alert('Gagal update akun: ' + error.message);
                else { tutupModalPetugas(); muatDataPetugas(); alert('Akun berhasil diperbarui!'); }
            } else {
                const { error } = await supabaseClient.from('users').insert([{
                    username, password, nama_lembaga: namaLembaga, role, telp_posko: telpPosko
                }]);

                if (error) alert('Gagal tambah akun: ' + error.message);
                else { tutupModalPetugas(); muatDataPetugas(); alert('Akun berhasil dibuat!'); }
            }
        });

        async function hapusPetugas(id) {
            if (!confirm('Yakin ingin menghapus akun ini?')) return;
            const { error } = await supabaseClient.from('users').delete().eq('id', id);
            if (error) alert('Gagal hapus: ' + error.message);
            else muatDataPetugas();
        }

        // --- MANAJEMEN LAPORAN OLEH ADMIN ---
        function bukaEditLaporan(item) {
            document.getElementById('edit-lapor-id').value = item.id;
            document.getElementById('edit-lapor-nama').value = item.nama || '';
            document.getElementById('edit-lapor-lokasi').value = item.lokasi || '';
            document.getElementById('edit-lapor-jenis').value = item.jenis || '';
            document.getElementById('edit-lapor-ket').value = item.ket || '';
            document.getElementById('edit-lapor-status').value = item.status || 'Verifikasi';
            document.getElementById('edit-lapor-catatan').value = item.catatan_lapangan || '';
            document.getElementById('modal-edit-laporan').classList.remove('hidden');
        }

        function tutupModalLaporanAdmin() {
            document.getElementById('modal-edit-laporan').classList.add('hidden');
        }

        document.getElementById('form-edit-laporan').addEventListener('submit', async (e) => {
            e.preventDefault();
            const id = document.getElementById('edit-lapor-id').value;
            const nama = document.getElementById('edit-lapor-nama').value;
            const lokasi = document.getElementById('edit-lapor-lokasi').value;
            const jenis = document.getElementById('edit-lapor-jenis').value;
            const ket = document.getElementById('edit-lapor-ket').value;
            const status = document.getElementById('edit-lapor-status').value;
            const catatan_lapangan = document.getElementById('edit-lapor-catatan').value;

            const { error } = await supabaseClient.from('laporan').update({
                nama, lokasi, jenis, ket, status, catatan_lapangan
            }).eq('id', id);

            if (error) {
                alert('Gagal memperbarui laporan: ' + error.message);
            } else {
                tutupModalLaporanAdmin();
                muatDataLaporanAdmin();
                alert('Data laporan berhasil diperbarui!');
            }
        });

        async function hapusLaporanAdmin(id) {
            if (!confirm(`Yakin ingin menghapus laporan ${id} ini secara permanen dari sistem?`)) return;
            const { error } = await supabaseClient.from('laporan').delete().eq('id', id);
            if (error) alert('Gagal menghapus laporan: ' + error.message);
            else muatDataLaporanAdmin();
        }
