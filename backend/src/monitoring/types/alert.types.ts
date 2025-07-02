// At the top of your file
import { Alert } from '../entities/alert.entity';

export enum AlertSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

export class AlertService {
  constructor(private alertRepository: any) {}

  async createOrUpdateAlert(
    severity: AlertSeverity, // Use the AlertSeverity enum
    type: string,
    title: string,
    message: string,
  ): Promise<Alert> {
    // Check if a similar alert already exists
    const existingAlert = await this.alertRepository.findOne({
      where: {
        type,
        status: 'active',
      },
    });

    if (existingAlert) {
      // Update the existing alert
      existingAlert.count += 1;
      existingAlert.lastOccurrence = new Date();
      // Now this will work properly with the typed severity
      if (this.isSeverityHigher(severity, existingAlert.severity)) {
        existingAlert.severity = severity;
      }
      existingAlert.message = message;
      return this.alertRepository.save(existingAlert);
    }

    // Create a new alert if none exists
    const alert = this.alertRepository.create({
      timestamp: new Date(),
      severity,
      title,
      type,
      message,
      status: 'active',
      count: 1,
    });
    return this.alertRepository.save(alert);
  }

  private isSeverityHigher(
    newSeverity: AlertSeverity,
    existingSeverity: AlertSeverity,
  ): boolean {
    const severityOrder = {
      [AlertSeverity.LOW]: 1,
      [AlertSeverity.MEDIUM]: 2,
      [AlertSeverity.HIGH]: 3,
      [AlertSeverity.CRITICAL]: 4,
    };
    return severityOrder[newSeverity] > severityOrder[existingSeverity];
  }
}
