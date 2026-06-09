const { PrismaClient } = require('@prisma/client');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);
const prisma = new PrismaClient();

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

    await prisma.user.upsert({
      where: { id: existingUser.id },
      update: { email, name },
      create: { id: existingUser.id, email, name }
    });
    console.log('Prisma user record verified.');
  } else {
    console.log('User not found. Creating new user...');
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name }
    });
    if (authError) throw authError;
    
    await prisma.user.create({
      data: {
        id: authData.user.id,
        email: authData.user.email,
        name: name,
      }
    });
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
  .finally(async () => {
    await prisma.$disconnect();
  });
