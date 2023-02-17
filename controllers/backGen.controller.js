import { Configuration, OpenAIApi } from "openai";
import sharp from "sharp";


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
  const file = req.file;

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

  let prompt = `${description}`;

  try {
    const response = await openai.createImageEdit(
      imageBuffer,
      imageBuffer,
      prompt,
      1,
      "512x512"
    );
    console.log(response.data.data[0]);
    const image_url = response.data.data[0].url;
    res.status(200).send({ image_url });
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
    if (metadata.width == metadata.height) {
      return inputFileBuffer;
    }

    const maxDim = Math.max(metadata.width, metadata.height);

    const hPadding = (maxDim - metadata.width) / 2;
    const vPadding = (maxDim - metadata.height) / 2;

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
