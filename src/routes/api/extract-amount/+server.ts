import { json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { adminStorage } from '$lib/server/firebase-admin';

const genAI = new GoogleGenerativeAI(env.GOOGLE_GENAI_API_KEY || '');

export const POST = async ({ request }) => {
  try {
    const { imageBase64, orderId } = await request.json();

    if (!imageBase64) {
      return json({ error: 'Image data is required' }, { status: 400 });
    }

    if (!env.GOOGLE_GENAI_API_KEY) {
      console.error('GOOGLE_GENAI_API_KEY is not set');
      return json({ error: 'AI initialiation failed' }, { status: 500 });
    }

    // --- 1. Upload to Firebase Storage (Server-side to avoid CORS) ---
    let imageUrl = '';
    if (orderId) {
      try {
        const bucket = adminStorage.bucket("momotake-2f30b.firebasestorage.app");
        const filePath = `receipts/${orderId}_${Date.now()}.jpg`;
        const file = bucket.file(filePath);

        // Convert Base64 to Buffer
        const base64Data = imageBase64.split(',')[1] || imageBase64;
        const buffer = Buffer.from(base64Data, 'base64');

        await file.save(buffer, {
          metadata: { contentType: 'image/jpeg' }
        });

        // Make the file public explicitly
        try {
          await file.makePublic();
        } catch (pubErr) {
          console.warn('[Storage] Could not make file public, link might be protected:', pubErr);
        }

        // Construct public URL using Firebase Storage format
        // This format is often more compatible with Firebase security rules
        imageUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(filePath)}?alt=media`;
        console.log(`[Storage] Public URL generated: ${imageUrl}`);
      } catch (storageErr: any) {
        console.error('[Storage] Upload failed:', storageErr.message);
      }
    }

    // --- 2. AI Extraction with Gemini 2.5 Flash ---
    // 最新の安定版である gemini-2.5-flash を使用
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    const prompt = `このレシート画像から合計金額だけを数字のみで抽出してください。余計な説明は一切不要です。`;

    const base64DataForAI = imageBase64.split(',')[1] || imageBase64;
    const imagePart = {
      inlineData: {
        data: base64DataForAI,
        mimeType: "image/jpeg",
      },
    };

    console.log('[Gemini OCR] Extracting amount from receipt...');
    const result = await model.generateContent([prompt, imagePart]);
    const response = await result.response;
    const text = response.text().trim();

    console.log(`[Gemini OCR] Response: ${text}`);

    // Extract numbers
    const amountMatch = text.match(/\d+/);
    const amount = amountMatch ? parseInt(amountMatch[0]) : null;

    return json({ 
      success: true, 
      amount, 
      receiptUrl: imageUrl,
      error: amount === null ? 'ERROR' : null 
    });

  } catch (err: any) {
    console.error('Gemini OCR Error:', err.message);
    return json({ error: err.message }, { status: 500 });
  }
};
