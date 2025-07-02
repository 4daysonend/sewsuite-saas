import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { UserCreatedEvent } from '../auth/users/events/user-created.event';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  @OnEvent('user.created')
  async handleUserCreatedEvent(event: UserCreatedEvent) {
    try {
      const { user } = event;
      this.logger.log(`New user registered: ${user.email}`);

      // Send welcome email
      await this.sendWelcomeEmail(user);

      // Add to marketing list if user consented
      // await this.addToMarketingList(user);

      // Log for analytics
      // await this.trackUserRegistration(user);
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;

      this.logger.error(
        `Failed to process new user notification: ${errorMessage}`,
        errorStack,
      );
      // Non-critical error, don't throw
    }
  }

  private async sendWelcomeEmail(user: any): Promise<void> {
    // Implementation to send email
    // For example:
    // await this.mailerService.sendMail({
    //   to: user.email,
    //   subject: 'Welcome to Our Platform',
    //   template: 'welcome',
    //   context: {
    //     firstName: user.firstName || 'there',
    //   },
    // });

    this.logger.log(`Welcome email sent to ${user.email}`);
  }
}
