const mongoose = require('mongoose');

const MessageSchema = new mongoose.Schema({
    role: { type: String, enum: ['user', 'assistant'], required: true },
    content: { type: String, required: true },
    language: { type: String, enum: ['darija', 'french', 'mixed'], default: 'mixed' },
    isVoice: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now }
});

const ConversationSchema = new mongoose.Schema({
    whatsappId: { type: String, required: true, unique: true, index: true },
    phone: { type: String, required: true },
    preferredLang: { type: String, enum: ['darija', 'french', 'auto'], default: 'auto' },
    messages: [MessageSchema],
    totalMessages: { type: Number, default: 0 },
    lastActivity: { type: Date, default: Date.now },
    createdAt: { type: Date, default: Date.now }
});

// Auto-update lastActivity
ConversationSchema.pre('save', function (next) {
    this.lastActivity = Date.now();
    this.totalMessages = this.messages.length;
    next();
});

module.exports = mongoose.model('Conversation', ConversationSchema);
