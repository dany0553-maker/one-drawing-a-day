// ההגדרות היחידות שצריך למלא. את שני הערכים הראשונים מעתיקים מ-Supabase:
// Project Settings -> API  (Project URL, וה-anon public key / publishable key).
// המפתח הזה נועד להיות גלוי. ההגנה על הנתונים נעשית בהרשאות שב-supabase-setup.sql.
window.APP_CONFIG = {
  SUPABASE_URL: "https://lnaxmpuveyfrhcfhnfyj.supabase.co",
  SUPABASE_ANON_KEY: "sb_publishable_nyluSxlAStb9ZE9Z5zJ1VQ_zt0ymy4v",
  // היום הראשון של המחברת. משפיע על המונה "יום N" ועל הרשת השנתית.
  START_DATE: "2026-08-26"
};
