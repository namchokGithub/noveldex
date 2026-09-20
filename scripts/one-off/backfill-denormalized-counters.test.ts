import { describe, expect, it } from "vitest";
import {
  backfillDatabase,
  counterTargets,
  parseOptions,
  reconcileDocuments,
} from "./backfill-denormalized-counters";
import type { ReconciliationDocument } from "./backfill-denormalized-counters";

type TestDocument = {
  id: string;
  ref: {
    path: string;
    collection(name: string): { get(): Promise<TestQuerySnapshot> };
  };
  data(): Record<string, unknown>;
};

type TestQuerySnapshot = {
  docs: TestDocument[];
  size: number;
};

describe("counterTargets", () => {
  it("rebuilds exact counters from regular chapters and ignores stored counters and special entries", () => {
    const targets = counterTargets(
      [
        { id: "volume-1", chapter_count: 99, read_count: 98 },
        { id: "volume-2" },
      ],
      [
        { volume_id: "volume-1", kind: "chapter", read_at: null },
        {
          volume_id: "volume-1",
          kind: "chapter",
          read_at: new Date("2026-09-20T00:00:00Z"),
        },
        {
          volume_id: "volume-1",
          kind: "prologue",
          read_at: new Date("2026-09-20T00:00:00Z"),
        },
        {
          volume_id: "volume-1",
          read_at: new Date("2026-09-20T00:00:00Z"),
        },
        { volume_id: "volume-2", kind: "chapter" },
      ],
    );

    expect(targets).toEqual({
      novel: { volume_count: 2, chapter_count: 3, read_count: 1 },
      volumes: {
        "volume-1": { chapter_count: 2, read_count: 1 },
        "volume-2": { chapter_count: 1, read_count: 0 },
      },
    });
  });
});

describe("parseOptions", () => {
  it("requires exactly one mode and an explicit or environment project id", () => {
    expect(
      parseOptions(["--dry-run"], { FIREBASE_PROJECT_ID: "demo" }),
    ).toEqual({ mode: "dry-run", projectId: "demo" });
    expect(parseOptions(["--project", "demo", "--apply"], {})).toEqual({
      mode: "apply",
      projectId: "demo",
    });
    expect(() => parseOptions(["--project", "demo"], {})).toThrow(
      "Pass exactly one of --dry-run, --apply, or --verify.",
    );
    expect(() =>
      parseOptions(["--project", "demo", "--dry-run", "--verify"], {}),
    ).toThrow("Pass exactly one of --dry-run, --apply, or --verify.");
    expect(() => parseOptions(["--verify"], {})).toThrow(
      "Pass --project <id> or set FIREBASE_PROJECT_ID.",
    );
    expect(() =>
      parseOptions(["--project", "--verify"], {
        FIREBASE_PROJECT_ID: "must-not-mask-a-malformed-flag",
      }),
    ).toThrow("Pass --project <id> or set FIREBASE_PROJECT_ID.");
  });

  it.each([
    {
      values: ["--apply", "--apply", "--project", "demo"],
      message: "Pass exactly one of --dry-run, --apply, or --verify.",
    },
    {
      values: ["--project", "first", "--project", "second", "--verify"],
      message: "Pass --project <id> at most once.",
    },
    {
      values: ["--verify", "--project=demo"],
      message: "Unknown argument: --project=demo.",
    },
    {
      values: ["--verify", "--force"],
      message: "Unknown argument: --force.",
    },
  ])("rejects ambiguous CLI arguments: $values", ({ values, message }) => {
    expect(() => parseOptions(values, { FIREBASE_PROJECT_ID: "demo" })).toThrow(
      message,
    );
  });
});

describe("reconcileDocuments", () => {
  const documents: ReconciliationDocument[] = [
    {
      path: "novels/n1",
      actual: {
        volume_count: 9,
        chapter_count: 9,
        read_count: 9,
        counter_schema_version: 0,
      },
      target: {
        volume_count: 2,
        chapter_count: 3,
        read_count: 1,
        counter_schema_version: 1,
      },
    },
    {
      path: "novels/n1/volumes/v1",
      actual: {
        chapter_count: 2,
        read_count: 1,
        counter_schema_version: 1,
      },
      target: {
        chapter_count: 2,
        read_count: 1,
        counter_schema_version: 1,
      },
    },
  ];

  it.each(["dry-run", "verify"] as const)(
    "%s reports mismatches without writing",
    (mode) => {
      const writes: string[] = [];
      const output: string[] = [];

      const mismatches = reconcileDocuments(
        documents,
        mode,
        (document) => writes.push(document.path),
        (message) => output.push(message),
      );

      expect(mismatches).toBe(1);
      expect(writes).toEqual([]);
      expect(output).toEqual([
        'novels/n1: expected {"volume_count":2,"chapter_count":3,"read_count":1,"counter_schema_version":1}; actual {"volume_count":9,"chapter_count":9,"read_count":9,"counter_schema_version":0}',
      ]);
    },
  );

  it("apply writes absolute targets only for mismatched documents", () => {
    const writes: Array<{ path: string; target: Record<string, number> }> = [];

    const mismatches = reconcileDocuments(documents, "apply", (document) =>
      writes.push({ path: document.path, target: document.target }),
    );

    expect(mismatches).toBe(1);
    expect(writes).toEqual([
      {
        path: "novels/n1",
        target: {
          volume_count: 2,
          chapter_count: 3,
          read_count: 1,
          counter_schema_version: 1,
        },
      },
    ]);
  });
});

