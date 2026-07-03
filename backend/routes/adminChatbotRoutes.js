const express = require("express");
const { askAdminChatbot } = require("../controllers/adminChatbotController");
const { protect, isAdmin } = require("../middleware/authMiddleware");

const router = express.Router();

router.post("/ask", protect, isAdmin, askAdminChatbot);

module.exports = router;
