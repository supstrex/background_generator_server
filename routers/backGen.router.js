import express from "express";
import { generate } from "../controllers/backGen.controller.js";
import multer from "multer";

const storage = multer.memoryStorage();
const upload = multer({ storage: storage, limits: { fileSize: 2097152 } });

export const router = express.Router(); 

router.post("/", upload.single("image"), generate);
