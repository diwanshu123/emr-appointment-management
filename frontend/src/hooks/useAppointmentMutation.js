import { useMutation, useQueryClient } from '@tanstack/react-query';
import { getErrorMessage } from '../api/client';
import { useToast } from '../context/ToastContext';

/** Runs a write, then refreshes every list that could be affected. */
export default function useAppointmentMutation(mutationFn, successMessage, { onDone } = {}) {
  const queryClient = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn,
    onSuccess: () => {
      toast.success(successMessage);
      ['appointments', 'slots', 'dashboard'].forEach((key) => queryClient.invalidateQueries({ queryKey: [key] }));
      onDone?.();
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });
}
