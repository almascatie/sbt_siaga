document.getElementById('form-login').addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = document.getElementById('btn-submit');
            const u = document.getElementById('login-user').value.trim();
            const p = document.getElementById('login-pass').value.trim();

            btn.disabled = true;
            btn.textContent = 'Memeriksa Kredensial...';

            try {
                // Cek data akun di tabel users
                const { data, error } = await supabaseClient
                    .from('users')
                    .select('*')
                    .eq('username', u)
                    .eq('password', p)
                    .single();

                if (error || !data) {
                    alert('Login Gagal! Username atau password salah.');
                    btn.disabled = false;
                    btn.textContent = 'Masuk ke Dashboard 🚀';
                    return;
                }
                / ==========================================
                // 🟢 TAMBAHAN: UPDATE STATUS USER JADI ONLINE
                // ==========================================
                await supabaseClient
                    .from('users')
                    .update({ status_online: 'ONLINE' })
                    .eq('id', data.id);

                // Simpan sesi login sementara di browser (sessionStorage)
                sessionStorage.setItem('sbt_logged_in', 'true');
                sessionStorage.setItem('sbt_user_id', data.id);
                // ... (lanjutan kode aslinya)

                // Simpan sesi login sementara di browser (sessionStorage)
                sessionStorage.setItem('sbt_logged_in', 'true');
                sessionStorage.setItem('sbt_user_id', data.id);
                sessionStorage.setItem('sbt_username', data.username);
                sessionStorage.setItem('sbt_nama_lembaga', data.nama_lembaga);
                sessionStorage.setItem('sbt_role', data.role);
                sessionStorage.setItem('sbt_telp_posko', data.telp_posko || '');

                alert(`Selamat datang, ${data.nama_lembaga}!`);

                // Normalisasi teks role dari database ke huruf kecil untuk pengarahan halaman yang aman
                const roleUser = (data.role || '').toLowerCase().trim();

                // Arahkan halaman berdasarkan role pengguna secara fleksibel
                if (roleUser.includes('superadmin')) {
                    sessionStorage.setItem('sbt_admin_auth', 'true');
                    window.location.href = 'admin.html';
                } else if (roleUser.includes('kolaborasi')) {
                    window.location.href = 'kolaborator.html'; // Kemenag / Koperasi
                } else if (roleUser.includes('pimpinan') || roleUser.includes('eksekutif')) {
                    window.location.href = 'pimpinan.html'; // Bupati / Pimpinan Daerah
                } else {
                    window.location.href = 'petugas.html'; // Damkar / BPBD / Petugas Utama
                }

            } catch (err) {
                console.error(err);
                alert('Terjadi kesalahan sistem saat mencoba masuk.');
                btn.disabled = false;
                btn.textContent = 'Masuk ke Dashboard 🚀';
            }
        });
