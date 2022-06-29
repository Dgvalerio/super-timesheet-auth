import { ProjectEntity } from '@/models/project.dto';

export interface ClientEntity {
  id: string;
  code?: string;
  name: string;
  projects: ProjectEntity[];
}

export interface CreateClientInput {
  code: ClientEntity['code'];
  name: ClientEntity['name'];
}
