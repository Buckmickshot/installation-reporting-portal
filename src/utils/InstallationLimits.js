// utils/InstallationLimits.js

/* ================= CONSTANTS ================= */

const BASE = {
  ducted:    { residential: 1, business: 2 },
  nonDucted: { residential: 3, business: 3 },
};

const MAX_CAP = {
  ducted:    { residential: 1, business: 5 },
  nonDucted: { residential: 5, business: 10 },
};

const sideOf = t => (t === 'residential' ? 'residential' : 'business');
const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;

/* ================= NORMALISERS ================= */

function normScenario(sc) { return String(sc ?? '').trim().toLowerCase(); }
function isHard(sc) { sc = normScenario(sc); return sc === 'i' || sc === 'ii'; }
function isXI(sc)   { return normScenario(sc) === 'xi'; }

function normCode(raw = '') { return String(raw).toUpperCase().replace(/\s+/g, ''); }

function getCategoryFromProductType(raw = '') {
  const code = normCode(raw);
  const ducted = ['6A','6B','6B(I)','6B(II)','6C'];
  const non    = ['6D','6E','6E(I)','6E(II)','6F','6G'];
  if (ducted.includes(code)) return 'ducted';
  if (non.includes(code))    return 'nonDucted';
  return 'unknown';
}

/* ================= COUNTERS ================= */

function countNew(formData) {
  const installed = Array.isArray(formData.installedProducts) ? formData.installedProducts : [];
  const decoms    = Array.isArray(formData.decommissionedProducts) ? formData.decommissionedProducts : [];

  const newDuctInst = installed.filter(p => getCategoryFromProductType(p.productCategory) === 'ducted').length;
  const newNonInst  = installed.filter(p => getCategoryFromProductType(p.productCategory) === 'nonDucted').length;

  let newNonXI = 0, newXI = 0, newHard = 0;
  for (const p of decoms) {
    const sc = normScenario(p?.decommissionScenario);
    if (!sc) continue;
    if (isHard(sc)) newHard += 1;
    if (isXI(sc)) newXI += 1;
    else newNonXI += 1; // i–x are NON‑XI
  }

  return {
    newDuctInst,
    newNonInst,
    newInstTotal: newDuctInst + newNonInst,
    newNonXI,
    newXI,
    newDecomTotal: newNonXI + newXI, // equality uses this (xi counts)
    newHard,
  };
}

/* ================= VALIDATOR ================= */

