const express = require("express");
const adminChatbotRoutes = require("./routes/adminChatbotRoutes");

const app = express();

app.use(express.json());
app.use("/api/admin/chatbot", adminChatbotRoutes);

module.exports = app;
