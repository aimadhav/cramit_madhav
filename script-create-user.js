const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const baseUserRow = {
  is_premium: false,
  is_admin: false,
  total_cards_studied: 0,
  total_time_studied: 0,
  streak_days: 0,
  last_study_date: null,
  role: 'student',
  prep_focus: null,
  phone: null,
};

async function main() {
  const email = 'beta@cramit.com';
  const password = 'password123';
  const name = 'Beta User';

  console.log(`Searching for user ${email}...`);
  
  const { data: listData, error: listError } = await supabase.auth.admin.listUsers();
  if (listError) throw listError;
  
  const existingUser = listData.users.find(u => u.email === email);

  if (existingUser) {
    console.log('User exists in Supabase Auth. Resetting password...');
    const { error: updateError } = await supabase.auth.admin.updateUserById(existingUser.id, {
      password: password
    });
    if (updateError) throw updateError;
    console.log('Password reset to password123');

    const { error: profileError } = await supabase
      .from('users')
      .upsert({
        id: existingUser.id,
        email,
        name,
        ...baseUserRow,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'id',
      });

    if (profileError) throw profileError;
    console.log('Supabase user record verified.');
  } else {
    console.log('User not found. Creating new user...');
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name }
    });
    if (authError) throw authError;

    if (!authData.user) {
      throw new Error('Auth user was not returned from Supabase.');
    }
    
    const { error: profileError } = await supabase
      .from('users')
      .upsert({
        id: authData.user.id,
        email: authData.user.email,
        name,
        ...baseUserRow,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'id',
      });

    if (profileError) throw profileError;
    console.log('User created successfully.');
  }

  console.log(`\n✅ LOGIN CREDENTIALS:`);
  console.log(`Email: ${email}`);
  console.log(`Password: ${password}`);
}

main()
  .catch(e => {
    console.error('❌ Script failed:', e.message);
    process.exit(1);
  })
  .finally(() => {});
