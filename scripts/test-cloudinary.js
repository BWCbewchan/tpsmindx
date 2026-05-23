const https = require('https');

// The original URL looks like: https://res.cloudinary.com/dkanwimnc/video/upload/v1770544725/mindx_videos/azerobpki8y3sqnhmkpz.mp4
// We construct the info URL:
// https://res.cloudinary.com/dkanwimnc/video/upload/fl_getinfo/v1770544725/mindx_videos/azerobpki8y3sqnhmkpz.json

const url = 'https://res.cloudinary.com/dkanwimnc/video/upload/fl_getinfo/v1770544725/mindx_videos/azerobpki8y3sqnhmkpz.json';

console.log("Fetching: " + url);

https.get(url, (res) => {
  console.log("Status: " + res.statusCode);
  let data = '';
  
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    console.log("Body: " + data);
  });
  
}).on('error', (err) => {
  console.log("Error: " + err.message);
});