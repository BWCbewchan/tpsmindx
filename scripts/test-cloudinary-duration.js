const https = require('https');

const url = 'https://res.cloudinary.com/dkanwimnc/video/upload/fl_getinfo/mindx_videos/azerobpki8y3sqnhmkpz.json';

https.get(url, (res) => {
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => {
    console.log(data);
  });
}).on('error', (err) => {
  console.log("Error: " + err.message);
});