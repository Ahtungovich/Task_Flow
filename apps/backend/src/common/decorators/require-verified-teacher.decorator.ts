import { SetMetadata } from '@nestjs/common';

export const REQUIRE_VERIFIED_TEACHER_KEY = 'requireVerifiedTeacher';
export const RequireVerifiedTeacher = () =>
  SetMetadata(REQUIRE_VERIFIED_TEACHER_KEY, true);
