const https = require('https');

// Attempt without version
const url = 'https://res.cloudinary.com/dkanwimnc/video/upload/fl_getinfo/mindx_videos/azerobpki8y3sqnhmkpz.json';

console.log("Fetching: " + url);

https.get(url, (res) => {
  console.log("Status: " + res.statusCode);
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => { console.log("Body: " + data); });
}).on('error', (err) => {
  console.log("Error: " + err.message);
});