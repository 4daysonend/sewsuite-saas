import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { UserCreatedEvent } from '../auth/users/events/user-created.event';

@Injectable()
export class UserAnalyticsService {
  private readonly logger = new Logger(UserAnalyticsService.name);

  @OnEvent('user.created')
  handleUserCreated(event: UserCreatedEvent) {
    const { user } = event;
    this.logger.log(`[Analytics] New user registered: ${user.email}`);

    // Track user registration in analytics system
    this.trackRegistration({
      userId: user.id,
      email: user.email,
      timestamp: new Date(),
      source: user.referralSource || 'direct',
      metadata: {
        role: user.role,
        hasProfile: !!user.firstName,
      },
    });
  }

  private trackRegistration(data: any): void {
    // Implementation to track in your analytics system
    // For example:
    // await this.analyticsClient.trackEvent('user_registration', data);

    this.logger.log(`User registration tracked for analytics: ${data.userId}`);
  }
}
