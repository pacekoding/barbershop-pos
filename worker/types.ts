export type Role = 'owner' | 'cashier'

export interface AppUser {
  id: number
  email: string
  name: string
  role: Role
  active: boolean
  createdAt: string
  updatedAt: string
}

export interface AppEnv {
  DB: D1Database
  TEAM_DOMAIN: string
  POLICY_AUD: string
  OWNER_EMAIL: string
  ENVIRONMENT?: 'development' | 'production' | 'test'
  LOCAL_DEV_AUTH?: string
  DEV_AUTH_SECRET?: string
  DEV_AUTH_EMAIL?: string
}

export interface AccessIdentity {
  email: string
  subject: string
}

