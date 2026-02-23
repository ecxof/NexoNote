/**
 * Hugging Face Chat Service for NexoNote AI Assistant.
 * Uses the Hugging Face Inference API with the zai-org/GLM-5 model.
 * Provides streaming chat completions grounded in the current note context.
 */

const HF_API_URL = '/api/hf/v1/chat/completions';
const HF_API_TOKEN = import.meta.env.VITE_HF_API_TOKEN;
const MODEL = 'zai-org/GLM-5';

/**
 * Build the system prompt that grounds the AI in the note context.
 * @param {string} noteContent - HTML content of the current note
 * @param {string} noteTitle - Title of the current note
 * @returns {string}
 */
function buildSystemPrompt(noteContent, noteTitle) {
    const plainText = noteContent
        ? noteContent.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
        : '';

    return `You are NexoNote AI Assistant — a helpful, friendly study tutor embedded in a note-taking application.

Your role:
- Help the student understand, summarize, and explore the material in their notes.
- Give clear, accurate, and concise explanations.
- When relevant, reference specific parts of the note content.
- If you are uncertain about something, say so honestly. Never fabricate facts.
- Use markdown formatting (bold, lists, code blocks) to make responses easy to read.
- Keep responses focused and educational.

${plainText ? `The student is currently working on a note titled "${noteTitle || 'Untitled'}". Here is the note content:

---
${plainText.slice(0, 6000)}
${plainText.length > 6000 ? '\n[Note truncated for length]' : ''}
---

Use this content as context when answering questions. If the student asks about something not in the note, you may still help but mention that it goes beyond the current note material.` : 'The student has not written any content in their current note yet. You can still help with general questions.'}`;
}

/**
 * Send a chat message to Hugging Face Inference API with streaming.
 * @param {Array<{role: string, content: string}>} messages - Chat history
 * @param {string} noteContent - Current note HTML content
 * @param {string} noteTitle - Current note title
 * @param {function} onChunk - Callback for each streamed text chunk
 * @param {AbortSignal} [signal] - Optional abort signal
 * @returns {Promise<string>} Full response text
 */
export async function sendChatMessage(messages, noteContent, noteTitle, onChunk, signal) {
    const systemPrompt = buildSystemPrompt(noteContent, noteTitle);

    const apiMessages = [
        { role: 'system', content: systemPrompt },
        ...messages,
    ];

    const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${HF_API_TOKEN}`,
    };

    const response = await fetch(HF_API_URL, {
        method: 'POST',
        headers,
        body: JSON.stringify({
            model: MODEL,
            messages: apiMessages,
            stream: true,
            temperature: 0.7,
            max_tokens: 2048,
        }),
        signal,
    });

    if (!response.ok) {
        const errorBody = await response.text().catch(() => '');
        throw new Error(`Hugging Face API error (${response.status}): ${errorBody || response.statusText}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let fullText = '';
    let buffer = '';

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || !trimmed.startsWith('data: ')) continue;
            const data = trimmed.slice(6);
            if (data === '[DONE]') continue;

            try {
                const parsed = JSON.parse(data);
                const delta = parsed.choices?.[0]?.delta?.content;
                if (delta) {
                    fullText += delta;
                    onChunk?.(delta, fullText);
                }
            } catch {
                // Skip malformed chunks
            }
        }
    }

    return fullText;
}

/**
 * Send a non-streaming chat message (simpler fallback).
 * @param {Array<{role: string, content: string}>} messages
 * @param {string} noteContent
 * @param {string} noteTitle
 * @param {AbortSignal} [signal]
 * @returns {Promise<string>}
 */
export async function sendChatMessageSimple(messages, noteContent, noteTitle, signal) {
    const systemPrompt = buildSystemPrompt(noteContent, noteTitle);

    const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${HF_API_TOKEN}`,
    };

    const response = await fetch(HF_API_URL, {
        method: 'POST',
        headers,
        body: JSON.stringify({
            model: MODEL,
            messages: [{ role: 'system', content: systemPrompt }, ...messages],
            temperature: 0.7,
            max_tokens: 2048,
        }),
        signal,
    });

    if (!response.ok) {
        const errorBody = await response.text().catch(() => '');
        throw new Error(`Hugging Face API error (${response.status}): ${errorBody || response.statusText}`);
    }

    const json = await response.json();
    return json.choices?.[0]?.message?.content || '';
}
