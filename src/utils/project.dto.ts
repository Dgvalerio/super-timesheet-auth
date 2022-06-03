import { CategoryEntity } from '@/utils/category.dto';
import { ClientEntity } from '@/utils/client.dto';

export interface ProjectEntity {
  id: string;
  code?: string;
  name: string;
  startDate: Date;
  endDate: Date;
  client: ClientEntity;
  categories: CategoryEntity[];
}
