import axiosInstance from "./axiosInstance";

const extractData = (response) => {
  if (Array.isArray(response)) return response;
  if (Array.isArray(response?.data)) return response.data;
  if (Array.isArray(response?.data?.data)) return response.data.data;
  return response?.data?.data ?? response?.data ?? response ?? [];
};

export const departmentService = {
  getDepartments: async () => {
    const response = await axiosInstance.get("/Departments");
    const data = extractData(response);
    return Array.isArray(data) ? data : [];
  },
};

export default departmentService;
