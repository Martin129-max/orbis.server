export function webUrl() {
  return (process.env.WEB_URL ?? 'http://localhost:3000').replace(/\/+$/, '');
}
