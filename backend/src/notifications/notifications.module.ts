import { Module } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
// Import any other dependencies like MailerModule if needed

@Module({
  imports: [
    // Add dependencies like MailerModule if needed
  ],
  providers: [NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
