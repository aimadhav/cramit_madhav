import { createClient } from '@supabase/supabase-js';
import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);
const prisma = new PrismaClient();

async function populatePresentationData() {
  console.log('🚀 Starting presentation data population...');

  // 1. Define Accounts
  const teacher = { email: 'madhav@cramit.com', password: 'Cramit2026!', name: 'Madhav Joshi' };
  const students = [
    { email: 'arjun@test.com', password: 'Student123!', name: 'Arjun Sharma', streak: 15, studied: 450 },
    { email: 'sita@test.com', password: 'Student123!', name: 'Sita Verma', streak: 8, studied: 210 },
    { email: 'rohan@test.com', password: 'Student123!', name: 'Rohan Reddy', streak: 22, studied: 890 },
    { email: 'priya@test.com', password: 'Student123!', name: 'Priya Kumar', streak: 3, studied: 45 },
    { email: 'vikram@test.com', password: 'Student123!', name: 'Vikram Singh', streak: 12, studied: 320 },
  ];

  try {
    // 2. Create Teacher in Supabase & Prisma
    const teacherAuth = await createOrGetUser(teacher.email, teacher.password, teacher.name);
    await prisma.user.upsert({
      where: { id: teacherAuth.id },
      update: { isAdmin: true },
      create: { id: teacherAuth.id, email: teacher.email, name: teacher.name, isAdmin: true }
    });

    // 3. Create Room (Class)
    const room = await prisma.rooms.upsert({
      where: { code: 'ELITE6' },
      update: { name: 'Physics Elite Batch' },
      create: {
        name: 'Physics Elite Batch',
        code: 'ELITE6',
        description: 'Advanced Physics preparation for top performers.',
        created_by: teacherAuth.id
      }
    });

    // Teacher joins as teacher
    await prisma.room_memberships.upsert({
      where: { room_id_user_id: { room_id: room.id, user_id: teacherAuth.id } },
      update: { role: 'teacher' },
      create: { room_id: room.id, user_id: teacherAuth.id, role: 'teacher' }
    });

    // 4. Create Students and Study Data
    for (const s of students) {
      const sAuth = await createOrGetUser(s.email, s.password, s.name);
      await prisma.user.upsert({
        where: { id: sAuth.id },
        update: {
          streakDays: s.streak,
          totalCardsStudied: s.studied,
          lastStudyDate: new Date()
        },
        create: {
          id: sAuth.id,
          email: s.email,
          name: s.name,
          streakDays: s.streak,
          totalCardsStudied: s.studied,
          lastStudyDate: new Date()
        }
      });

      // Join Room
      await prisma.room_memberships.upsert({
        where: { room_id_user_id: { room_id: room.id, user_id: sAuth.id } },
        update: { role: 'student' },
        create: { room_id: room.id, user_id: sAuth.id, role: 'student' }
      });

      console.log(`✅ Populated student: ${s.email}`);
    }

    console.log('\n🎉 Presentation data is READY!');
    console.log('Class Code: ELITE6');
    console.log('Teacher: madhav@cramit.com / Cramit2026!');
  } catch (err) {
    console.error('❌ Population Error:', err);
  } finally {
    await prisma.$disconnect();
  }
}

async function createOrGetUser(email: string, password: string, name: string) {
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: name }
  });

  if (error) {
    if (error.message.includes('already registered')) {
      const { data: list } = await supabase.auth.admin.listUsers();
      return list.users.find(u => u.email === email)!;
    }
    throw error;
  }
  return data.user!;
}

populatePresentationData();
