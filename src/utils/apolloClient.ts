/* eslint-disable require-jsdoc */
import { CategoryEntity, CreateCategoryInput } from '@/utils/category.dto';
import { ClientEntity, CreateClientInput } from '@/utils/client.dto';
import {
  AddCategoryInput,
  CreateProjectInput,
  ProjectEntity,
} from '@/utils/project.dto';

import {
  ApolloClient,
  DocumentNode,
  HttpLink,
  InMemoryCache,
  NormalizedCacheObject,
  gql,
} from 'apollo-boost';
import fetch from 'cross-fetch';

export class ApolloClientHelper {
  client: ApolloClient<NormalizedCacheObject>;

  constructor(token: string) {
    this.client = new ApolloClient({
      link: new HttpLink({
        uri: 'http://localhost:3001/graphql',
        fetch,
        headers: {
          authorization: `Bearer ${token}`,
        },
      }),
      cache: new InMemoryCache(),
    });
  }

  async mutation<Return>(mutationNode: DocumentNode) {
    return this.client.mutate<Return>({ mutation: mutationNode });
  }

  async createClient(input: CreateClientInput) {
    const { data } = await this.mutation<{ createClient: ClientEntity }>(gql`
      mutation {
        createClient(input: {
          code: "${input.code}"
          name: "${input.name}"
        }) { id }
      }
    `);

    if (data) console.log('CreateClient: ', data.createClient);
  }

  async createProject(input: CreateProjectInput) {
    const { data } = await this.mutation<{ createProject: ProjectEntity }>(gql`
      mutation {
        createProject(input: {
          code: "${input.code}"
          name: "${input.name}"
          startDate: "${input.startDate}"
          endDate: "${input.endDate}"
          clientCode: "${input.clientCode}"
        }) { id }
      }
    `);

    if (data) console.log('CreateProject: ', data.createProject);
  }

  async createCategory(input: CreateCategoryInput) {
    const { data } = await this.mutation<{
      createCategory: CategoryEntity;
    }>(gql`
      mutation {
        createCategory(input: {
          code: "${input.code}"
          name: "${input.name}"
        }) { id }
      }
    `);

    if (data) console.log('CreateCategory: ', data.createCategory);
  }

  async addCategoryToProject(input: AddCategoryInput) {
    const { data } = await this.mutation<{
      addCategory: ProjectEntity;
    }>(gql`
      mutation {
        addCategory(input: {
          projectCode: "${input.projectCode}"
          categoryCode: "${input.categoryCode}"
        }) { id }
      }
    `);

    if (data) console.log('AddCategoryInput: ', data.addCategory);
  }
}
