const baseUrl = (process.env.API_BASE_URL || 'http://localhost:3000').replace(/\/$/, '');

async function main() {
  const response = await fetch(`${baseUrl}/api/dev/test-runs/execute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ suite: 'api-regression' }),
  });
  const body = await response.json();
  console.log(JSON.stringify(body, null, 2));
  if (!response.ok || body.ok !== true) process.exit(1);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
