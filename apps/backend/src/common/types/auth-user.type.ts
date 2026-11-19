import { AccountType } from '@prisma/client';

export interface AuthenticatedUser {
  id: string;
  email: string;
  username: string;
  fullName: string;
  avatar: string | null;
  accountType: AccountType;
  isTeacherVerified: boolean;
  emailVerified: boolean;
  isBlocked: boolean;
  createdAt: Date;
  updatedAt: Date;
}
