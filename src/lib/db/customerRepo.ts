import { supabase } from '../supabaseClient';

// Read-only customer lookup for the staff/admin order screens.
//
// An order row only carries a customer name and email; the account details live
// on `profiles`. This resolves them on demand for the order the operator is
// already looking at — there is deliberately no customer directory, so nothing
// loads every account up front.

export interface CustomerProfileDto {
  id: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  profileImageUrl: string | null;
  active: boolean;
  suspended: boolean;
  createdAt: string;
}

type ProfileRow = {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  profile_image_path: string | null;
  active: boolean | null;
  suspended: boolean | null;
  created_at: string;
};

const PROFILE_COLUMNS =
  'id, full_name, email, phone, address, profile_image_path, active, suspended, created_at';

// Pictures uploaded by this build are stored as a public URL; older rows can
// still hold a bare storage path.
function resolveAvatar(value: string | null): string | null {
  if (!value) return null;
  if (/^(https?:\/\/|data:)/i.test(value)) return value;
  const { data } = supabase.storage.from('profile-images').getPublicUrl(value);
  return data.publicUrl;
}

function toDto(row: ProfileRow): CustomerProfileDto {
  return {
    id: row.id,
    fullName: row.full_name?.trim() || row.email || 'Customer',
    email: row.email,
    phone: row.phone,
    address: row.address,
    profileImageUrl: resolveAvatar(row.profile_image_path),
    active: row.active !== false,
    suspended: row.suspended === true,
    createdAt: row.created_at,
  };
}

/**
 * Look up the account behind an order's email.
 *
 * Returns null when no profile matches OR the caller may not read it. The
 * caller then shows what the order itself records instead of claiming the
 * customer does not exist — an RLS refusal and a missing row are not
 * distinguishable from here.
 */
export async function fetchCustomerProfileByEmail(
  email: string,
): Promise<CustomerProfileDto | null> {
  const typed = (email ?? '').trim();
  if (!typed) return null;

  // Auth stores addresses lowercased, but a profile row could predate that.
  // Two equality reads beat a `like` pattern, which would treat a `_` or `%`
  // inside the address as a wildcard.
  const candidates = Array.from(new Set([typed.toLowerCase(), typed]));
  for (const candidate of candidates) {
    const { data, error } = await supabase
      .from('profiles')
      .select(PROFILE_COLUMNS)
      .eq('email', candidate)
      .maybeSingle();
    if (error) {
      console.warn('[db:customer.profile]', error);
      return null;
    }
    if (data) return toDto(data as unknown as ProfileRow);
  }
  return null;
}
