// assets/js/notification.js
// Skrip global untuk memantau data baru & memutar notifikasi suara (jika browser aktif)

(function() {
    let lastKnownCount = null;
    let audioCtx = null;

    // Fungsi untuk memutar suara "Beep" pendek menggunakan Web Audio API (Tidak perlu file audio eksternal)
    function playBeep() {
        try {
            if (!audioCtx) {
                audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            }
            if (audioCtx.state === 'suspended') {
                audioCtx.resume();
            }

            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            
            osc.type = 'sine';
            osc.frequency.value = 880; // Nada tinggi (A5)
            
            gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.00001, audioCtx.currentTime + 0.5);
            
            osc.connect(gain);
            gain.connect(audioCtx.destination);
            
            osc.start();
            osc.stop(audioCtx.currentTime + 0.5);
        } catch (e) {
            console.log("Audio diblokir browser sebelum ada interaksi klik.");
        }
    }

    // Fungsi pemantau global yang berjalan di background setiap beberapa detik
    async function checkGlobalNotifications() {
        if (typeof supabaseClient === 'undefined') return;

        try {
            const { data, error } = await supabaseClient
                .from('laporan')
                .select('id, status, minta_bantuan')
                .order('created_at', { ascending: false });

            if (!error && data) {
                const totalBaruAtauDarurat = data.filter(i => i.status === 'Baru' || i.minta_bantuan === true).length;

                // Jika jumlah data baru/darurat bertambah dari sebelumnya, bunyikan alarm
                if (lastKnownCount !== null && totalBaruAtauDarurat > lastKnownCount) {
                    playBeep();
                    console.warn("🚨 Ada laporan darurat / baru masuk!");
                }

                lastKnownCount = totalBaruAtauDarurat;
            }
        } catch (err) {
            // Abaikan error koneksi sementara
        }
    }

    // Jalankan pengecekan otomatis setiap 5 detik di semua halaman yang memuat skrip ini
    setInterval(checkGlobalNotifications, 5000);
})();
