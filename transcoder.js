import { spawn } from 'childprocess';
import path from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const FFMPEG_PATH = '/usr/local/bin/ffmpeg';
const outputDir = path.join(__dirname, 'hls_output');

if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
}

/**
 * starts FFmpeg ABR - adaptive bit rate transcoding engine
 */
function startTranscoder() {
    // Define the input and output paths
    const inputSource = 'input.mp4';
    const inputFlags = ['-re', 'i', inputSource];

    // OBS LIVE SETUP (phase 2): Swap the above flags with MediaMTX RTMP ingestion:
    // const inputSource = 'rtmp://localhost:1935/live/stream_key';
    // const inputFlags = ['-i', inputSource];

    const ffmpegArgs = [
        ...inputFlags,

        // Split input stream into 3 video channels and scale them to different resolutions
        '-filter_complex', '[0:v]split=3[v1][v2][v3]; [v1]scale=w=1920:h=1080[v1out]; [v2]scale=w=1280:h=720[v2out]; [v3]scale=w=854:h=480[v3out]',

        // encode track 1 (1080p High Quality)
        '-map', '[v1out]', '-c:v:0', 'libx264', '-preset', 'veryfast', '-b:v:0', '5000k', '-maxrate:v:0', '5350k', '-bufsize:v:0', '7500k', '-g:v:0', '60', '-sc_threshold:v:0', '0',

        // encode track 2 (720p Medium Quality)
        '-map', '[v2out]', '-c:v:1', 'libx264', '-preset', 'veryfast', '-b:v:1', '2800k', '-maxrate:v:1', '2996k', '-bufsize:v:1', '4200k', '-g:v:1', '60', '-sc_threshold:v:1', '0',
        
        // encode track 3 (480p Low Quality)
        '-map', '[v3out]', '-c:v:2', 'libx264', '-preset', 'veryfast', '-b:v:2', '1400k', '-maxrate:v:2', '1498k', '-bufsize:v:2', '2100k', '-g:v:2', '60', '-sc_threshold:v:2', '0',

        // map audio to match tracks (higher quality audio goes with higher video bitrate)
        '-map', '0:a', '-c:a:0', 'aac', '-b:a:0', '192k', '-ac', '2',
        '-map', '0:a', '-c:a:1', 'aac', '-b:a:1', '128k', '-ac', '2',
        '-map', '0:a', '-c:a:2', 'aac', '-b:a:2', '96k', '-ac', '2',

        // HLS segmenting options
        '-f', 'hls',
        '-hls_time', '4',              // split stream into uniform 4 second freagments
        '-hls_playlist_type', 'event',  // Persistent mode: keeps all fragments for VOD playback
        '-hls_segment_filename', path.join(outputDir, 'segment_%v_%03d.ts'), // segment file name pattern
        '-master_pl_name', 'master.m3u8', // master file index that lists the streams for the Ui player
        '-var_stream_map', 'v:0,a:0 v:1, a:1 v:2,a:2', // pairs video and audio tracks together
        path.join(outputDir, 'stream_%v.m3u8') // output file pattern for each stream
    ];

    console.log('Spawning FFmpeg ABR Engine via Node.js...');
    const ffmpegProcess = spawn(FFMPEG_PATH, ffmpegArgs);

    // stream logs out to see active processing metrics
    ffmpegProcess.stderr.on('data', (data) => {
        console.log(`[FFmpeg]: ${data.toString().trim()}`)
    });

    ffmpegProcess.on('close', (code) => {
        console.log(`FFmpeg stopped processing. Exit code: ${code}`);
        finalizeVOD();
    })

    return ffmpegProcess;

}

function finalizeVOD() {
    console.log('Stream terminated. Running VOD preservation scripts...');
    // we will automate the database updates and file movement here.
}

// fire it up
startTranscoder();
