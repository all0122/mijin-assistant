import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://vqeykyhhyrmqiapkmjal.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZxZXlreWhoeXJtcWlhcGttamFsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkxNTAxMTYsImV4cCI6MjA5NDcyNjExNn0.x-wOTHyC5IMx0jL0S2hld8LCc6-9mBnDbLc53dhlo7Q";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
