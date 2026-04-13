import axiosInstance from "./axiosInstance";

export const departmentChannelService = {
  /**
   * Get department feed (messages + polls) for the given department.
   */
  getFeed: async (departmentId) => {
    if (!departmentId) {
      throw new Error("departmentId is required to load channel feed.");
    }
    return await axiosInstance.get(`/DepartmentChannel/feed/${departmentId}`);
  },

  /**
   * Get current user's department channel info with unread count.
   */
  getMyChannel: async () => {
    return await axiosInstance.get("/DepartmentChannel/my-channel");
  },

  /**
   * Mark current user's department channel as read.
   */
  markRead: async () => {
    return await axiosInstance.post("/DepartmentChannel/mark-read");
  },

  /**
   * Manager: create a plain text message.
   */
  createMessage: async ({ departmentId, content, isPinned = false }) => {
    return await axiosInstance.post("/DepartmentChannel/message", {
      departmentId,
      content,
      isPinned,
    });
  },

  /**
   * Manager: create a poll.
   */
  createPoll: async ({
    departmentId,
    question,
    options,
    allowMultipleChoices = false,
    expiresAt = null,
    isPinned = false,
  }) => {
    return await axiosInstance.post("/DepartmentChannel/poll", {
      departmentId,
      question,
      options,
      allowMultipleChoices,
      expiresAt,
      isPinned,
    });
  },

  /**
   * Employee: vote on a poll option.
   */
  votePoll: async ({ pollId, optionId }) => {
    return await axiosInstance.post(`/DepartmentChannel/polls/${pollId}/vote`, {
      optionId,
    });
  },
};
