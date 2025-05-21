import express from "express";
import {
  registerUserWithUpload,
  loginUser,
  requestPasswordReset,
  resetPassword,
  verifyToken,
} from "../controllers/authController.js";
import authMiddleware from "../middlewares/authMiddleware.js";

const router = express.Router();

router.post("/register", registerUserWithUpload);
router.post("/login", loginUser);
router.post("/forgot-password", requestPasswordReset);
router.post("/reset-password", resetPassword);
router.get("/verify", authMiddleware(['Client', 'Lawyer', 'Admin', 'LegalReviewer']), verifyToken);

export default router;