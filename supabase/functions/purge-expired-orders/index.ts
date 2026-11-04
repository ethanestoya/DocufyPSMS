import { createClient } from "npm:@supabase/supabase-js@2";

const MAX_ORDERS_PER_RUN = 50;
const STORAGE_DELETE_CHUNK_SIZE = 100;
const TERMINAL_STATUSES = ["Canceled", "Released"] as const;

type RetentionJob = {
  order_id: string;
  terminal_status: (typeof TERMINAL_STATUSES)[number];
};

type OrderStatusRow = { status: string };
type StoragePathRow = { storage_path: string | null };
type PaymentProofRow = { proof_storage_path: string | null };

function requireEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

async function matchesSecret(expected: string, supplied: string | null): Promise<boolean> {
  if (!supplied) return false;
  const encoder = new TextEncoder();
  const [expectedHash, suppliedHash] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(expected)),
    crypto.subtle.digest("SHA-256", encoder.encode(supplied)),
  ]);
  const expectedBytes = new Uint8Array(expectedHash);
  const suppliedBytes = new Uint8Array(suppliedHash);
  let difference = 0;
  for (let index = 0; index < expectedBytes.length; index += 1) {
    difference |= expectedBytes[index] ^ suppliedBytes[index];
  }
  return difference === 0;
}

function assertNoError<T extends { error: { message: string } | null }>(
  result: T,
  operation: string,
): void {
  if (result.error) {
    throw new Error(`${operation}: ${result.error.message}`);
  }
}

async function removeStorageObjects(
  supabase: ReturnType<typeof createClient>,
  bucket: string,
  paths: string[],
): Promise<void> {
  const uniquePaths = [...new Set(paths.filter(Boolean))];
  for (let offset = 0; offset < uniquePaths.length; offset += STORAGE_DELETE_CHUNK_SIZE) {
    const chunk = uniquePaths.slice(offset, offset + STORAGE_DELETE_CHUNK_SIZE);
    const result = await supabase.storage.from(bucket).remove(chunk);
    if (result.error) {
      throw new Error(`Storage cleanup failed for ${bucket}: ${result.error.message}`);
    }
  }
}

async function deleteQueueJob(
  supabase: ReturnType<typeof createClient>,
  orderId: string,
): Promise<void> {
  const result = await supabase
    .from("order_retention_queue")
    .delete()
    .eq("order_id", orderId);
  assertNoError(result, `Delete retention queue entry for order ${orderId}`);
}

async function releaseQueueJob(
  supabase: ReturnType<typeof createClient>,
  orderId: string,
  message: string,
): Promise<void> {
  const result = await supabase.rpc("release_order_retention_job", {
    p_order_id: orderId,
    p_error: message,
  });
  assertNoError(result, `Release retention queue entry for order ${orderId}`);
}

