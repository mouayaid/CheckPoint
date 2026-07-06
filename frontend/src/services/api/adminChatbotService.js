import api from "./axiosInstance";

const unwrap = (res) => {
  if (res?.answer != null) return res;
  return res?.data?.data ?? res?.data ?? res;
};

export const adminChatbotService = {
  ask: async (question, history = [], filters = {}) => {
    const res = await api.post("/admin/statistics/chat", {
      message: question,
      history,
      from: filters.from,
      to: filters.to,
      departmentId: filters.departmentId,
    });
    return unwrap(res);
  },
};
