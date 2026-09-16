import { ChatGroq } from "@langchain/groq";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import {ChatOpenRouter} from "@langchain/openrouter"
console.log("GROQ KEY:", process.env.GROQ_API_KEY);
const groq = new ChatGroq({
    apiKey: process.env.GROQ_API_KEY,
    model: "openai/gpt-oss-120b",
    temperature: 0.2,
});

const gemini = new ChatGoogleGenerativeAI({
    apiKey: process.env.GEMINI_API_KEY,
    model: "gemini-2.5-flash",
    temperature: 0.2,
});

const openrouter = new ChatOpenRouter({
    apiKey: process.env.OPENROUTER_API_KEY,
    model:"deepseek/deepseek-chat",
    temperature:0,
    maxTokens:2500
})

export const getModel = async (agent) => {
    switch (agent) {
        case "chat":
            return groq;

        case "search":
            return groq;

        case "coding":
            return openrouter;

        case "imageAnalyzer":
            return gemini;

        default:
            return groq;
    }
};