export function validateInstallationLimits(formData = {}) {
  const {
    premisesType,

    // Lifetime BEFORE this job
    ductedCount = 0,                 // installs
    nonDuctedCount = 0,              // installs
    ductedDecomCount = 0,            // lifetime NON‑XI for ducted
    nonDuctedDecomCount = 0,         // lifetime NON‑XI for non‑ducted

    // Lifetime (i)/(ii) already used (0 or 1)
    hardWiredLifetimeCount = 0,
  } = formData;

  const side = sideOf(premisesType);
  const isResidential = side === 'residential';

  const B = { ducted: BASE.ducted[side], non: BASE.nonDucted[side] };
  const M = { ducted: MAX_CAP.ducted[side], non: MAX_CAP.nonDucted[side] };

  const N = countNew(formData);

  // Lifetime installs AFTER this job
  const S = {
    ducted:    Number(ductedCount)    + N.newDuctInst,
    nonDucted: Number(nonDuctedCount) + N.newNonInst,
  };
  const S_total = S.ducted + S.nonDucted;

  // Lifetime NON‑XI BEFORE this job (per category)
  const histNonXI = {
    ducted:    Number(ductedDecomCount)    || 0,
    nonDucted: Number(nonDuctedDecomCount) || 0,
  };
  const histNonXI_total = histNonXI.ducted + histNonXI.nonDucted;

  const errors = [];

  /* R1: per‑job equality */
  if (N.newInstTotal !== N.newDecomTotal) {
    const diff = Math.abs(N.newInstTotal - N.newDecomTotal);
    if (N.newInstTotal > N.newDecomTotal) {
      errors.push(
        `This job: installs (${N.newInstTotal}) must equal decommissions (${N.newDecomTotal}). ` +
        `Add ${plural(diff,'decommission')} or remove ${plural(diff,'install')}.`
      );
    } else {
      errors.push(
        `This job: decommissions (${N.newDecomTotal}) must equal installs (${N.newInstTotal}). ` +
        `Add ${plural(diff,'install')} or remove ${plural(diff,'decommission')}.`
      );
    }
  }

  /* R2: (i)/(ii) lifetime ≤ 1 */
  const hardUsed = Number(hardWiredLifetimeCount || 0) + N.newHard;
  if (hardUsed > 1) {
    errors.push(`Scenarios (i)/(ii): only one allowed for the premises. Reduce or change ${hardUsed - 1}.`);
  }

  /* R3: install caps */
  if (S.ducted > M.ducted) {
    errors.push(`Ducted: too many installs. Limit ${M.ducted}. You have ${S.ducted}. Reduce by ${S.ducted - M.ducted}.`);
  }
  if (S.nonDucted > M.non) {
    errors.push(`Non‑ducted: too many installs. Limit ${M.non}. You have ${S.nonDucted}. Reduce by ${S.nonDucted - M.non}.`);
  }

  /* R4: Scenario split caps
     Default rule per category c (lifetime):
       NON‑XI ≤ (M_c − B_c)
       XI     ≤  B_c
     SPECIAL: Residential ducted → no split restriction.
              Only R1 and R3 apply (i.e., decom = installs and S.ducted ≤ 1).
  */
  const nonXI_max = {
    ducted:    Math.max(M.ducted - B.ducted, 0),
    nonDucted: Math.max(M.non    - B.non,    0),
  };
  const xi_max = {
    ducted:    B.ducted,
    nonDucted: B.non,
  };

  if (isResidential) {
    // Relax split for ducted
    nonXI_max.ducted = S.ducted; // allow allocating up to installs as non‑XI
    xi_max.ducted     = S.ducted; // and up to installs as XI
  }

  // Bounds for how many NON‑XI this job must/can add by category
  const xMin = {
    ducted:    Math.max(0, isResidential ? 0 : (S.ducted    - xi_max.ducted    - histNonXI.ducted)),
    nonDucted: Math.max(0,                  S.nonDucted - xi_max.nonDucted - histNonXI.nonDucted),
  };
  const xMax = {
    ducted:    Math.max(0, (isResidential ? S.ducted : nonXI_max.ducted) - histNonXI.ducted),
    nonDucted: Math.max(0,  nonXI_max.nonDucted                         - histNonXI.nonDucted),
  };

  const sumMin = xMin.ducted + xMin.nonDucted;
  const sumMax = xMax.ducted + xMax.nonDucted;

  // Lifetime totals after this job
  const nonXI_total_after = histNonXI_total + N.newNonXI;
  const xi_total_after    = S_total - nonXI_total_after;

  // Global maxima sums
  const nonXI_max_sum = nonXI_max.ducted + nonXI_max.nonDucted;
  const xi_max_sum    = xi_max.ducted    + xi_max.nonDucted;

  // Global checks
  if (nonXI_total_after > nonXI_max_sum) {
    const over = nonXI_total_after - nonXI_max_sum;
    errors.push(
      `Too many non‑XI decommissions in total. Maximum allowed is ${nonXI_max_sum}; you have ${nonXI_total_after}. ` +
      `Reduce ${plural(over,'non‑XI decommission')} or reclassify to XI.`
    );
  }
  if (xi_total_after > xi_max_sum) {
    const over = xi_total_after - xi_max_sum;
    errors.push(
      `Too many XI decommissions in total. Maximum allowed is ${xi_max_sum}; you have ${xi_total_after}. ` +
      `Convert ${plural(over,'XI decommission')} to non‑XI or reduce installs.`
    );
  }

  // Feasibility against per‑category bounds
  if (N.newNonXI < sumMin) {
    const short = sumMin - N.newNonXI;
    errors.push(
      `Non‑XI decommissions are short by ${short} to respect XI caps. ` +
      `Add ${plural(short,'non‑XI decommission')}.`
    );
  } else if (N.newNonXI > sumMax) {
    const over = N.newNonXI - sumMax;
    errors.push(
      `Too many non‑XI decommissions for category caps. Reduce ${plural(over,'non‑XI decommission')} or make them XI.`
    );
  }

  // Historical exceed checks
  if (!isResidential && histNonXI.ducted > nonXI_max.ducted) {
    const over = histNonXI.ducted - nonXI_max.ducted;
    errors.push(
      `Ducted: historical non‑XI exceed maximum by ${over}. Allowed ≤ ${nonXI_max.ducted}. ` +
      `Reduce recorded ducted non‑XI or add installs within caps.`
    );
  }
  if (histNonXI.nonDucted > nonXI_max.nonDucted) {
    const over = histNonXI.nonDucted - nonXI_max.nonDucted;
    errors.push(
      `Non‑ducted: historical non‑XI exceed maximum by ${over}. Allowed ≤ ${nonXI_max.nonDucted}. ` +
      `Reduce recorded non‑ducted non‑XI or add installs within caps.`
    );
  }

  return errors.length ? errors : null;
}

