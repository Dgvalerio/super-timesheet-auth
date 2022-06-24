import { CategoryEntity } from '@/utils/category.dto';
import { ProjectEntity } from '@/utils/project.dto';
import { UserEntity } from '@/utils/user.dto';

export enum AppointmentStatus {
  PreApproved = 'PreApproved',
  Approved = 'Approved',
  Review = 'Review',
  Unapproved = 'Unapproved',
  Draft = 'Draft',
  Unknown = 'Unknown',
}

export interface AppointmentEntity {
  id: string;
  code?: string;
  date: string;
  startTime: string;
  endTime: string;
  notMonetize: boolean;
  description: string;
  commit?: string;
  status: AppointmentStatus;
  user: UserEntity;
  project: ProjectEntity;
  category: CategoryEntity;
}

export interface CreateAppointmentInput {
  code: AppointmentEntity['code'];
  date: AppointmentEntity['date'];
  startTime: AppointmentEntity['startTime'];
  endTime: AppointmentEntity['endTime'];
  notMonetize: AppointmentEntity['notMonetize'];
  description: AppointmentEntity['description'];
  commit?: AppointmentEntity['commit'];
  status: AppointmentEntity['status'];
  userEmail: UserEntity['email'];
  projectCode: ProjectEntity['code'];
  categoryCode: CategoryEntity['code'];
}
