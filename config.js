// ההגדרות היחידות שצריך למלא. את שני הערכים הראשונים מעתיקים מ-Supabase:
// Project Settings -> API  (Project URL, וה-anon public key / publishable key).
// המפתח הזה נועד להיות גלוי. ההגנה על הנתונים נעשית בהרשאות שב-supabase-setup.sql.
window.APP_CONFIG = {
  SUPABASE_URL: "YOUR_SUPABASE_URL",
  SUPABASE_ANON_KEY: "YOUR_SUPABASE_ANON_KEY",
  // היום הראשון של המחברת. משפיע על המונה "יום N" ועל הרשת השנתית.
  START_DATE: "2026-08-26"
};
