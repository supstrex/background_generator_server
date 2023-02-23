import { Configuration, OpenAIApi } from "openai";
import sharp from "sharp";
import { v4 } from "uuid";
import getColors from "get-image-colors";
import convert from "color-convert";

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
  const colorAutoDetection = req.body.colorDetection === 'true' ? true : false;
  const lightAutoDetection = req.body.lightDetection === 'true' ? true : false;
  const style = req.file.style || "";

  if (description.trim().length === 0) {
    res.status(400).send({
      error: {
        message: "Please enter a valid description for your background",
      },
    });
    return;
  }

  let lightingPrompt;
  if (lightAutoDetection) {
    lightingPrompt = await lightingDetection(file.buffer);
  }

  let colorsPrompt;
  if (colorAutoDetection) {
    colorsPrompt = await colorDetection(file);
  }

  const imageBuffer = await addTransparentPaddingToImage(file.buffer);
  imageBuffer.name = file.originalname;

  let prompt = `${description}${style ? ' ' + style: ''}${
    colorsPrompt ? " with " + colorsPrompt + " colors" : " "
  }${lightingPrompt ? ", lighting from " + lightingPrompt : " "}`;
  console.log(prompt);

  try {
    const response = await openai.createImageEdit(
      imageBuffer,
      imageBuffer,
      prompt,
      4,
      "256x256",
      "b64_json"
    );

    const b64_jsons = response.data.data;
    const images = b64_jsons.map((image) => {
      return {
        id: v4(),
        imageUrl: "data:image/png;base64," + image.b64_json,
      };
    });
    //console.log(images);
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

async function lightingDetection(imageBuffer) {
  try {
    // Load the image metadata
    const metadata = await sharp(imageBuffer).metadata();

    // Determine the image width and height
    const { width, height } = metadata;

    // Read the image pixels
    const { data, info } = await sharp(imageBuffer)
      .raw()
      .toBuffer({ resolveWithObject: true });

    // Determine the average brightness of each row and column of the image
    const rowBrightness = new Array(height).fill(0);
    const colBrightness = new Array(width).fill(0);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const index = (y * info.width + x) * info.channels;
        const r = data[index];
        const g = data[index + 1];
        const b = data[index + 2];
        const brightness = 0.2126 * r + 0.7152 * g + 0.0722 * b;
        rowBrightness[y] += brightness;
        colBrightness[x] += brightness;
      }
    }

    // Determine the brightest row and column of the image
    let brightestRow = 0;
    let brightestCol = 0;
    let maxRowBrightness = 0;
    let maxColBrightness = 0;
    for (let y = 0; y < height; y++) {
      if (rowBrightness[y] > maxRowBrightness) {
        brightestRow = y;
        maxRowBrightness = rowBrightness[y];
      }
    }
    for (let x = 0; x < width; x++) {
      if (colBrightness[x] > maxColBrightness) {
        brightestCol = x;
        maxColBrightness = colBrightness[x];
      }
    }

    // Determine the lighting direction based on the brightest row and column
    let lightingDirection;
    if (maxRowBrightness > maxColBrightness) {
      lightingDirection = brightestRow < height / 2 ? "top" : "bottom";
      if (maxRowBrightness / (height * 255) > 0.5) {
        lightingDirection += brightestCol < width / 2 ? "-left" : "-right";
      }
    } else {
      lightingDirection = brightestCol < width / 2 ? "left" : "right";
      if (maxColBrightness / (width * 255) > 0.5) {
        lightingDirection += brightestRow < height / 2 ? "-top" : "-bottom";
      }
    }
    return lightingDirection;
  } catch (err) {
    console.error(err);
  }
}

async function colorDetection(file) {
  const colors = await getColors(file.buffer, file.mimetype);
  const validColors = colors
    .map((c) => {
      return convert.rgb.keyword([c._rgb[0], c._rgb[1], c._rgb[2]]);
    })
    .filter((c) => c);
  return validColors.join(", ");
}

export default {
  generate,
};
