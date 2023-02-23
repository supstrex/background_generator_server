import { Configuration, OpenAIApi } from "openai";
import sharp from "sharp";
import { v4 } from 'uuid';
import getColors from 'get-image-colors';
import convert from 'color-convert'


const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});
const openai = new OpenAIApi(configuration);

export async function generate(req, res) {
  if (!configuration.apiKey) {
    res.status(500).send({
      error: {
        message: "OpenAI API key not configured",
      },
    });
    return;
  }

  const description = req.body.description || "";
  console.log(req.file);
  const file = req.file;

  const colors = await getColors(req.file.buffer, req.file.mimetype);
  const validColors = colors.map((c) => {
    return convert.rgb.keyword([c._rgb[0],c._rgb[1],c._rgb[2]])
  }).filter(c => c);

  if (description.trim().length === 0) {
    res.status(400).send({
      error: {
        message: "Please enter a valid description for your background",
      },
    });
    return;
  }

  const imageBuffer = await addTransparentPaddingToImage(file.buffer);
  imageBuffer.name = file.originalname

  let prompt = `${description} with ${validColors.join(',')} colors appropriate to content`;
  console.log(prompt);
  try {
    const response = await openai.createImageEdit(
      imageBuffer,
      imageBuffer,
      prompt,
      4,
      "256x256",
      'b64_json'
    );

    const b64_jsons = response.data.data;
    console.log(b64_jsons);
    const images = b64_jsons.map((image)=>{
      return {
        id: v4(),
        imageUrl: "data:image/png;base64,"+image.b64_json
      };
    })
    console.log(images);
    res.status(200).send(images);
  } catch (error) {
    if (error.response) {
      console.error(error.response.status, error.response.data);
      res.status(error.response.status).json(error.response.data);
    } else {
      console.error(`Error with OpenAI API request: ${error.message}`);
      res.status(500).send({
        error: {
          message: "An error occurred during your request.",
        },
      });
    }
  }
}

async function addTransparentPaddingToImage(inputFileBuffer) {
  try {
    const metadata = await sharp(inputFileBuffer).metadata();
    console.log(metadata);
    if (metadata.width == metadata.height) {
      return inputFileBuffer;
    }

    const maxDim = Math.max(metadata.width, metadata.height);

    const hPadding = Math.round((maxDim - metadata.width) / 2);
    const vPadding = Math.round((maxDim - metadata.height) / 2);

    const outputFileBuffer = await sharp({
      create: {
        width: maxDim,
        height: maxDim,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      },
    })
      .composite([{ input: inputFileBuffer, left: hPadding, top: vPadding }])
      .toFormat(sharp.format.png)
      .toBuffer();

    console.log("Image padding complete!");
    return outputFileBuffer;
  } catch (err) {
    console.error(err);
    return err;
  }
}

export default {
  generate,
};
