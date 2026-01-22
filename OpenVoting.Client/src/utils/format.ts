export function pollStatusLabel(status: number) {
  switch (status) {
    case 0:
      return 'Draft';
    case 1:
      return 'Submissions open';
    case 2:
      return 'Voting open';
    case 3:
      return 'Closed';
    case 4:
      return 'Cancelled';
    case 5:
      return 'Review';
    default:
      return `Unknown (${status})`;
  }
}

export function votingMethodLabel(method: number) {
  switch (method) {
    case 1:
      return 'Approval';
    case 2:
      return 'Instant Runoff (IRV)';
    default:
      return `Unknown (${method})`;
  }
}

export function toLocal(iso: string) {
  const d = new Date(iso);
  const offsetMs = d.getTimezoneOffset() * 60 * 1000;
  return new Date(d.getTime() - offsetMs).toISOString().slice(0, 16);
}

export function fromLocal(local: string) {
  return new Date(local).toISOString();
}

export function isMaxTimestamp(iso?: string | null) {
  if (!iso) return false;
  return iso.startsWith('9999-12-31');
}

export function formatWindow(openIso: string, closeIso: string) {
  const open = new Date(openIso).toLocaleString();
  if (isMaxTimestamp(closeIso)) {
    return `${open} → No auto close`;
  }
  return `${open} → ${new Date(closeIso).toLocaleString()}`;
}

export function shortId(id: string) {
  return id.length > 8 ? `${id.slice(0, 4)}…${id.slice(-4)}` : id;
}
