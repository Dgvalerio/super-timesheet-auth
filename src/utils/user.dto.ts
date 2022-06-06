import { ProjectEntity } from '@/utils/project.dto';

export interface UserEntity {
  id: string;
  name: string;
  email: string;
  password: string;
  projects: ProjectEntity[];
}

export interface GetUserInput {
  id?: UserEntity['id'];
  email?: UserEntity['email'];
}
