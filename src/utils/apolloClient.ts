/* eslint-disable require-jsdoc */
import { ClientEntity, CreateClientInput } from '@/utils/client.dto';
import { CreateProjectInput, ProjectEntity } from '@/utils/project.dto';

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
        }) {
          id
          code
          name
          projects {
            id
            code
            name
            startDate
            endDate
          }
        }
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
        }) {
          id
          code
          name
          startDate
          endDate
          client {
            id
            code
            name
          }
          categories {
            id
            code
            name
          }
        }
      }
    `);

    if (data) console.log('CreateProject: ', data.createProject);
  }
}
