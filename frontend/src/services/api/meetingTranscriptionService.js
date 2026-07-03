import axiosInstance from "./axiosInstance";

export const meetingTranscriptionService = {
  async uploadAudio(reservationId, audioUri) {
    const formData = new FormData();

    formData.append("audio", {
      uri: audioUri,
      name: "meeting.m4a",
      type: "audio/m4a",
    });

    return axiosInstance.post(
      `/MeetingTranscriptions/${reservationId}/upload`,
      formData,
      {
        headers: {
          "Content-Type": "multipart/form-data",
        },
        timeout: 120000,
      }
    );
  },

  async getByReservation(reservationId) {
    return axiosInstance.get(
      `/MeetingTranscriptions/${reservationId}`
    );
  },
};
