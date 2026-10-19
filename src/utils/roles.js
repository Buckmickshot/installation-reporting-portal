// One place for "who can do what" in the UI. The database enforces the same rules (RLS + RPC checks).
export const roleOf = p =>
  !p ? null : p.is_global_admin ? 'global_admin' : p.is_admin ? 'admin' : p.is_worker ? 'worker' : 'staff';

export const ROLE_LABEL = { global_admin: 'Global admin', admin: 'Admin', staff: 'Staff', worker: 'Worker' };

/** Statuses after which the official form is final and workers may download it. */
export const FINAL_STATUSES = ['submitted', 'approved', 'paid'];

export function permissions(profile) {
  const role = roleOf(profile);
  const admin = role === 'admin' || role === 'global_admin';
  const worker = role === 'worker';
  return {
    role,
    isAdmin: admin,
    isGlobal: role === 'global_admin',
    isWorker: worker,
    createJobs: !worker,
    editJobForm: !worker,
    changeStatus: !worker,
    allocate: admin,
    manageTeam: admin,
    viewAudit: admin,
    /** may this person download the rebate form for a job in this status? */
    downloadForm: status => !worker || FINAL_STATUSES.includes(status),
  };
}
