import { getModel } from "../config/llmmodels.js";
import axios from "axios";
import { uploadToS3 } from "../utils/uploadToS3.js";
import { getFromS3 } from "../utils/getFromS3.js";
import { deductCredits } from "../utils/deductCredits.js";
import { checkAgentLimit } from "../config/agentLimit.js";
export const visionAgent = async (state) => {
 try {
  await checkAgentLimit(state.userId,"image")
     const llm = await getModel("image");
  const res = await llm.invoke(`
        Convert the user request into a short, simple image generation prompt (max 50 words).
        Return only the prompt text, nothing else.

        User Request:
        ${state.prompt}
        `);

  const prompt = res.content.trim();

  const imageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(
    prompt
  )}?width=1024&height=1024&nologo=true`;

  const imageRes = await axios.get(imageUrl, { responseType: "arraybuffer", timeout: 60000 });
  await deductCredits(state.userId,"vision")

  // Resolve the real content type & extension from the provider response.
  // (Pollinations returns JPEG by default, not PNG.)
  const contentType =
    imageRes.headers["content-type"]?.split(";")[0] || "image/png";
  const extension = contentType === "image/jpeg" ? "jpg" : "png";
  const filename = `image-${Date.now()}.${extension}`;

  await uploadToS3(filename, Buffer.from(imageRes.data), contentType);
  const downloadUrl = await getFromS3(filename, 24*60);

return {
    ...state,
    aiResponse: `


![Generated Image](${downloadUrl})

[Download Image](${downloadUrl})

Link expires in 24 hours.
            `,
  };
 } catch (error) {
    console.error("Vision Agent Error:", error);
    return{
        ...state,
        aiResponse:error?.data?.message || "failed to generate vision image."
      }
 }
};
