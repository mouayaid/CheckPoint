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
  getDepartment: (id) => axiosInstance.get(`/Departments/${id}`),
  createDepartment: (name) => axiosInstance.post("/Departments", { name }),
  updateDepartment: (id, name) =>
    axiosInstance.put(`/Departments/${id}`, { name }),
  deleteDepartment: (id) => axiosInstance.delete(`/Departments/${id}`),
};

export default departmentService;
