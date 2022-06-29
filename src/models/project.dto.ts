import { CategoryEntity } from '@/models/category.dto';
import { ClientEntity } from '@/models/client.dto';

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

export interface AddCategoryInput {
  projectCode?: ProjectEntity['code'];
  categoryCode?: CategoryEntity['code'];
}
