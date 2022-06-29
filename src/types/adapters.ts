import { AppointmentStatus } from '@/models/appointment.dto';

export const statusAdapter = (previous: string): AppointmentStatus => {
  switch (previous) {
    case 'Aprovada':
      return AppointmentStatus.Approved;
    case 'Pré-Aprovada':
      return AppointmentStatus.PreApproved;
    case 'Em análise':
      return AppointmentStatus.Review;
    case 'Reprovada':
      return AppointmentStatus.Unapproved;
    default:
      return AppointmentStatus.Unknown;
  }
};
