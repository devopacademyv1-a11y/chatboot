/**
 * Language Detection Utility
 * Detects whether a user message is in Darija, French, or Mixed
 */

// Common Darija words/patterns
const DARIJA_PATTERNS = [
    /\b(salam|labas|bghit|kayn|makaynsh|wach|iyeh|mzyan|khouya|daba|hta|dial|dyal|f|b|l|w)\b/gi,
    /\b(kifash|kidayr|wakha|smeh|nti|nta|ana|hna|hnaya|temma)\b/gi,
    /\b(zwina|zwin|mzyan|kbir|sghir|ktir|chwia|bzzaf)\b/gi,
];

// French patterns
const FRENCH_PATTERNS = [
    /\b(je|tu|il|elle|nous|vous|ils|elles|mon|ma|mes|ton|ta|tes)\b/gi,
    /\b(bonjour|merci|s'il vous plaît|comment|pourquoi|quand|où|qui|quoi)\b/gi,
    /\b(le|la|les|un|une|des|du|de|au|aux|par|pour|sur|dans|avec)\b/gi,
];

// Manual override keywords
const LANG_OVERRIDE = {
    darija: /\b(darija|darja|عربية|عربي)\b/gi,
    french: /\b(français|francais|french)\b/gi,
};

/**
 * Detect language from text
 * @param {string} text - Input text
 * @returns {{ lang: 'darija'|'french'|'mixed', override: boolean }}
 */
function detectLanguage(text) {
    if (!text) return { lang: 'mixed', override: false };
    const lower = text.toLowerCase();

    // Check for manual override first
    if (LANG_OVERRIDE.darija.test(lower)) return { lang: 'darija', override: true };
    if (LANG_OVERRIDE.french.test(lower)) return { lang: 'french', override: true };

    let darijaScore = 0;
    let frenchScore = 0;

    DARIJA_PATTERNS.forEach(p => {
        const matches = lower.match(p);
        if (matches) darijaScore += matches.length;
    });

    FRENCH_PATTERNS.forEach(p => {
        const matches = lower.match(p);
        if (matches) frenchScore += matches.length;
    });

    if (darijaScore === 0 && frenchScore === 0) return { lang: 'mixed', override: false };
    if (darijaScore > frenchScore * 1.5) return { lang: 'darija', override: false };
    if (frenchScore > darijaScore * 1.5) return { lang: 'french', override: false };

    return { lang: 'mixed', override: false };
}

module.exports = { detectLanguage };
