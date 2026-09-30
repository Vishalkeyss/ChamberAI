import type { Context } from 'hono';
import type { Env } from './env';

export type AppEnv = Env;

export interface ChamberContextData {
  id: string;
  name: string;
  subdomain?: string | null;
  custom_domain?: string | null;
  status: string;
}

export interface UserContextData {
  id: string;
  email: string;
  highest_role: string;
  chamber_id: string;
}

export interface AppVariables {
  requestId: string;
  chamberId?: string;
  chamber?: ChamberContextData;
  isPlatformScope?: boolean;
  user?: UserContextData;
  roles?: string[];
  sessionToken?: string;
  session?: any;
}

export type AppContext = Context<{ Bindings: Env; Variables: AppVariables }>;

