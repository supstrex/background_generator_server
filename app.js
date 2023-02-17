import express from "express";
import cors from "cors";
import { router as backGenRouter } from "./routers/backGen.router.js";
import path from "path";
import { errorHandler } from "./errorHandling.js";

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.resolve("public")));

app.use("/backgroundgenerator", backGenRouter);
app.use(errorHandler)

app.listen(process.env.PORT || 3001);
