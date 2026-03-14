// src/utils/coPayment.js
export function getMinCoPayment(product) {
    // “multi-split” covers 6A–6G; but ducted 6A–6C & big non-ducted 6F/6G also $1000;
    // small non-ducted 6D/6E(i)/6E(ii) is $200.
    const type = product.productCategory;         // e.g. '6A','6E(ii)', etc
    const cap  = parseFloat(product.coolingCapacity) || 0;
    if (['6A','6B(i)','6B(ii)','6C','6D','6E(i)','6E(ii)','6F','6G'].includes(type)) {
      // multi-split catch-all
      return 1000;
    }
    // Fallback by more specific rules:
    if (['6A','6B(i)','6B(ii)','6C'].includes(type)) {
      return 1000;
    }
    if (['6F','6G'].includes(type) && cap >= 10) {
      return 1000;
    }
    if (['6D','6E(i)','6E(ii)'].includes(type) && cap < 10) {
      return 200;
    }
    return 0;  // default, should never really happen
  }
  