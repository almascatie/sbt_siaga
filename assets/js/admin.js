// ==========================================================
// ADMIN SCRIPT — COMMAND CENTER SBT
// ==========================================================

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

// --- MANAJEMEN LEMBAGA ---
async function muatDataLembaga() {
    const tbody = document.getElementById('table-lembaga');
    const selectInduk = document.getElementById('select-lembaga-induk');
    tbody.innerHTML = '';
    if (selectInduk) {
        selectInduk.innerHTML = '<option value="">-- Pilih Lembaga Induk --</option>';
    }

    const { data, error } = await supabaseClient.from('lembaga').select('*').order('nama_lembaga');
    if (!error && data) {
        data.forEach(item => {
            // Masukkan ke dropdown form petugas jika elemennya ada
            if (selectInduk) {
                let opt = document.createElement('option');
                opt.value = item.nama_lembaga;
                opt.textContent = `${item.nama_lembaga} (${item.kategori_peran || 'Dinas Teknis'})`;
                selectInduk.appendChild(opt);
            }

            // Badge warna kategori peran
            let badgePeran = '<span class="bg-blue-100 text-blue-700 px-2 py-0.5 rounded font-bold">Dinas Teknis</span>';
            if (item.kategori_peran === 'Instansi Pendukung') {
                badgePeran = '<span class="bg-purple-100 text-purple-700 px-2 py-0.5 rounded font-bold">Instansi Pendukung</span>';
            } else if (item.kategori_peran === 'Mitra') {
                badgePeran = '<span class="bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded font-bold">Mitra</span>';
            } else if (item.kategori_peran === 'Kecamatan & Desa') {
                badgePeran = '<span class="bg-amber-100 text-amber-800 px-2 py-0.5 rounded font-bold">Kecamatan & Desa</span>';
            }

            const tr = document.createElement('tr');
            tr.className = 'border-b hover:bg-slate-50';
            tr.innerHTML = `
                <td class="p-3 font-bold text-slate-800">${item.nama_lembaga}</td>
                <td class="p-3 font-mono">${item.hotline_telepon || '-'}</td>
                <td class="p-3 text-slate-600">${item.alamat_kantor || '-'}</td>
                <td class="p-3">${badgePeran}</td>
                <td class="p-3 text-center space-x-2">
                    <button type="button" onclick="editLembaga('${item.id}', '${item.nama_lembaga}', '${item.hotline_telepon || ''}', '${item.logo_url || ''}', '${item.alamat_kantor || ''}', '${item.kategori_peran || 'Dinas Teknis'}', '${item.keterangan || ''}')" class="bg-amber-500 hover:bg-amber-600 text-white px-2.5 py-1 rounded font-semibold">✏️ Edit</button>
                    <button type="button" onclick="hapusLembaga('${item.id}')" class="bg-red-600 hover:bg-red-700 text-white px-2.5 py-1 rounded font-semibold">🗑️ Hapus</button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    }
}

function bukaModalLembaga() {
    document.getElementById('lembaga-id').value = '';
    document.getElementById('input-nama-lembaga').value = '';
    document.getElementById('input-hotline-lembaga').value = '';
    const logoInput = document.getElementById('input-logo-lembaga');
    if (logoInput) logoInput.value = '';
    document.getElementById('input-alamat-lembaga').value = '';
    document.getElementById('input-kategori-peran').value = 'Dinas Teknis';
    document.getElementById('input-ket-lembaga').value = '';
    document.getElementById('modal-lembaga-title').innerText = 'Tambah Lembaga Baru';
    document.getElementById('modal-lembaga').classList.remove('hidden');
}

function editLembaga(id, nama, hotline, logo, alamat, peran, ket) {
    document.getElementById('lembaga-id').value = id;
    document.getElementById('input-nama-lembaga').value = nama;
    document.getElementById('input-hotline-lembaga').value = hotline;
    const logoInput = document.getElementById('input-logo-lembaga');
    if (logoInput) logoInput.value = logo;
    document.getElementById('input-alamat-lembaga').value = alamat;
    document.getElementById('input-kategori-peran').value = peran;
    document.getElementById('input-ket-lembaga').value = ket;
    document.getElementById('modal-lembaga-title').innerText = 'Edit Data Lembaga';
    document.getElementById('modal-lembaga').classList.remove('hidden');
}

// [PERBAIKAN UTAMA] Fungsi penutup modal lembaga yang sebelumnya hilang
function tutupModalLembaga() {
    const modal = document.getElementById('modal-lembaga');
    if (modal) modal.classList.add('hidden');
}

document.getElementById('form-lembaga').addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('lembaga-id').value;
    const nama_lembaga = document.getElementById('input-nama-lembaga').value.trim();
    const hotline_telepon = document.getElementById('input-hotline-lembaga').value.trim();
    const logoInput = document.getElementById('input-logo-lembaga');
    const logo_url = logoInput ? logoInput.value.trim() : '';
    const alamat_kantor = document.getElementById('input-alamat-lembaga').value.trim();
    const kategori_peran = document.getElementById('input-kategori-peran').value;
    const keterangan = document.getElementById('input-ket-lembaga').value.trim();

    if (id) {
        const { error } = await supabaseClient.from('lembaga').update({ 
            nama_lembaga, hotline_telepon, logo_url, alamat_kantor, kategori_peran, keterangan 
        }).eq('id', id);
        if (error) alert('Gagal update: ' + error.message);
        else { tutupModalLembaga(); muatDataLembaga(); alert('Data lembaga diperbarui!'); }
    } else {
        const { error } = await supabaseClient.from('lembaga').insert([{ 
            nama_lembaga, hotline_telepon, logo_url, alamat_kantor, kategori_peran, keterangan 
        }]);
        if (error) alert('Gagal tambah: ' + error.message);
        else { tutupModalLembaga(); muatDataLembaga(); alert('Lembaga ditambahkan!'); }
    }
});

async function hapusLembaga(id) {
    if (!confirm('Yakin ingin menghapus lembaga ini?')) return;
    // Mengonversi id ke angka jika kolom id di database bertipe integer (int4)
    const targetId = !isNaN(id) ? parseInt(id, 10) : id;
    const { error } = await supabaseClient.from('lembaga').delete().eq('id', targetId);
    if (error) alert('Gagal hapus: ' + error.message);
    else muatDataLembaga();
}


// --- MANAJEMEN PETUGAS / AKUN PENGGUNA ---
async function muatDataPetugas() {
    const tbody = document.getElementById('table-petugas');
    tbody.innerHTML = '';

    const { data, error } = await supabaseClient.from('users').select('*').order('username');
    if (!error && data) {
        data.forEach(item => {
            const tr = document.createElement('tr');
            tr.className = 'border-b hover:bg-slate-50';
            tr.innerHTML = `
                <td class="p-3">
                    <span class="font-bold text-slate-800">${item.nama_lengkap || '-'}</span><br>
                    <span class="text-[10px] text-slate-500 font-mono">@${item.username}</span>
                </td>
                <td class="p-3 font-mono">${item.telp_petugas || '-'}</td>
                <td class="p-3">${item.nama_lembaga || '-'}</td>
                <td class="p-3 uppercase font-semibold text-blue-600">${item.role}</td>
                <td class="p-3 text-center space-x-2">
                    <button type="button" onclick="editPetugas('${item.id}', '${item.nama_lengkap || ''}', '${item.username}', '${item.password || ''}', '${item.telp_petugas || ''}', '${item.nama_lembaga || ''}', '${item.role}')" class="bg-amber-500 hover:bg-amber-600 text-white px-2.5 py-1 rounded font-semibold">✏️ Edit</button>
                    <button type="button" onclick="hapusPetugas('${item.id}')" class="bg-red-600 hover:bg-red-700 text-white px-2.5 py-1 rounded font-semibold">🗑️ Hapus</button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    }
}

function bukaModalPetugas() {
    document.getElementById('petugas-id').value = '';
    document.getElementById('form-petugas').reset();
    document.getElementById('modal-petugas-title').innerText = 'Tambah Akun Pengguna Baru';
    document.getElementById('modal-petugas').classList.remove('hidden');
}

function editPetugas(id, namaLengkap, username, password, telpPetugas, namaLembaga, role) {
    document.getElementById('petugas-id').value = id;
    document.getElementById('input-nama-lengkap').value = namaLengkap;
    document.getElementById('input-username-petugas').value = username;
    document.getElementById('input-password-petugas').value = password;
    document.getElementById('input-telp-petugas').value = telpPetugas;
    document.getElementById('select-lembaga-induk').value = namaLembaga;
    document.getElementById('input-role-petugas').value = role;
    document.getElementById('modal-petugas-title').innerText = 'Edit Akun Pengguna';
    document.getElementById('modal-petugas').classList.remove('hidden');
}

// [PERBAIKAN UTAMA] Fungsi penutup modal petugas yang sebelumnya hilang
function tutupModalPetugas() {
    const modal = document.getElementById('modal-petugas');
    if (modal) modal.classList.add('hidden');
}

document.getElementById('form-petugas').addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('petugas-id').value;
    const nama_lengkap = document.getElementById('input-nama-lengkap').value.trim();
    const username = document.getElementById('input-username-petugas').value.trim();
    const password = document.getElementById('input-password-petugas').value.trim();
    const telp_petugas = document.getElementById('input-telp-petugas').value.trim();
    const nama_lembaga = document.getElementById('select-lembaga-induk').value;
    const role = document.getElementById('input-role-petugas').value;

    if (id) {
        const targetId = !isNaN(id) ? parseInt(id, 10) : id;
        const { error } = await supabaseClient.from('users').update({
            nama_lengkap, username, password, telp_petugas, nama_lembaga, role
        }).eq('id', targetId);

        if (error) alert('Gagal update akun: ' + error.message);
        else { tutupModalPetugas(); muatDataPetugas(); alert('Akun pengguna diperbarui!'); }
    } else {
        const { error } = await supabaseClient.from('users').insert([{
            nama_lengkap, username, password, telp_petugas, nama_lembaga, role
        }]);

        if (error) alert('Gagal tambah akun: ' + error.message);
        else { tutupModalPetugas(); muatDataPetugas(); alert('Akun pengguna dibuat!'); }
    }
});

