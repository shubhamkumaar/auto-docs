import { Router } from "express";
import { generateDocument } from "../controllers/create.document.js";
import { graphMerge } from "../controllers/graphMerge.js";
import { createReadme } from "../controllers/generateReadme.js";

const router = Router();

router.route("/").post(generateDocument);
router.route("/chart").post(graphMerge);
router.route("/readme").post(createReadme);
export default router;
