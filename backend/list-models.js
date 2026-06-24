import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';
dotenv.config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function list() {
  try {
    // Note: listModels is a method on the genAI client or we can list them via REST API
    // Let's use the REST API directly to fetch the list of models using the API key
    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${process.env.GEMINI_API_KEY}`;
    const res = await fetch(url);
    const data = await res.json();
    console.log("Available models:");
    if (data.models) {
      data.models.forEach(m => {
        console.log(`- ${m.name} (${m.displayName}) - Methods: ${m.supportedGenerationMethods.join(', ')}`);
      });
    } else {
      console.log(data);
    }
  } catch (err) {
    console.error("Error listing models:", err.message);
  }
}

list();
