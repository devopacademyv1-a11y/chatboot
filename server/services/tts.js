const { exec } = require('child_process');
const path = require('path');

const PIPER_BINARY = process.env.PIPER_BINARY || 'piper';
const MODELS = {
    fr: process.env.PIPER_MODEL_FR || '/opt/piper/models/fr_FR-siwis-medium.onnx',
    darija: process.env.PIPER_MODEL_AR || '/opt/piper/models/ar_JO-kareem-medium.onnx', // Using Arabic model for Darija
    mixed: process.env.PIPER_MODEL_FR || '/opt/piper/models/fr_FR-siwis-medium.onnx'
};

/**
 * Generate speech using local Piper TTS
 * @param {string} text 
 * @param {string} outputFilePath 
 * @param {string} lang 
 */
async function generateSpeech(text, outputFilePath, lang = 'mixed') {
    return new Promise((resolve, reject) => {
        const modelPath = MODELS[lang] || MODELS.mixed;
        
        // Command: echo "text" | piper --model model.onnx --output_file out.wav
        // Escaping text for shell
        const escapedText = text.replace(/"/g, '\\"');
        const command = `echo "${escapedText}" | ${PIPER_BINARY} --model ${modelPath} --output_file ${outputFilePath}`;

        exec(command, (error, stdout, stderr) => {
            if (error) {
                console.error('Local TTS Error (Piper):', stderr);
                return reject(error);
            }
            resolve(outputFilePath);
        });
    });
}

module.exports = { generateSpeech };
