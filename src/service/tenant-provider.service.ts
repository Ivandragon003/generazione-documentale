import { Injectable } from "@nestjs/common";
import type { TenantInfo } from "../common/types/tenant.type";

export abstract class TenantProvider {
  abstract getTenants(): Promise<TenantInfo[]>;
  abstract getTenantByUuid(uuid: string): Promise<TenantInfo | null>;
}

const DEMO_TENANTS: TenantInfo[] = [
  {
    uuid: "11111111-1111-1111-1111-111111111111",
    name: "Tenant Demo A",
    description: "Static demo tenant for development",
  },
  {
    uuid: "22222222-2222-2222-2222-222222222222",
    name: "Tenant Demo B",
    description: "Static demo tenant for development",
  },
  {
    uuid: "33333333-3333-3333-3333-333333333333",
    name: "Tenant Demo C",
    description: "Static demo tenant for development",
  },
];

@Injectable()
export class DemoTenantProvider implements TenantProvider {
  async getTenants(): Promise<TenantInfo[]> {
    return DEMO_TENANTS;
  }

  async getTenantByUuid(uuid: string): Promise<TenantInfo | null> {
    return DEMO_TENANTS.find((tenant) => tenant.uuid === uuid) ?? null;
  }
}
