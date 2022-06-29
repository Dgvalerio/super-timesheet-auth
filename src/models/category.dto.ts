export interface CategoryEntity {
  id: string;
  code?: string;
  name: string;
}

export interface CreateCategoryInput {
  code?: CategoryEntity['code'];
  name: CategoryEntity['name'];
}
