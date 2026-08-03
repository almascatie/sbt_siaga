// config.js
const CONFIG = {
    MAPBOX_TOKEN: 'pk.eyJ1IjoiYWxtYXNjYXRpZSIsImEiOiJjbHE3YzVhMGgwdzVjMmlwczVlaWhpMmJ2In0.C98KArIa5on5kkr9C3Plvg',
    SUPABASE_URL: 'https://tpopgxvuwdjqaaltssuf.supabase.co',
    SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRwb3BneHZ1d2RqcWFhbHRzc3VmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU2NTM0NjEsImV4cCI6MjEwMTIyOTQ2MX0.RwSzeGbnxrGCzY4KIDrbyHU9gnUyW7EqwSxaRsHO4rY'
};

// Inisialisasi Supabase khusus untuk format Publishable Key baru
const supabaseClient = supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY, {
    auth: { persistSession: false }
});
