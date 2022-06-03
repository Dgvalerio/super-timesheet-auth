import { CategoryEntity } from '@/utils/category.dto';
import { ClientEntity } from '@/utils/client.dto';

export interface ProjectEntity {
  id: string;
  code: string;
  name: string;
  startDate: string;
  endDate: string;
  client: ClientEntity;
  categories: CategoryEntity[];
}

export interface CreateProjectInput {
  code: ProjectEntity['code'];
  name: ProjectEntity['name'];
  startDate: ProjectEntity['startDate'];
  endDate: ProjectEntity['endDate'];
  clientCode: ProjectEntity['code'];
}
