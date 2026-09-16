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
        Convert this to a very short image prompt (max 15 words). Only return the prompt.

        ${state.prompt}
        `);

  const prompt = res.content.trim();

  const seed = Math.floor(Math.random() * 100000);
  const imageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(
    prompt
  )}?width=1024&height=1024&nologo=true&seed=${seed}`;

  let imageRes;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      imageRes = await axios.get(imageUrl, { responseType: "arraybuffer", timeout: 30000 });
      break;
    } catch (err) {
      console.log(`Pollinations attempt ${attempt + 1} failed, retrying...`);
      if (attempt === 2) throw err;
      await new Promise(r => setTimeout(r, 2000));
    }
  }

  await deductCredits(state.userId,"vision")

  const contentType =
    imageRes.headers["content-type"]?.split(";")[0] || "image/png";
  const extension = contentType === "image/jpeg" ? "jpg" : "png";
  const filename = `image-${Date.now()}.${extension}`;

  await uploadToS3(filename, Buffer.from(imageRes.data), contentType);
  const downloadUrl = await getFromS3(filename, 24*60);

return {
    ...state,
    aiResponse: `![Generated Image](${downloadUrl})

[Download Image](${downloadUrl})

Link expires in 24 hours.`,
  };
 } catch (error) {
    console.error("Vision Agent Error:", error.message);
    return{
        ...state,
        aiResponse:"Image generation service is currently unavailable. Please try again later."
      }
 }
};
