/* eslint-disable @typescript-eslint/no-empty-interface */
import { RequestHandler } from 'express';

export namespace Scrapper {
  export interface FullAppointment {
    Worksheet: null;
    Require: null;
    Evaluate: null;
    TotalRows: number;
    PageSize: number;
    Table: null;
    Id: number;
    IdRequire: null;
    IdCustomer: number;
    CustomerName: null;
    IdProject: number;
    ProjectName: null;
    StartDate: null;
    EndDate: null;
    IdCell: number;
    CellName: null;
    IdCategory: number;
    IdManager: number;
    IdDeveloper: number;
    IsMaster: boolean;
    IdAncestor: number;
    DeveloperName: null;
    HourValue: null;
    ExtraValue: null;
    CategoryName: null;
    InformedDate: string;
    Created: null;
    StartTime: string;
    EndTime: string;
    TotalTime: null;
    NotMonetize: boolean;
    Description: string;
    CommitRepository: string | null;
    IsDeleted: boolean;
    TotalTimeInProject: null;
    ConsumedTimeInProject: null;
    IdEvaluate: null;
    IsApprove: null;
    IsReprove: null;
    IsReview: null;
    IsWait: null;
    IsPreApproved: null;
    TimePreApproved: null;
    UserPreApproved: null;
    IsPaid: boolean;
    ConsumedTimeInProjectExceded: boolean;
    TimeInWorksheetExceded: number;
    IsEvaluate: boolean;
    TypeReport: null;
    SumTotalTime: null;
    TotaltimeInMinutes: number;
    IdCustomerPreSelected: null;
    IdProjectPreSelected: null;
    IdDeveloperPreSelected: null;
    IsEvaluatePreSelected: boolean;
  }

  export interface Appointment {
    id: string;
    cliente: string;
    projeto: string;
    categoria: string;
    data: string;
    horaInicial: string;
    horaFinal: string;
    descricao: string;
    naoContabilizado: boolean;
    avaliacao: string;
    commit: string;
  }

  export interface Client {
    id: string;
    title: string;
  }

  export interface Project {
    Id: number;
    Name: string;
    StartDate: string;
    EndDate: string;
    IdCustomer: number;
  }

  export interface Category {
    Id: number;
    Name: string;
    IdProject: number;
  }

  export interface ProjectProgress {
    Id: number;
    IdCell: null;
    CellName: null;
    IdCustomer: number;
    CustomerName: string;
    IdProject: number;
    ProjectName: string;
    IsMaintenance: boolean;
    HourLimitPerMonth: null;
    Budget: number;
    NotMonetize: boolean;
    StartDate: string;
    EndDate: string;
    TotalTime: string;
    TotalTimeMounth: string;
    TotalTimeInProject: string;
    ConsumedTimeInProject: string;
  }

  export interface Params {}

  export interface Request {
    login: string;
    password: string;
    token: string;
  }

  export type Response =
    | {
        message: string;
        error?: never;
      }
    | {
        message?: never;
        error: string;
      };

  export type Handler = RequestHandler<Params, Response, Request>;
}

export namespace AuthVerify {
  export interface Params {}

  export interface Request {
    login: string;
    password: string;
  }

  export type Response =
    | {
        authenticationIsValid: true;
      }
    | {
        authenticationIsValid: false;
        error: string;
      };

  export type Handler = RequestHandler<Params, Response, Request>;
}

export namespace SaveAppointments {
  export interface Params {}

  export interface CreatedAppointment {
    appointment: SaveAppointments.Appointment;
    saved: boolean;
    message: string;
  }

  export interface Appointment {
    client: string;
    project: string;
    category: string;
    description: string;
    date: string;
    commit?: string;
    notMonetize: boolean;
    startTime: string;
    endTime: string;
  }

  export interface Request {
    login: string;
    password: string;
    appointments: Appointment[];
  }

  export type Response =
    | {
        message: string;
        error?: never;
      }
    | {
        message?: never;
        error: CreatedAppointment | string;
      };

  export type Handler = RequestHandler<Params, Response, Request>;
}
