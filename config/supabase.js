const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL || 'https://gezfrndekmttkoulzwwr.supabase.co';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdlemZybmRla210dGtvdWx6d3dyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA1MTAwODMsImV4cCI6MjA5NjA4NjA4M30.E5U4lc9Ev7EVmDWESkxSoykT-mftBNfAdW4t4t2Y6Pc';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdlemZybmRla210dGtvdWx6d3dyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDUxMDA4MywiZXhwIjoyMDk2MDg2MDgzfQ.g0wRNoVySh3YiqvRcdj61RY-oDOnQZ0kkQOsF7hHY4k';

const supabase = createClient(supabaseUrl, supabaseAnonKey);
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

module.exports = { supabase, supabaseAdmin };