describe("backfillDatabase", () => {
  function databaseFixture(writeFailure?: "reject" | "throw") {
    const writes: Array<{
      path: string;
      target: Record<string, number>;
      options: { merge: boolean };
    }> = [];
    let writerCreations = 0;
    let writerCloses = 0;

    const chapterDocuments = [
      document("novels/n1/volumes/v1/chapters/c1", {
        kind: "chapter",
        read_at: null,
      }),
      document("novels/n1/volumes/v1/chapters/c2", {
        kind: "chapter",
        read_at: new Date("2026-09-20T00:00:00Z"),
      }),
      document("novels/n1/volumes/v1/chapters/p1", {
        kind: "prologue",
        read_at: new Date("2026-09-20T00:00:00Z"),
      }),
    ];
    const volumeDocuments = [
      document(
        "novels/n1/volumes/v1",
        { chapter_count: 10, read_count: 10 },
        { chapters: chapterDocuments },
      ),
    ];
    const novelDocuments = [
      document(
        "novels/n1",
        { volume_count: 10, chapter_count: 10, read_count: 10 },
        { volumes: volumeDocuments },
      ),
    ];
    const writableDocuments = [...novelDocuments, ...volumeDocuments];

    return {
      database: {
        collection: (name: string) =>
          collection(name === "novels" ? novelDocuments : []),
        bulkWriter: () => {
          writerCreations += 1;
          return {
            set: (
              reference: { path: string },
              target: Record<string, number>,
              options: { merge: boolean },
            ) => {
              if (writeFailure === "throw") throw new Error("write failed");
              writes.push({ path: reference.path, target, options });
              if (writeFailure === "reject") {
                return Promise.reject(new Error("write failed"));
              }
              const documentToUpdate = writableDocuments.find(
                (document) => document.ref.path === reference.path,
              );
              if (!documentToUpdate) {
                return Promise.reject(new Error("document not found"));
              }
              Object.assign(documentToUpdate.data(), target);
              return Promise.resolve();
            },
            close: async () => {
              writerCloses += 1;
            },
          };
        },
      },
      state: () => ({ writes, writerCreations, writerCloses }),
    };
  }

  function collection(documents: TestDocument[]): {
    get(): Promise<TestQuerySnapshot>;
  } {
    return { get: async () => ({ docs: documents, size: documents.length }) };
  }

  function document(
    path: string,
    data: Record<string, unknown>,
    children: Record<string, TestDocument[]> = {},
  ): TestDocument {
    return {
      id: path.split("/").at(-1)!,
      ref: {
        path,
        collection: (name: string) => collection(children[name] ?? []),
      },
      data: () => data,
    };
  }

  it.each(["dry-run", "verify"] as const)(
    "%s scans nested sources without creating a writer",
    async (mode) => {
      const fixture = databaseFixture();
      const output: string[] = [];

      const result = await backfillDatabase(fixture.database, mode, (message) =>
        output.push(message),
      );

      expect(result).toEqual({
        scanned: { novels: 1, volumes: 1, chapters: 3 },
        mismatches: 2,
        writes: 0,
      });
      expect(fixture.state()).toEqual({
        writes: [],
        writerCreations: 0,
        writerCloses: 0,
      });
      expect(output[0]).toBe("Scanned 1 novels, 1 volumes, and 3 chapters.");
      expect(output).toHaveLength(3);
    },
  );

  it("apply merges absolute counters and schema markers with BulkWriter", async () => {
    const fixture = databaseFixture();

    const result = await backfillDatabase(
      fixture.database,
      "apply",
      () => undefined,
    );

    expect(result).toEqual({
      scanned: { novels: 1, volumes: 1, chapters: 3 },
      mismatches: 2,
      writes: 2,
    });
    expect(fixture.state()).toEqual({
      writerCreations: 1,
      writerCloses: 1,
      writes: [
        {
          path: "novels/n1",
          target: {
            volume_count: 1,
            chapter_count: 2,
            read_count: 1,
            counter_schema_version: 1,
          },
          options: { merge: true },
        },
        {
          path: "novels/n1/volumes/v1",
          target: {
            chapter_count: 2,
            read_count: 1,
            counter_schema_version: 1,
          },
          options: { merge: true },
        },
      ],
    });
  });

  it("apply leaves the fixture verifiable and a repeated apply writes nothing", async () => {
    const fixture = databaseFixture();

    await expect(
      backfillDatabase(fixture.database, "apply", () => undefined),
    ).resolves.toMatchObject({ mismatches: 2, writes: 2 });
    await expect(
      backfillDatabase(fixture.database, "verify", () => undefined),
    ).resolves.toMatchObject({ mismatches: 0, writes: 0 });
    await expect(
      backfillDatabase(fixture.database, "apply", () => undefined),
    ).resolves.toMatchObject({ mismatches: 0, writes: 0 });
  });

  it.each(["reject", "throw"] as const)(
    "apply propagates a %s write failure and still closes BulkWriter",
    async (writeFailure) => {
      const fixture = databaseFixture(writeFailure);

      await expect(
        backfillDatabase(fixture.database, "apply", () => undefined),
      ).rejects.toThrow("write failed");
      expect(fixture.state().writerCloses).toBe(1);
    },
  );
});
