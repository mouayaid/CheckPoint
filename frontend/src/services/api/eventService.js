import logger from '../../utils/logger';
import axiosInstance, { BASE_URL } from './axiosInstance';

const logEventRequest = (label, payload) => {
  logger.debug(label, payload);
};

const toParticipantStatusValue = (status) => {
  if (typeof status === "number") return status;

  const normalized = String(status ?? "")
    .trim()
    .replace(/[_\s-]/g, "")
    .toLowerCase();

  if (["going", "accepted", "accept", "participera"].includes(normalized)) {
    return 2;
  }

  if (
    ["notgoing", "declined", "decline", "neparticiperapas"].includes(
      normalized,
    )
  ) {
    return 3;
  }

  if (["maybe", "peutetre", "peutêtre"].includes(normalized)) {
    return 4;
  }

  return status;
};

export const eventService = {
  createEvent: (data) => axiosInstance.post("/Events", data),

  updateEvent: async (id, data) => {
    const path = `/Events/${id}`;
    const requestInfo = {
      method: "PUT",
      url: `${BASE_URL}${path}`,
      path,
      id,
      payload: data,
    };

    logEventRequest("EVENT UPDATE REQUEST:", requestInfo);

    try {
      const response = await axiosInstance.put(path, data);

      logEventRequest("EVENT UPDATE RESPONSE:", {
        method: "PUT",
        url: requestInfo.url,
        status: response?.__httpStatus ?? 200,
        data: response,
      });

      return response;
    } catch (error) {
      logEventRequest("EVENT UPDATE ERROR:", {
        method: "PUT",
        url: requestInfo.url,
        status: error?.status ?? error?.response?.status,
        data: error?.data ?? error?.response?.data,
        validationErrors:
          error?.data?.errors ??
          error?.data?.Errors ??
          error?.response?.data?.errors ??
          error?.response?.data?.Errors,
        message: error?.message,
      });

      throw error;
    }
  },

  getEventsByDate: (date) =>
    axiosInstance.get("/Events", { params: { date } }),

  getEventById: (id) => axiosInstance.get(`/Events/${id}`),

  getEventRsvps: (id) => axiosInstance.get(`/Events/${id}/rsvps`),

  rsvpEvent: (id, status) =>
    axiosInstance.post(`/Events/${id}/rsvp`, {
      status: toParticipantStatusValue(status),
    }),

  rsvpToEvent: (id, status) =>
    axiosInstance.post(`/Events/${id}/rsvp`, {
      status: toParticipantStatusValue(status),
    }),
};
