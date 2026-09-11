// ================================================================
// KONEKSI SUPABASE
// ================================================================

const SUPABASE_URL = "https://zfnjivspodhexojftddt.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpmbmppdnNwb2RoZXhvamZ0ZGR0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkwODk0NjcsImV4cCI6MjEwNDY2NTQ2N30.6WoI8ut9bp_3kGdtL5in2S97wgG_tyx96mE1vY2QNWc";

const SUPABASE_CONFIGURED =
  !SUPABASE_URL.includes("YOUR-PROJECT-REF") &&
  !SUPABASE_ANON_KEY.includes("YOUR-ANON-PUBLIC-KEY");

const supabaseClient = SUPABASE_CONFIGURED
  ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;

if (!SUPABASE_CONFIGURED) {
  console.warn(
    "Supabase belum dikonfigurasi. Isi SUPABASE_URL dan SUPABASE_ANON_KEY " +
    "di js/supabaseClient.js supaya data tersimpan ke database (lihat README.md)."
  );
}

// ---------- Edisi BRS yang sudah terbit ----------

async function dbFetchEditions() {
  if (!supabaseClient) return [];
  const { data, error } = await supabaseClient
    .from("published_editions")
    .select("label, trend_rows, rlmt_rows, published_at");
  if (error) {
    console.error("Gagal memuat edisi dari Supabase:", error.message);
    return [];
  }
  return (data || []).map(row => ({
    label: row.label,
    trendRows: row.trend_rows,
    rlmtRows: row.rlmt_rows,
    publishedAt: row.published_at
  }));
}

async function dbUpsertEdition(edition) {
  if (!supabaseClient) return { message: "Supabase belum dikonfigurasi" };
  const { error } = await supabaseClient
    .from("published_editions")
    .upsert(
      {
        label: edition.label,
        trend_rows: edition.trendRows,
        rlmt_rows: edition.rlmtRows,
        published_at: edition.publishedAt
      },
      { onConflict: "label" }
    );
  return error;
}

async function dbDeleteEdition(label) {
  if (!supabaseClient) return { message: "Supabase belum dikonfigurasi" };
  const { error } = await supabaseClient
    .from("published_editions")
    .delete()
    .eq("label", label);
  return error;
}

// ---------- Draf admin (Panel Admin) ----------

async function dbFetchDraft() {
  if (!supabaseClient) return null;
  const { data, error } = await supabaseClient
    .from("draft_data")
    .select("trend_rows, rlmt_rows")
    .eq("id", 1)
    .maybeSingle();
  if (error || !data) return null;
  return { trendRows: data.trend_rows, rlmtRows: data.rlmt_rows };
}

async function dbSaveDraft(trendRowsVal, rlmtRowsVal) {
  if (!supabaseClient) return { message: "Supabase belum dikonfigurasi" };
  const { error } = await supabaseClient
    .from("draft_data")
    .upsert({
      id: 1,
      trend_rows: trendRowsVal,
      rlmt_rows: rlmtRowsVal,
      updated_at: new Date().toISOString()
    });
  return error;
}
