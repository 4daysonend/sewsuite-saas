// /backend/src/email/email.module.ts
import { Module, OnModuleInit } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BullModule, BullModuleOptions } from '@nestjs/bull';
import { EmailService } from './email.service';
import { EmailProcessor } from './email.processor';
import { EmailController } from './email.controller';
import { registerTemplateHelpers } from './helpers/template-helpers';

const emailQueueConfig: BullModuleOptions = {
  name: 'email',
} as const;

@Module({
  imports: [
    ConfigModule,
    BullModule.registerQueue(emailQueueConfig),
  ],
  providers: [EmailService, EmailProcessor],
  controllers: [EmailController],
  exports: [EmailService],
})
export class EmailModule implements OnModuleInit {
  onModuleInit(): void {
    registerTemplateHelpers();
  }
}