import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { ParentLinkStatus, Role } from '@prisma/client';
import { PrismaService } from 'src/core/prisma/prisma.service';
import { StudentService } from '../student/student.service';
import { ParentRegisterDto } from './dto/parent.dto';

const MAX_LINKS = 10; // bitta ota-ona ko'pi bilan nechta so'rov yubora oladi

@Injectable()
export class ParentService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private students: StudentService,
  ) {}

  /* ───────────── Ro'yxatdan o'tish / kirish ───────────── */

  async register(dto: ParentRegisterDto) {
    const phone = dto.phone.trim();
    let user = await this.prisma.user.findUnique({ where: { phone } });

    if (!user) {
      user = await this.prisma.user.create({
        data: {
          name: dto.name.trim(),
          phone,
          password: await bcrypt.hash(dto.password, 10),
          role: Role.PARENT,
        },
      });
    } else {
      if (user.role !== Role.PARENT) {
        throw new ConflictException('Bu telefon raqam bilan ota-ona akkaunti ochib bo‘lmaydi');
      }
      const invalid = new UnauthorizedException('Telefon yoki parol noto‘g‘ri');
      if (!user.isActive || !user.password) throw invalid;
      if (!(await bcrypt.compare(dto.password, user.password))) throw invalid;
    }

    const accessToken = this.jwt.sign(
      { sub: user.id, role: user.role },
      { secret: process.env.JWT_SECRET, expiresIn: '1d' },
    );

    return {
      accessToken,
      user: { id: user.id, name: user.name, role: user.role },
      redirect: '/parent',
    };
  }

  /* ───────────── Guruh va o'quvchi tanlash (faqat ism!) ───────────── */

  listGroups() {
    return this.prisma.group.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        schedule: true,
        level: { select: { type: true } },
        _count: { select: { students: { where: { isActive: true } } } },
      },
    });
  }

  async groupStudents(groupId: string) {
    const group = await this.prisma.group.findFirst({ where: { id: groupId, isActive: true }, select: { id: true } });
    if (!group) throw new NotFoundException('Guruh topilmadi');

    return this.prisma.student.findMany({
      where: { groupId, isActive: true },
      orderBy: { name: 'asc' },
      select: { id: true, name: true }, // telefon va boshqa ma'lumot ko'rsatilmaydi
    });
  }

  /* ───────────── Farzandlar ───────────── */

  async addChild(parentId: string, studentId: string) {
    const student = await this.prisma.student.findFirst({
      where: { id: studentId, isActive: true },
      select: { id: true },
    });
    if (!student) throw new NotFoundException('O‘quvchi topilmadi');

    const select = { id: true, status: true, createdAt: true, studentId: true } as const;

    const existing = await this.prisma.parentStudent.findUnique({
      where: { parentId_studentId: { parentId, studentId } },
      select,
    });
    if (existing) return existing;

    const count = await this.prisma.parentStudent.count({ where: { parentId } });
    if (count >= MAX_LINKS) {
      throw new BadRequestException(`Ko‘pi bilan ${MAX_LINKS} ta so‘rov yuborish mumkin`);
    }

    const auto = process.env.PARENT_AUTO_APPROVE === 'true';
    return this.prisma.parentStudent.create({
      data: {
        parentId,
        studentId,
        status: auto ? ParentLinkStatus.APPROVED : ParentLinkStatus.PENDING,
        approvedAt: auto ? new Date() : null,
      },
      select,
    });
  }

  myChildren(parentId: string) {
    return this.prisma.parentStudent.findMany({
      where: { parentId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        status: true,
        createdAt: true,
        student: { select: { id: true, name: true, group: { select: { id: true, name: true } } } },
      },
    });
  }

  async removeChild(parentId: string, linkId: string) {
    const link = await this.prisma.parentStudent.findFirst({ where: { id: linkId, parentId }, select: { id: true } });
    if (!link) throw new NotFoundException('So‘rov topilmadi');
    await this.prisma.parentStudent.delete({ where: { id: linkId } });
    return { deleted: true };
  }

  /** Faqat TASDIQLANGAN farzandning statistikasi */
  async childStats(parentId: string, studentId: string) {
    const link = await this.prisma.parentStudent.findUnique({
      where: { parentId_studentId: { parentId, studentId } },
      select: { status: true },
    });
    if (!link) throw new ForbiddenException('Bu o‘quvchi sizga biriktirilmagan');
    if (link.status === ParentLinkStatus.PENDING) throw new ForbiddenException('So‘rov hali tasdiqlanmagan');
    if (link.status === ParentLinkStatus.REJECTED) throw new ForbiddenException('So‘rov rad etilgan');

    const data = await this.students.statsByStudentId(studentId);
    if (!data.isStudent) return data;
    // Ota-onaga o'quvchining telefon raqami ko'rsatilmaydi
    return { ...data, student: { ...data.student, phone: null } };
  }

  /* ───────────── Admin: so'rovlarni ko'rib chiqish ───────────── */

  listRequests(status?: ParentLinkStatus) {
    return this.prisma.parentStudent.findMany({
      where: status ? { status } : {},
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        status: true,
        createdAt: true,
        approvedAt: true,
        parent: { select: { id: true, name: true, phone: true } },
        student: { select: { id: true, name: true, group: { select: { id: true, name: true } } } },
      },
    });
  }

  async review(id: string, status: 'APPROVED' | 'REJECTED') {
    const link = await this.prisma.parentStudent.findUnique({ where: { id }, select: { id: true } });
    if (!link) throw new NotFoundException('So‘rov topilmadi');

    return this.prisma.parentStudent.update({
      where: { id },
      data: { status, approvedAt: status === 'APPROVED' ? new Date() : null },
      select: { id: true, status: true, approvedAt: true },
    });
  }
}
