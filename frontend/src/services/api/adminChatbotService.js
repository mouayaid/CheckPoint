import api from "./axiosInstance";

const unwrap = (res) => {
  if (res?.answer != null) return res;
  return res?.data?.data ?? res?.data ?? res;
};

export const adminChatbotService = {
  ask: async (question, history = []) => {
    const res = await api.post("/admin/chatbot/ask", { question, history });
    return unwrap(res);
  },
};
