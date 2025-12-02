const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs');
const net = require('net');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const { sleep } = require('../utils');

class FfmpegManager {
    constructor(homey) {
        this.homey = homey;
        this.proc = null;
        // this.setEufyStreamServer();
    }

    async streamHandler(videoStream, audioStream, device) {
        await this.stopStream();

        const deviceSn = device.getSerial();
        const streamLength = this.homey.app.eufyClient.getCameraMaxLivestreamDuration();

        this.homey.app.log(`[streamHandler] - Got handleStream: ${device.getName()} - ${deviceSn}`, { streamLength });

        audioStream.destroy();

        this.currentVideoStream = videoStream;

        if (streamLength < 300) {
            return this.takeSnapshot(deviceSn);
        } else {
            return this.startStream(deviceSn);
        }
    }

    // --- Start video stream ---
    // Current status: Not working due to memory usage
    startStream(deviceSn) {
        let finished = false;

        const rtspUrl = `rtsp://127.0.0.1:${this.homey.app.streamPort}/${this.homey.manifest.id}/${deviceSn}`;
        this.homey.app.log(`[handleStream] - Starting video for device: ${deviceSn}`, { rtspUrl });

        const ffmpegPath = this.getFFMPEGPath();

        return new Promise((resolve, reject) => {
            const cmd = ffmpeg(this.currentVideoStream)
                .setFfmpegPath(ffmpegPath)
                .inputFormat('h264')
                .videoCodec('copy')
                .format('rtsp')
                .outputOptions('-rtsp_transport tcp')
                .output(rtspUrl)
                .on('start', (cmd) => console.log(`[ffmpeg ${deviceSn}] started: ${cmd}`))
                .on('error', (err) => {
                    if (finished) return; // ignore duplicate events
                    finished = true;

                    this.homey.app.error(`[ffmpeg ${deviceSn}] - FFmpeg error:`, err);
                    if (this.proc === cmd) this.proc = null;
                    // reject(err);
                })
                .on('end', () => {
                    if (finished) return; // ignore duplicate events
                    finished = true;

                    this.homey.app.log(`[ffmpeg ${deviceSn}] stream ended`);
                    if (this.proc === cmd) this.proc = null;
                    resolve(rtmpUrl);
                });

            cmd.run();
            this.proc = cmd;
        });
    }

    // --- Take snapshot ---
    takeSnapshot(deviceSn) {
        let finished = false;

        const userDataPath = path.resolve(__dirname, '/userdata/');
        const snapshotPath = path.join(userDataPath, `${deviceSn}_snapshot.jpg`);
        this.homey.app.log('[takeSnapshot] - Going to save snapshot to:', snapshotPath);

        const ffmpegPath = this.getFFMPEGPath();

        return new Promise((resolve, reject) => {
            const cmd = ffmpeg(this.currentVideoStream)
                .setFfmpegPath(ffmpegPath)
                .inputFormat('h264')
                .frames(1)
                .seekOutput(0.4)
                .outputOptions('-vframes 1')
                .outputOptions('-q:v 2')
                .save(snapshotPath)
                .on('end', () => {
                    if (finished) return; // ignore duplicate events
                    finished = true;

                    this.homey.app.log(`[takeSnapshot] - Snapshot saved: ${snapshotPath}`);
                    if (this.proc === cmd) this.proc = null;
                    resolve(snapshotPath);
                })
                .on('error', (err) => {
                    if (finished) return; // ignore duplicate events
                    finished = true;

                    this.homey.app.error('[takeSnapshot] - FFmpeg error:', err);
                    if (this.proc === cmd) this.proc = null;
                    // reject(err);
                });

            cmd.run();
            this.proc = cmd;
        });
    }

    async stopStream(device = null) {
        try {
            return;
            if (device) {
                await sleep(1000);
            }

            if (this.proc) {
                this.homey.app.log('[stopStream] Stopping proc...', device ? `for device ${device.getSerial()}` : '');
                this.proc.kill();
                this.proc = null;
            } else {
                this.homey.app.log('[stopStream] No active proc to kill.');
            }

            if (this.currentVideoStream) {
                this.homey.app.log('[stopStream] Stopping videostream...', device ? `for device ${device.getSerial()}` : '');
                this.currentVideoStream.removeAllListeners('data');
                this.currentVideoStream.removeAllListeners('end');
                this.currentVideoStream.destroy();
                this.currentVideoStream = null;
            } else {
                this.homey.app.log('[stopStream] No active videostream to destroy.');
            }
        } catch (error) {
            this.homey.app.error('[stopStream] Error stopping stream:', error);
        }
    }

    // ---- Utility functions ----
    async setEufyStreamServer() {
        try {
            if (os.arch() !== 'arm64') {
                throw new Error('Unsupported Homey model');
            }

            this.homey.app.streamPort = await this.getFreePort();

            const serverPath = path.join(__dirname, '../../bin', 'mediamtx');
            const configPath = await this.writeMediaMtxYmlFile(this.homey.app.streamPort);

            const rtspServer = spawn(serverPath, [configPath], {
                stdio: 'pipe'
            });

            rtspServer.stdout.on('data', (d) => this.homey.app.log(`[setEufyStreamServer] - RTSP: ${d}`));
            rtspServer.stderr.on('data', (d) => this.homey.app.error(`[setEufyStreamServer] - RTSP ERR: ${d}`));
            rtspServer.on('close', (code) => this.homey.app.log(`[setEufyStreamServer] - RTSP server exited ${code}`));

            this.homey.app.log(`[setEufyStreamServer] - [info] RTSP server listening at rtsp://localhost:${this.homey.app.streamPort}/live/DEVICE_SN`); // DEVICE_SN to be replaced by actual device serial number
        } catch (error) {
            this.homey.app.error(`[setEufyStreamServer] - Error: ${error.message}`);
        }
    }

    getFreePort() {
        return new Promise((resolve, reject) => {
            const server = net.createServer();
            // let OS choose a free port
            server.listen(0, () => {
                const port = server.address().port;
                server.close(() => resolve(port));
            });
            server.on('error', reject);
        });
    }

    getFFMPEGPath() {
        let ffmpegPath;
        if (os.arch() === 'arm64') {
            // HP23
            ffmpegPath = path.join(__dirname, '../../bin', 'ffmpeg-arm64');
        } else if (os.arch() === 'arm') {
            // HP19
            ffmpegPath = path.join(__dirname, '../../bin', 'ffmpeg-arm32');
        } else {
            throw new Error('Unsupported Homey model');
        }

        this.homey.app.log('[getFFMPEGPath] - Using ffmpeg binary at:', ffmpegPath);

        return ffmpegPath;
    }

    async writeMediaMtxYmlFile(port) {
        const config = `
rtsp: yes
rtmp: no
hls: no
webrtc: no
srt: no

rtspEncryption: "no"
rtspTransports: [tcp]
rtspAddress: :${port}

paths:
  all:
    source: publisher
`;

        const userDataPath = path.resolve(__dirname, '/userdata/');
        const configPath = path.join(userDataPath, 'mediamtx.yml');
        fs.writeFileSync(configPath, config);
        return configPath;
    }
}

module.exports = FfmpegManager;