/* ================= REMAINING / GUIDANCE ================= */

export function getRemaining(formData = {}) {
  const side = sideOf(formData.premisesType);
  const isResidential = side === 'residential';

  const B = { ducted: BASE.ducted[side], non: BASE.nonDucted[side] };
  const M = { ducted: MAX_CAP.ducted[side], non: MAX_CAP.nonDucted[side] };

  const histNonXI = {
    ducted:    Number(formData.ductedDecomCount || 0),
    nonDucted: Number(formData.nonDuctedDecomCount || 0),
  };

  const ductedCount    = Number(formData.ductedCount || 0);
  const nonDuctedCount = Number(formData.nonDuctedCount || 0);

  const N = countNew(formData);

  const S = {
    ducted:    ductedCount    + N.newDuctInst,
    nonDucted: nonDuctedCount + N.newNonInst,
  };

  const installsRemaining = {
    ducted:    Math.max(M.ducted - S.ducted, 0),
    nonDucted: Math.max(M.non    - S.nonDucted, 0),
  };

  const nonXI_max = {
    ducted:    Math.max(M.ducted - B.ducted, 0),
    nonDucted: Math.max(M.non    - B.non,    0),
  };
  const xi_max = {
    ducted:    B.ducted,
    nonDucted: B.non,
  };

  if (isResidential) {
    nonXI_max.ducted = S.ducted;
    xi_max.ducted     = S.ducted;
  }

  const xMin = {
    ducted:    Math.max(0, isResidential ? 0 : (S.ducted    - xi_max.ducted    - histNonXI.ducted)),
    nonDucted: Math.max(0,                  S.nonDucted - xi_max.nonDucted - histNonXI.nonDucted),
  };
  const xMax = {
    ducted:    Math.max(0, (isResidential ? S.ducted : nonXI_max.ducted) - histNonXI.ducted),
    nonDucted: Math.max(0,  nonXI_max.nonDucted                         - histNonXI.nonDucted),
  };

  const sumMin = xMin.ducted + xMin.nonDucted;
  const sumMax = xMax.ducted + xMax.nonDucted;

  const neededThisJob = Math.max(0, sumMin - N.newNonXI);
  const extraAllowed  = Math.max(0, sumMax - N.newNonXI);

  return {
    installsRemaining,
    pairsRemaining: installsRemaining.ducted + installsRemaining.nonDucted,
    nonXI: {
      neededThisJob,
      extraAllowed,
      minThisJob: xMin,
      maxThisJob: xMax,
      perCatMaxLifetime: nonXI_max,
      perCatXiMaxLifetime: xi_max,
    },
    equalityOkThisJob: N.newInstTotal === N.newDecomTotal,
    hardWiredRemaining: Math.max(1 - ((Number(formData.hardWiredLifetimeCount) || 0) + N.newHard), 0),
  };
}
