import { createContext } from 'react';

type ContextType = {
  email: string;
  setEmail: (v: string) => void;
  firstName: string;
  setFirstName: (v: string) => void;
  lastName: string;
  setLastName: (v: string) => void;
  avatarUrl: string;
  setAvatarUrl: (v: string) => void;
  emailConfirmed: boolean;
  setEmailConfirmed: (v: boolean) => void;
};

export const AuthContext = createContext<ContextType>({
  email: '',
  emailConfirmed: false,
  firstName: '',
  lastName: '',
  avatarUrl: '/empty_avatar.png',
  setEmail: (value: string) => {},
  setEmailConfirmed: (value: boolean) => {},
  setFirstName: (value: string) => {},
  setLastName: (value: string) => {},
  setAvatarUrl: (value: string) => {},
});
