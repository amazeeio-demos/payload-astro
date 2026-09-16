// `node lagoon/wait-for-http.mjs <url>`: exits 0 once the URL answers 2xx, 1
// after five minutes. Used by the post-rollout tasks; the Lagoon node images
// ship no curl, node's fetch is what they have.
const [url] = process.argv.slice(2)
if (!url) {
  console.error('Usage: node lagoon/wait-for-http.mjs <url>')
  process.exit(2)
}

for (let attempt = 1; attempt <= 60; attempt++) {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(4000) })
    if (response.ok) {
      console.log(`${url} answered after ${attempt} attempt(s).`)
      process.exit(0)
    }
  } catch {
    // Not up yet: connection refused, DNS not resolving, timeout.
  }
  await new Promise((resolve) => setTimeout(resolve, 5000))
}
console.error(`${url} did not answer within 5 minutes.`)
process.exit(1)
