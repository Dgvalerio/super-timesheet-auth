/* eslint-disable require-jsdoc */
import {
  AppointmentEntity,
  CreateAppointmentInput,
} from '@/utils/appointment.dto';
import { CategoryEntity, CreateCategoryInput } from '@/utils/category.dto';
import { ClientEntity, CreateClientInput } from '@/utils/client.dto';
import {
  AddCategoryInput,
  CreateProjectInput,
  ProjectEntity,
} from '@/utils/project.dto';
import { GetUserInput, UserEntity } from '@/utils/user.dto';

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

  async query<Return>(queryNode: DocumentNode) {
    return this.client.query<Return>({ query: queryNode });
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

  async createAppointment(input: CreateAppointmentInput) {
    const { data } = await this.mutation<{
      createAppointment: AppointmentEntity;
    }>(gql`
      mutation {
        createAppointment(input: {
          code: "${input.code}",
          date: "${input.date}",
          startTime: "${input.startTime}",
          endTime: "${input.endTime}",
          notMonetize: ${input.notMonetize},
          commit: "${input.commit}",
          status: ${input.status},
          userEmail: "${input.userEmail}",
          projectCode: "${input.projectCode}",
          categoryCode: "${input.categoryCode}",
          description: """
            ${input.description}
          """
        }) { id }
      }
    `);

    if (data) console.log('CreateAppointment: ', data.createAppointment);
  }

  async getUserEmail(input: GetUserInput) {
    const { data } = await this.query<{ getUser: UserEntity }>(gql`
      query {
        getUser(input: { id: "${input.id}" }) {
          id
          email
          name
        }
      }
    `);

    return data;
  }
}
