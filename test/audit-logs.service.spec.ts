import { AuditLogsService } from "../src/service/audit-logs.service";

describe("AuditLogsService", () => {
  const save = jest.fn();
  const create = jest.fn((value) => value);
  const find = jest.fn();
  const deleteMock = jest.fn();
  const repository = {
    save,
    create,
    find,
    delete: deleteMock,
  };
  const service = new AuditLogsService(repository as never);

  beforeEach(() => {
    save.mockReset();
    create.mockClear();
    find.mockReset();
    deleteMock.mockReset();
  });

  it("persists audit log events", async () => {
    save.mockResolvedValue(undefined);

    await service.record({
      tenantUuid: "11111111-1111-1111-1111-111111111111",
      eventType: "template.updated",
      actor: "tester",
      templateId: "github:11111111-1111-1111-1111-111111111111/A/file",
      payload: { changed: true },
    });

    expect(save).toHaveBeenCalledTimes(1);
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        tenant_uuid: "11111111-1111-1111-1111-111111111111",
        event_type: "template.updated",
      }),
    );
  });

  it("validates mandatory fields", async () => {
    await expect(
      service.record({
        tenantUuid: "",
        eventType: "template.updated",
      }),
    ).rejects.toMatchObject({ status: 400 });
  });

  it("lists tenant events with normalized pagination", async () => {
    find.mockResolvedValue([]);
    await service.listByTenant(
      "11111111-1111-1111-1111-111111111111",
      undefined,
      999,
      -2,
    );
    expect(find).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenant_uuid: "11111111-1111-1111-1111-111111111111" },
        take: 200,
        skip: 0,
      }),
    );
  });

  it("applies normalized template filter when provided", async () => {
    find.mockResolvedValue([]);

    await service.listByTenant(
      "11111111-1111-1111-1111-111111111111",
      " github:template-1 ",
      20,
      2,
    );

    expect(find).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          tenant_uuid: "11111111-1111-1111-1111-111111111111",
          template_id: "github:template-1",
        },
        take: 20,
        skip: 2,
      }),
    );
  });

  it("deletes tenant audit logs older than retention", async () => {
    jest.useFakeTimers().setSystemTime(new Date("2026-05-21T00:00:00Z"));
    deleteMock.mockResolvedValue({ affected: 3 });

    const deleted = await service.cleanupRetention(180, {
      tenantUuid: "11111111-1111-1111-1111-111111111111",
    });

    expect(deleted).toBe(3);
    expect(deleteMock).toHaveBeenCalledWith(
      expect.objectContaining({
        tenant_uuid: "11111111-1111-1111-1111-111111111111",
        created_at: expect.any(Object),
      }),
    );
    jest.useRealTimers();
  });

  it("keeps recent audit logs by deleting only before the cutoff", async () => {
    jest.useFakeTimers().setSystemTime(new Date("2026-05-21T00:00:00Z"));
    deleteMock.mockResolvedValue({ affected: 0 });

    await service.cleanupRetention(180);

    const criteria = deleteMock.mock.calls[0][0] as {
      created_at: { value: Date };
    };
    expect(criteria.created_at.value.toISOString()).toBe(
      "2025-11-22T00:00:00.000Z",
    );
    jest.useRealTimers();
  });

  it("does not delete audit logs when retention is disabled", async () => {
    const deleted = await service.cleanupRetention(0);

    expect(deleted).toBe(0);
    expect(deleteMock).not.toHaveBeenCalled();
  });

  it("handles invalid retention safely without blocking main audit writes", async () => {
    deleteMock.mockRejectedValue(new Error("DB cleanup unavailable"));
    save.mockResolvedValue(undefined);

    await expect(service.cleanupRetentionSafe(180)).resolves.toBe(0);
    await service.recordSafe({
      tenantUuid: "11111111-1111-1111-1111-111111111111",
      eventType: "template.updated",
    });

    expect(save).toHaveBeenCalledTimes(1);
  });

  it("runs retention from the internal scheduler", async () => {
    jest.useFakeTimers().setSystemTime(new Date("2026-05-21T00:00:00Z"));
    deleteMock.mockResolvedValue({ affected: 1 });
    const scheduledService = new AuditLogsService(repository as never);

    jest.advanceTimersByTime(3600000);
    await Promise.resolve();
    await Promise.resolve();

    expect(deleteMock).toHaveBeenCalledWith(
      expect.objectContaining({
        created_at: expect.any(Object),
      }),
    );
    scheduledService.onModuleDestroy();
    jest.useRealTimers();
  });
});
