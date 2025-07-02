import {
  registerDecorator,
  ValidationOptions,
  ValidationArguments,
} from 'class-validator';

export const VALID_TIMEZONES = [
  'UTC',
  'America/New_York',
  'America/Los_Angeles',
  'Europe/London',
  'Europe/Berlin',
  'Asia/Tokyo',
  'Asia/Singapore',
  'Australia/Sydney',
];

/**
 * Custom validator decorator to check if a timezone is valid
 */
export function IsValidTimezone(validationOptions?: ValidationOptions) {
  return function (object: any, propertyName: string) {
    registerDecorator({
      name: 'isValidTimezone',
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      validator: {
        validate(value: any) {
          return typeof value === 'string' && VALID_TIMEZONES.includes(value);
        },
        defaultMessage(args: ValidationArguments) {
          return `${args.property} must be a valid timezone. Valid options are: ${VALID_TIMEZONES.join(', ')}`;
        },
      },
    });
  };
}

module.exports = {
  IsValidTimezone,
};

/**
 * Re-export the IsValidTimezone for use in other files
 * No need to import it within the same file
 */

export class UserPreferencesDto {
  // Other properties

  @IsValidTimezone()
  timeZone: string;
}
