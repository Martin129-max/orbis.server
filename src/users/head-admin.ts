export function isHeadAdmin(email: string) {
  const headAdmin = process.env.HEAD_ADMIN?.trim().toLowerCase();
  return Boolean(headAdmin) && email.toLowerCase() === headAdmin;
}
