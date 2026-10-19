/** Australian mobile or landline; spaces, dashes, dots and brackets are ignored. */
export function isValidPhone(phone) {
  if (!phone || phone.trim() === '') return true;
  const digits = phone.replace(/[\s\-().]/g, '');
  return /^(?:\+61|0)[2-478]\d{8}$/.test(digits) || /^1[38]00\d{6}$/.test(digits) || /^13\d{4}$/.test(digits);
}

export function isValidEmail(email) {
  if (!email || email.trim() === '') return true;
  return /^[^\s@]+@[^\s@]+\.[A-Za-z]{2,}$/.test(email.trim());
}