async function purgeOrder(
  supabase: ReturnType<typeof createClient>,
  job: RetentionJob,
): Promise<"deleted" | "skipped"> {
  const currentResult = await supabase
    .from("orders")
    .select("status")
    .eq("id", job.order_id)
    .maybeSingle();
  assertNoError(currentResult, `Read order ${job.order_id}`);

  const currentOrder = currentResult.data as OrderStatusRow | null;
  if (
    currentOrder &&
    !TERMINAL_STATUSES.includes(currentOrder.status as RetentionJob["terminal_status"])
  ) {
    await deleteQueueJob(supabase, job.order_id);
    return "skipped";
  }

  const terminalStatus = currentOrder?.status ?? job.terminal_status;
  if (currentOrder && terminalStatus === "Released") {
    const snapshotResult = await supabase.rpc("capture_released_order_transaction", {
      p_order_id: job.order_id,
    });
    assertNoError(snapshotResult, `Refresh released transaction snapshot for order ${job.order_id}`);
  }

  const [filesResult, paymentsResult] = await Promise.all([
    supabase.from("order_files").select("storage_path").eq("order_id", job.order_id),
    supabase.from("payments").select("proof_storage_path").eq("order_id", job.order_id),
  ]);
  assertNoError(filesResult, `Read attached files for order ${job.order_id}`);
  assertNoError(paymentsResult, `Read payment proofs for order ${job.order_id}`);

  const filePaths = ((filesResult.data ?? []) as StoragePathRow[])
    .map((row) => row.storage_path)
    .filter((path): path is string => Boolean(path));
  const proofPaths = ((paymentsResult.data ?? []) as PaymentProofRow[])
    .map((row) => row.proof_storage_path)
    .filter((path): path is string => Boolean(path));

  const sharedFilePaths = new Set<string>();
  const sharedProofPaths = new Set<string>();
  if (filePaths.length > 0) {
    const sharedFilesResult = await supabase
      .from("order_files")
      .select("storage_path")
      .in("storage_path", filePaths)
      .neq("order_id", job.order_id);
    assertNoError(sharedFilesResult, `Check shared file objects for order ${job.order_id}`);
    for (const row of (sharedFilesResult.data ?? []) as StoragePathRow[]) {
      if (row.storage_path) sharedFilePaths.add(row.storage_path);
    }
  }
  if (proofPaths.length > 0) {
    const sharedProofsResult = await supabase
      .from("payments")
      .select("proof_storage_path")
      .in("proof_storage_path", proofPaths)
      .neq("order_id", job.order_id);
    assertNoError(sharedProofsResult, `Check shared proof objects for order ${job.order_id}`);
    for (const row of (sharedProofsResult.data ?? []) as PaymentProofRow[]) {
      if (row.proof_storage_path) sharedProofPaths.add(row.proof_storage_path);
    }
  }

  await Promise.all([
    removeStorageObjects(
      supabase,
      "order-files",
      filePaths.filter((path) => !sharedFilePaths.has(path)),
    ),
    removeStorageObjects(
      supabase,
      "payment-proofs",
      proofPaths.filter((path) => !sharedProofPaths.has(path)),
    ),
  ]);

  const unlinkResult = await Promise.all([
    supabase
      .from("inventory_movements")
      .update({ related_order_id: null })
      .eq("related_order_id", job.order_id),
    supabase
      .from("audit_logs")
      .update({ entity_id: null })
      .eq("entity_type", "Order")
      .eq("entity_id", job.order_id),
  ]);
  assertNoError(unlinkResult[0], `Unlink inventory history for order ${job.order_id}`);
  assertNoError(unlinkResult[1], `Unlink audit history for order ${job.order_id}`);

  const childDeletes = await Promise.all([
    supabase.from("order_files").delete().eq("order_id", job.order_id),
    supabase.from("payments").delete().eq("order_id", job.order_id),
    supabase.from("order_addons").delete().eq("order_id", job.order_id),
    supabase.from("order_cost_breakdowns").delete().eq("order_id", job.order_id),
    supabase.from("order_status_history").delete().eq("order_id", job.order_id),
    terminalStatus === "Released"
      ? supabase
          .from("walk_in_transactions")
          .update({ order_id: null })
          .eq("order_id", job.order_id)
      : supabase.from("walk_in_transactions").delete().eq("order_id", job.order_id),
    supabase.from("notifications").delete().eq("related_order_id", job.order_id),
    supabase.from("order_locks").delete().eq("order_id", job.order_id),
  ]);
  for (const result of childDeletes) {
    assertNoError(result, `Delete dependent data for order ${job.order_id}`);
  }

  if (currentOrder) {
    const deleteResult = await supabase
      .from("orders")
      .delete()
      .eq("id", job.order_id)
      .in("status", [...TERMINAL_STATUSES])
      .select("id");
    assertNoError(deleteResult, `Delete order ${job.order_id}`);
    if (!deleteResult.data?.some((row: { id: string }) => row.id === job.order_id)) {
      throw new Error(`Order ${job.order_id} changed while its data was being cleaned up.`);
    }
  }

  await deleteQueueJob(supabase, job.order_id);
  return "deleted";
}

Deno.serve(async (request) => {
  if (request.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  let supabase: ReturnType<typeof createClient>;
  try {
    const expectedSecret = requireEnv("ORDER_RETENTION_CRON_SECRET");
    const suppliedSecret = request.headers.get("x-order-retention-secret");
    if (!(await matchesSecret(expectedSecret, suppliedSecret))) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    supabase = createClient(
      requireEnv("SUPABASE_URL"),
      requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
      { auth: { autoRefreshToken: false, persistSession: false } },
    );
  } catch (error) {
    console.error("[order-retention] configuration error", error);
    return Response.json({ error: "Cleanup function is not configured" }, { status: 500 });
  }

  const claimResult = await supabase.rpc("claim_order_retention_jobs", {
    p_limit: MAX_ORDERS_PER_RUN,
  });
  if (claimResult.error) {
    console.error("[order-retention] failed to claim queued orders", claimResult.error);
    return Response.json({ error: "Failed to claim queued orders" }, { status: 500 });
  }

  const jobs = (claimResult.data ?? []) as RetentionJob[];
  const failures: { orderId: string; message: string }[] = [];
  let deleted = 0;
  let skipped = 0;

  for (const job of jobs) {
    try {
      const result = await purgeOrder(supabase, job);
      if (result === "deleted") deleted += 1;
      else skipped += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      failures.push({ orderId: job.order_id, message });
      console.error(`[order-retention] failed to purge order ${job.order_id}`, error);
      try {
        await releaseQueueJob(supabase, job.order_id, message);
      } catch (releaseError) {
        console.error(
          `[order-retention] failed to release retry lease for order ${job.order_id}`,
          releaseError,
        );
      }
    }
  }

  return Response.json({
    claimed: jobs.length,
    deleted,
    skipped,
    failures,
    batchLimit: MAX_ORDERS_PER_RUN,
  });
});
