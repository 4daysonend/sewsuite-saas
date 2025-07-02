import { useState } from 'react';

interface FormSubmitOptions<T, R> {
  onSubmit: (data: T) => Promise<R>;
  onSuccess?: (result: R) => void;
  onError?: (error: Error) => void;
}

export function useFormSubmit<T, R>({ onSubmit, onSuccess, onError }: FormSubmitOptions<T, R>) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (data: T) => {
    setIsSubmitting(true);
    setError(null);
    
    try {
      const result = await onSubmit(data);
      if (onSuccess) onSuccess(result);
      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred';
      setError(errorMessage);
      if (onError) onError(err instanceof Error ? err : new Error(errorMessage));
      return null;
    } finally {
      setIsSubmitting(false);
    }
  };

  return {
    isSubmitting,
    error,
    handleSubmit,
    setError
  };
}