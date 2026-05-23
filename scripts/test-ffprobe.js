const { getVideoDurationInSeconds } = require('get-video-duration');
const ffprobe = require('ffprobe-static');

const videoUrl = 'https://res.cloudinary.com/dkanwimnc/video/upload/v1770544725/mindx_videos/azerobpki8y3sqnhmkpz.mp4';

console.log('Testing duration fetch...');
console.log('ffprobe path:', ffprobe.path);

getVideoDurationInSeconds(videoUrl, ffprobe.path)
  .then((duration) => {
    console.log('Duration (seconds):', duration);
    console.log('Duration (minutes):', Math.ceil(duration / 60));
  })
  .catch((err) => {
    console.error('Error fetching duration:', err);
  });