import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const beginTransaction = vi.fn(async () => undefined);
  const commit = vi.fn(async () => undefined);
  const rollback = vi.fn(async () => undefined);
  const release = vi.fn(() => undefined);
  const query = vi.fn();
  const getConnection = vi.fn(async () => ({
    beginTransaction,
    commit,
    rollback,
    release,
    query,
  }));

  return {
    beginTransaction,
    commit,
    rollback,
    release,
    query,
    getConnection,
  };
});

vi.mock("crypto", () => ({
  randomUUID: () => "test-uuid",
}));

vi.mock("@/lib/db", () => ({
  db: {
    getConnection: mocks.getConnection,
  },
}));

vi.mock("next/server", () => ({
  NextResponse: {
    json: (body: unknown, init?: { status?: number }) => ({
      status: init?.status ?? 200,
      json: async () => body,
    }),
  },
}));

import { POST } from "./route";

describe("POST /api/transactions/add", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.query.mockImplementation(async (sql: string) => {
      if (sql.startsWith("SHOW COLUMNS FROM transactions")) {
        return [[{ Type: "enum('one_time','converted','subscription')" }]];
      }

      if (sql.includes("INSERT INTO installment_plans")) {
        return [{ insertId: 999 }];
      }

      return [{}];
    });
  });

  it("persists feesTotal and distributes amount_fee across installment schedule", async () => {
    const req = {
      json: async () => ({
        date: "2026-04-19",
        amount: 1000,
        categoryId: 1,
        methodId: "1",
        notes: "Laptop installment",
        isInstallment: true,
        installmentMonths: 3,
        interestTotal: 50,
        feesTotal: 100,
        isSubscription: false,
      }),
    };

    const response = await POST(req as any);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ success: true });
    expect(mocks.getConnection).toHaveBeenCalledTimes(1);

    const planInsertCall = mocks.query.mock.calls.find(
      ([sql]: [string]) => sql.includes("INSERT INTO installment_plans")
    );
    expect(planInsertCall).toBeTruthy();
    expect(planInsertCall?.[0]).toContain("fees_total");
    expect(planInsertCall?.[1]).toEqual([
      "test-uuid",
      1000,
      3,
      50,
      100,
      "2026-04",
    ]);

    const scheduleInsertCall = mocks.query.mock.calls.find(
      ([sql]: [string]) => sql.includes("INSERT INTO installment_schedule")
    );
    expect(scheduleInsertCall).toBeTruthy();
    expect(scheduleInsertCall?.[0]).toContain("amount_fee");

    const scheduleValues = scheduleInsertCall?.[1]?.[0] as Array<
      [number, string, number, number, number, string]
    >;
    expect(scheduleValues).toHaveLength(3);

    const feeParts = scheduleValues.map((row) => row[4]);
    expect(feeParts).toEqual([33, 33, 34]);
    expect(feeParts.reduce((sum, fee) => sum + fee, 0)).toBe(100);

    expect(mocks.commit).toHaveBeenCalledTimes(1);
    expect(mocks.rollback).not.toHaveBeenCalled();
    expect(mocks.release).toHaveBeenCalledTimes(1);
  });
});
