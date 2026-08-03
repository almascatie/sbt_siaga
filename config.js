// config.js
const CONFIG = {
    MAPBOX_TOKEN: 'pk.eyJ1IjoiYWxtYXNjYXRpZSIsImEiOiJjbHE3YzVhMGgwdzVjMmlwczVlaWhpMmJ2In0.C98KArIa5on5kkr9C3Plvg',
    SUPABASE_URL: 'https://tpopgxvuwdjqaaltssuf.supabase.co',
    SUPABASE_ANON_KEY: 'sb_publishable_qfy-1Xfaa3MVa5HqvEEmOQ_tzT6qEPm'
};

// Inisialisasi Supabase khusus untuk format Publishable Key baru
const supabaseClient = supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY, {
    auth: { persistSession: false }
});
