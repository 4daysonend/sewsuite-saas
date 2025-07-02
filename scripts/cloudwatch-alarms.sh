#!/bin/bash
# Create comprehensive monitoring

# High CPU Alert
aws cloudwatch put-metric-alarm \
  --alarm-name "SewSuite-High-CPU" \
  --alarm-description "Alert when CPU exceeds 80%" \
  --metric-name CPUUtilization \
  --namespace AWS/ECS \
  --statistic Average \
  --period 300 \
  --threshold 80 \
  --comparison-operator GreaterThanThreshold \
  --evaluation-periods 2

# High Memory Alert
aws cloudwatch put-metric-alarm \
  --alarm-name "SewSuite-High-Memory" \
  --alarm-description "Alert when memory exceeds 85%" \
  --metric-name MemoryUtilization \
  --namespace AWS/ECS \
  --statistic Average \
  --period 300 \
  --threshold 85 \
  --comparison-operator GreaterThanThreshold \
  --evaluation-periods 2

# Database Connection Alert
aws cloudwatch put-metric-alarm \
  --alarm-name "SewSuite-DB-Connections" \
  --alarm-description "Alert when DB connections exceed 80%" \
  --metric-name DatabaseConnections \
  --namespace AWS/RDS \
  --statistic Average \
  --period 300 \
  --threshold 80 \
  --comparison-operator GreaterThanThreshold \
  --evaluation-periods 2

  # Create CloudWatch alarms for security events
aws cloudwatch put-metric-alarm \
    --alarm-name HighSeverityFinding \
    --alarm-description "Alarm when a high severity finding is detected" \
    --metric-name HighSeverityFindings \
    --namespace AWS/SecurityHub \
    --statistic Sum \
    --period 300 \
    --threshold 1 \
    --comparison-operator GreaterThanOrEqualToThreshold \
    --evaluation-periods 1 \
    --alarm-actions arn:aws:sns:us-east-1:${AWS_ACCOUNT_ID}:security-alerts

# Set up AWS EventBridge rule for failed login attempts
aws events put-rule \
    --name sewsuite-failed-console-login \
    --event-pattern '{"source":["aws.signin"],"detail-type":["AWS Console Sign In via CloudTrail"],"detail":{"eventName":["ConsoleLogin"],"responseElements":{"ConsoleLogin":"Failure"}}}'

aws events put-targets \
    --rule sewsuite-failed-console-login \
    --targets 'Id"="1","Arn"="arn:aws:sns:us-east-1:'${AWS_ACCOUNT_ID}':security-alerts"'