async function hapusPetugas(id) {
    if (!confirm('Yakin ingin menghapus akun ini?')) return;
    // Mengonversi id ke angka jika kolom id di database bertipe integer (int4)
    const targetId = !isNaN(id) ? parseInt(id, 10) : id;
    const { error } = await supabaseClient.from('users').delete().eq('id', targetId);
    if (error) alert('Gagal hapus: ' + error.message);
    else muatDataPetugas();
}

// --- MANAJEMEN LAPORAN OLEH ADMIN ---
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
                    <button type="button" onclick='bukaEditLaporan(${JSON.stringify(item)})' class="bg-amber-500 hover:bg-amber-600 text-white px-2 py-1 rounded font-semibold text-[11px]">✏️ Edit</button>
                    <button type="button" onclick="hapusLaporanAdmin('${item.id}')" class="bg-red-600 hover:bg-red-700 text-white px-2 py-1 rounded font-semibold text-[11px]">🗑️ Hapus</button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    }
}

function bukaEditLaporan(item) {
    document.getElementById('edit-lapor-id').value = item.id;
    document.getElementById('edit-lapor-nama').value = item.nama || '';
    document.getElementById('edit-lapor-lokasi').value = item.lokasi || '';
    document.getElementById('edit-lapor-jenis').value = item.jenis || '';
    document.getElementById('edit-lapor-ket').value = item.ket || '';
    document.getElementById('edit-lapor-status').value = item.status || 'Baru';
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
