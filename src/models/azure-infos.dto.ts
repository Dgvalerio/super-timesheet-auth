import { UserEntity } from '@/models/user.dto';

export interface AzureInfosEntity {
  id: string;
  login: string;
  content: string;
  iv: string;
  currentMonthWorkedTime: string;
  user: UserEntity;
  updatedDate: Date;
}

export interface UpdateAzureInfosInput {
  id: AzureInfosEntity['id'];
  login?: AzureInfosEntity['login'];
  currentMonthWorkedTime?: AzureInfosEntity['currentMonthWorkedTime'];
  password?: string;
}
