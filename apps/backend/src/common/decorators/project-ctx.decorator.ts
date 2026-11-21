import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { ProjectRequestContext } from '../guards/project-access.guard';

export const ProjectCtx = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): ProjectRequestContext => {
    const request = ctx.switchToHttp().getRequest();
    return request.projectContext as ProjectRequestContext;
  },
);
