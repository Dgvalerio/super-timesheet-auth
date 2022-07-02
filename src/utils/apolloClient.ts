/* eslint-disable require-jsdoc */
import {
  AppointmentEntity,
  CreateAppointmentInput,
} from '@/models/appointment.dto';
import {
  AzureInfosEntity,
  UpdateAzureInfosInput,
} from '@/models/azure-infos.dto';
import { CategoryEntity, CreateCategoryInput } from '@/models/category.dto';
import { ClientEntity, CreateClientInput } from '@/models/client.dto';
import {
  AddCategoryInput,
  CreateProjectInput,
  ProjectEntity,
} from '@/models/project.dto';
import { AddProjectInput, GetUserInput, UserEntity } from '@/models/user.dto';
import { log } from '@/utils/logs';

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
        uri: process.env.API_URL,
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

  // Client
  async createClient(input: CreateClientInput) {
    let alreadyExists = false;

    try {
      const { data } = await this.query<{ getClient: ClientEntity }>(gql`
        query {
          getClient(input: {
            code: "${input.code}"
          }) { id }
        }
      `);

      if (data.getClient) alreadyExists = true;
    } catch (e) {}

    if (alreadyExists) return log('This client already exists.');

    const { data } = await this.mutation<{ createClient: ClientEntity }>(gql`
      mutation {
        createClient(input: {
          code: "${input.code}"
          name: "${input.name}"
        }) { id }
      }
    `);

    if (data) log('Client created successfully!');
  }

  // Project
  async createProject(input: CreateProjectInput) {
    let alreadyExists = false;

    try {
      const { data } = await this.query<{ getProject: ProjectEntity }>(gql`
        query {
          getProject(input: {
            code: "${input.code}"
          }) { id }
        }
      `);

      if (data.getProject) alreadyExists = true;
    } catch (e) {}

    if (alreadyExists) return log('This project already exists.');

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

    if (data) log('Project created successfully!');
  }

  async addCategoryToProject(input: AddCategoryInput) {
    let alreadyExists = false;

    try {
      const { data } = await this.query<{ getProject: ProjectEntity }>(gql`
        query {
          getProject(input: {
            code: "${input.projectCode}"
          }) { id }
        }
      `);

      if (
        data.getProject.categories.find(
          ({ code }) => code === input.categoryCode
        )
      )
        alreadyExists = true;
    } catch (e) {}

    if (alreadyExists) return log('Category already added to project');

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

    if (data) log('Category added to project successfully!');
  }

  // User
  async addProjectToUser(input: AddProjectInput) {
    let alreadyExists = false;

    try {
      const { data } = await this.query<{ getUser: UserEntity }>(gql`
        query {
          getUser(input: {
            email: "${input.userEmail}"
          }) { id }
        }
      `);

      if (data.getUser.projects.find(({ code }) => code === input.projectCode))
        alreadyExists = true;
    } catch (e) {}

    if (alreadyExists) return log('Project already added to user');

    const { data } = await this.mutation<{ addProject: UserEntity }>(gql`
      mutation {
        addProject(input: {
          userEmail: "${input.userEmail}"
          projectCode: "${input.projectCode}"
        }) { id }
      }
    `);

    if (data) log('Project added to user successfully!');
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

  // Category
  async createCategory(input: CreateCategoryInput) {
    let alreadyExists = false;

    try {
      const { data } = await this.query<{ getCategory: ProjectEntity }>(gql`
        query {
          getCategory(input: {
            code: "${input.code}"
          }) { id }
        }
      `);

      if (data.getCategory) alreadyExists = true;
    } catch (e) {}

    if (alreadyExists) return log('This category already exists.');

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

    if (data) log('Category created successfully!');
  }

  // Appointment
  async createAppointment(input: CreateAppointmentInput) {
    let alreadyExists = false;

    try {
      const { data } = await this.query<{
        getAppointment: AppointmentEntity;
      }>(gql`
        query {
          getAppointment(input: {
            code: "${input.code}"
          }) { id }
        }
      `);

      if (data.getAppointment) alreadyExists = true;
    } catch (e) {}

    if (alreadyExists) return log('This appointment already exists.');

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
          projectCode: "${input.projectCode}",
          categoryCode: "${input.categoryCode}",
          description: """
          ${input.description}
          """
        }) { id }
      }
    `);

    if (data) log('Appointment created successfully!');
  }

  // Azure Infos
  async updateAzureInfosCurrentMonthWorkedTime(
    input: Pick<UpdateAzureInfosInput, 'login' | 'currentMonthWorkedTime'>
  ) {
    const {
      data: {
        getAzureInfos: { id },
      },
    } = await this.query<{
      getAzureInfos: AzureInfosEntity;
    }>(gql`
      query {
        getAzureInfos {
          id
        }
      }
    `);

    const { data } = await this.mutation<{
      updateAzureInfos: AzureInfosEntity;
    }>(gql`
      mutation {
        updateAzureInfos(input: {
          id: "${id}"
          currentMonthWorkedTime: "${input.currentMonthWorkedTime}"
        }) { id }
      }
    `);

    if (data) log('Update current month worked time successfully!');
  }
}
