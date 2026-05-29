import { DemoTenantProvider } from "../src/service/tenant-provider.service";

describe("DemoTenantProvider", () => {
  it("returns static demo tenants", async () => {
    const provider = new DemoTenantProvider();
    const tenants = await provider.getTenants();
    expect(tenants).toHaveLength(3);
    expect(tenants.map((tenant) => tenant.uuid)).toEqual([
      "11111111-1111-1111-1111-111111111111",
      "22222222-2222-2222-2222-222222222222",
      "33333333-3333-3333-3333-333333333333",
    ]);
  });

  it("returns a tenant by uuid", async () => {
    const provider = new DemoTenantProvider();
    const tenant = await provider.getTenantByUuid(
      "11111111-1111-1111-1111-111111111111",
    );
    expect(tenant?.name).toBe("Tenant Demo A");
  });
});
