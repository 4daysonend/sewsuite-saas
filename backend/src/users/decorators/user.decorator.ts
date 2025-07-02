import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * Custom parameter decorator to extract the authenticated user from the request object
 *
 * Usage:
 * ```typescript
 * @Get('profile')
 * getProfile(@User() user: UserEntity) {
 *   return user;
 * }
 * ```
 */
export const User = createParamDecorator(
  (data: string, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user;

    return data ? user?.[data] : user;
  },
);

/**
 * Example controller method demonstrating the use of the User decorator
 *
 * ```typescript
 * async sendTestEmail(
 *   @Body() body: SendEmailRequest,
 *   @Req() request: Request,
 *   @User() user: YourUserType, // Add this parameter
 * ): Promise<SendEmailResponse> {
 *   // Use user.id instead of (request.user as any)?.id
 * }
 * ```
 */
