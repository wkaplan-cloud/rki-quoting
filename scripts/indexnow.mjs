// Submit public pages to IndexNow (Bing, Yandex, Seznam, Naver…) so new or
// changed pages are crawled within hours rather than weeks. Bing's index
// feeds ChatGPT search and Copilot.
//
//   node scripts/indexnow.mjs                 # every URL in the live sitemap
//   node scripts/indexnow.mjs /blog/some-post # just these paths
//
// The key file public/83530f6271d41e872aa4050adf33f979.txt must be live before submitting.

const HOST = 'www.quotinghub.co.za'
const KEY = '83530f6271d41e872aa4050adf33f979'

const paths = process.argv.slice(2)
let urlList
if (paths.length) {
  urlList = paths.map(p => `https://${HOST}${p.startsWith('/') ? p : '/' + p}`)
} else {
  const xml = await (await fetch(`https://${HOST}/sitemap.xml`)).text()
  urlList = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1])
}

const res = await fetch('https://api.indexnow.org/indexnow', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json; charset=utf-8' },
  body: JSON.stringify({ host: HOST, key: KEY, keyLocation: `https://${HOST}/${KEY}.txt`, urlList }),
})
console.log(`IndexNow: ${res.status} ${res.statusText} — ${urlList.length} URLs`)
if (!res.ok) console.log(await res.text())
