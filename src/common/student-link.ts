import { PrismaService } from 'src/core/prisma/prisma.service';

/** Telefonni solishtirish uchun: faqat raqamlar, oxirgi 9 ta (+998 90 123 45 67 == 901234567) */
export const normPhone = (p?: string | null) => (p ?? '').replace(/\D/g, '').slice(-9);

/** User kirganda: telefon bo'yicha Student topilsa bog'laydi va isCenterStudent=true qiladi */
export async function linkStudentByPhone(prisma: PrismaService, userId: string, phone: string) {
  const key = normPhone(phone);
  if (key.length < 9) return false;

  // Allaqachon bog'langan bo'lsa, faqat bayroqni tekshiramiz
  const already = await prisma.student.findUnique({ where: { userId }, select: { id: true } });
  if (already) {
    await prisma.user.update({ where: { id: userId }, data: { isCenterStudent: true } });
    return true;
  }

  const candidates = await prisma.student.findMany({
    where: { userId: null, isActive: true, phone: { not: null } },
    select: { id: true, phone: true },
  });
  const match = candidates.find((s) => normPhone(s.phone) === key);
  if (!match) return false;

  await prisma.$transaction([
    prisma.student.update({ where: { id: match.id }, data: { userId } }),
    prisma.user.update({ where: { id: userId }, data: { isCenterStudent: true } }),
  ]);
  return true;
}

/** Admin o'quvchi qo'shganda/telefonini o'zgartirganda: shu telefonli User bo'lsa bog'laydi */
export async function linkUserForStudent(prisma: PrismaService, studentId: string, phone?: string | null) {
  const key = normPhone(phone);
  if (key.length < 9) return false;

  const user = await prisma.user.findFirst({
    where: { phone: { endsWith: key }, student: { is: null } },
    select: { id: true },
  });
  if (!user) return false;

  await prisma.$transaction([
    prisma.student.update({ where: { id: studentId }, data: { userId: user.id } }),
    prisma.user.update({ where: { id: user.id }, data: { isCenterStudent: true } }),
  ]);
  return true;
}
