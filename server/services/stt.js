const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');

/**
 * Transcribe audio using local Whisper (via CLI)
 * Assumes whisper.cpp or similar is installed and in PATH
 * @param {string} filePath Path to the audio file
 * @returns {Promise<string>} Transcribed text
 */
async function transcribeAudio(filePath) {
    return new Promise((resolve, reject) => {
        // Example command: whisper audio.wav --model base --output-txt
        // Using a simpler approach: node-whisper or calling the binary
        // Note: Whisper usually needs .wav, so we might need ffmpeg here
        
        const outputBase = filePath.replace(path.extname(filePath), '');
        const command = `whisper "${filePath}" --model ${process.env.WHISPER_MODEL || 'base'} --output_dir "${path.dirname(filePath)}" --output_format txt`;

        exec(command, (error, stdout, stderr) => {
            if (error) {
                console.error('Local STT Error:', stderr);
                return reject(error);
            }

            const txtPath = `${outputBase}.txt`;
            if (fs.existsSync(txtPath)) {
                const text = fs.readFileSync(txtPath, 'utf8').trim();
                // Clean up txt file
                fs.unlink(txtPath, () => {});
                resolve(text);
            } else {
                resolve(stdout.trim());
            }
        });
    });
}

module.exports = { transcribeAudio };
