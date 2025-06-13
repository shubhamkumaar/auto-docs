import { Router } from "express";
import { generateDocument } from "../controllers/create.document.js";
import { graphMerge } from "../controllers/graphMerge.js";
const router = Router();

router.route("/").post(generateDocument);
router.route("/chart").post(graphMerge);
export default router;
