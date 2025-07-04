import express from "express";
import cors from "cors";

const app = express();

app.use(
    cors({
        origin: process.env.CORS_ORIGIN,
        credentials: true,
    }),
);

app.use(express.json());
app.use(express.urlencoded({ extended: true, limit: "16kb" }));
app.use(express.static("public"));

import document from "./routes/document.router.js";
// routes declaration
app.use("/api/", document);

app.get("/", (req, res) => {
    res.send("Welcome to the API");
});
export default app;
