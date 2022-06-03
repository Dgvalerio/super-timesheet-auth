import { UserEntity } from '@/utils/user.dto';

export interface AuthInput {
  email: UserEntity['email'];
  password: UserEntity['password'];
}

export interface AuthOutput {
  user: UserEntity;
  token: string;
}
