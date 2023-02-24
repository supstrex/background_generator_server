import express from "express";
import cors from "cors";
import { router as backGenRouter } from "./routers/backGen.router.js";
import path from "path";
import { errorHandler } from "./errorHandling.js";
import swaggerUI from 'swagger-ui-express'
import Yaml from 'js-yaml'
import fs from 'fs'


const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.resolve("public")));

const doc = Yaml.load(fs.readFileSync('./swagger.yml'))

app.use("/docs", swaggerUI.serve, swaggerUI.setup(doc))
app.use("/backgroundgenerator", backGenRouter);
app.use(errorHandler)

app.listen(process.env.PORT || 3001, () => {
    console.log(process.env.PORT || 3001);
});
