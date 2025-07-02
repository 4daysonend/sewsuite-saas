import {
  registerDecorator,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

// List of valid currency codes based on ISO 4217
const VALID_CURRENCIES = [
  'USD',
  'EUR',
  'GBP',
  'JPY',
  'AUD',
  'CAD',
  'CHF',
  'CNY',
  'SEK',
  'NZD',
];

@ValidatorConstraint({ async: false })
export class IsCurrencyConstraint implements ValidatorConstraintInterface {
  validate(value: any) {
    return (
      typeof value === 'string' &&
      VALID_CURRENCIES.includes(value.toUpperCase())
    );
  }

  defaultMessage() {
    return (
      'Invalid currency code. Accepted values: ' + VALID_CURRENCIES.join(', ')
    );
  }
}

export function IsCurrency(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsCurrencyConstraint,
    });
  };
}
