import { createClient } from "npm:@supabase/supabase-js@2";

const RETENTION_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_ORDERS_PER_RUN = 50;
const STORAGE_DELETE_CHUNK_SIZE = 100;
const TERMINAL_STATUSES = ["Canceled", "Released"] as const;

type OrderCandidate = {
  id: string;
  status: (typeof TERMINAL_STATUSES)[number];
  status_updated_at: string;
};

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

async function purgeOrder(
  supabase: ReturnType<typeof createClient>,
  order: OrderCandidate,
  cutoffIso: string,
): Promise<boolean> {
  // Re-check immediately before cleanup so an order changed after the candidate
  // query is not intentionally purged based on a stale snapshot.
  const currentResult = await supabase
    .from("orders")
    .select("id, status, status_updated_at")
    .eq("id", order.id)
    .in("status", [...TERMINAL_STATUSES])
    .lte("status_updated_at", cutoffIso)
    .maybeSingle();
  assertNoError(currentResult, `Re-check order ${order.id}`);
  if (!currentResult.data) return false;

  const [filesResult, paymentsResult] = await Promise.all([
    supabase.from("order_files").select("storage_path").eq("order_id", order.id),
    supabase.from("payments").select("proof_storage_path").eq("order_id", order.id),
  ]);
  assertNoError(filesResult, `Read attached files for order ${order.id}`);
  assertNoError(paymentsResult, `Read payment proofs for order ${order.id}`);

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
      .neq("order_id", order.id);
    assertNoError(sharedFilesResult, `Check shared file objects for order ${order.id}`);
    for (const row of (sharedFilesResult.data ?? []) as StoragePathRow[]) {
      if (row.storage_path) sharedFilePaths.add(row.storage_path);
    }
  }
  if (proofPaths.length > 0) {
    const sharedProofsResult = await supabase
      .from("payments")
      .select("proof_storage_path")
      .in("proof_storage_path", proofPaths)
      .neq("order_id", order.id);
    assertNoError(sharedProofsResult, `Check shared proof objects for order ${order.id}`);
    for (const row of (sharedProofsResult.data ?? []) as PaymentProofRow[]) {
      if (row.proof_storage_path) sharedProofPaths.add(row.proof_storage_path);
    }
  }

  // Keep the database record available for a retry if Storage refuses deletion.
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
      .eq("related_order_id", order.id),
    supabase
      .from("audit_logs")
      .update({ entity_id: null })
      .eq("entity_type", "Order")
      .eq("entity_id", order.id),
  ]);
  assertNoError(unlinkResult[0], `Unlink inventory history for order ${order.id}`);
  assertNoError(unlinkResult[1], `Unlink audit history for order ${order.id}`);

  const childDeletes = await Promise.all([
    supabase.from("order_files").delete().eq("order_id", order.id),
    supabase.from("payments").delete().eq("order_id", order.id),
    supabase.from("order_addons").delete().eq("order_id", order.id),
    supabase.from("order_cost_breakdowns").delete().eq("order_id", order.id),
    supabase.from("order_status_history").delete().eq("order_id", order.id),
    supabase.from("walk_in_transactions").delete().eq("order_id", order.id),
    supabase.from("notifications").delete().eq("related_order_id", order.id),
    supabase.from("order_locks").delete().eq("order_id", order.id),
  ]);
  for (const result of childDeletes) {
    assertNoError(result, `Delete dependent rows for order ${order.id}`);
  }

  const deleteResult = await supabase
    .from("orders")
    .delete()
    .eq("id", order.id)
    .in("status", [...TERMINAL_STATUSES])
    .lte("status_updated_at", cutoffIso)
    .select("id");
  assertNoError(deleteResult, `Delete order ${order.id}`);
  if (!deleteResult.data?.some((row: { id: string }) => row.id === order.id)) {
    throw new Error(
      `Order ${order.id} stopped matching the retention rule during cleanup; review its uploaded files.`,
    );
  }
  return true;
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

  const cutoff = new Date(Date.now() - RETENTION_MS);
  const cutoffIso = cutoff.toISOString();
  const candidatesResult = await supabase
    .from("orders")
    .select("id, status, status_updated_at")
    .in("status", [...TERMINAL_STATUSES])
    .lte("status_updated_at", cutoffIso)
    .order("status_updated_at", { ascending: true })
    .limit(MAX_ORDERS_PER_RUN);

  if (candidatesResult.error) {
    console.error("[order-retention] failed to find eligible orders", candidatesResult.error);
    return Response.json({ error: "Failed to query eligible orders" }, { status: 500 });
  }

  const candidates = (candidatesResult.data ?? []) as OrderCandidate[];
  const failures: { orderId: string; message: string }[] = [];
  let deleted = 0;

  for (const order of candidates) {
    try {
      if (await purgeOrder(supabase, order, cutoffIso)) deleted += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      failures.push({ orderId: order.id, message });
      console.error(`[order-retention] failed to purge order ${order.id}`, error);
    }
  }

  return Response.json({
    cutoff: cutoffIso,
    eligible: candidates.length,
    deleted,
    failures,
    batchLimit: MAX_ORDERS_PER_RUN,
  });
});
