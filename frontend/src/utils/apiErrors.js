const normalizeValidationErrors = (errors) => {
  if (!errors) return "";

  if (Array.isArray(errors)) {
    return errors
      .map((item) => {
        if (typeof item === "string") return item;
        if (typeof item?.message === "string") return item.message;
        if (typeof item?.errorMessage === "string") return item.errorMessage;
        return "";
      })
      .filter(Boolean)
      .join("\n");
  }

  if (typeof errors === "object") {
    return Object.values(errors)
      .flat()
      .map((item) => {
        if (typeof item === "string") return item;
        if (typeof item?.message === "string") return item.message;
        return "";
      })
      .filter(Boolean)
      .join("\n");
  }

  return "";
};

export const getApiErrorMessage = (
  error,
  fallback = "Une erreur est survenue. Veuillez réessayer.",
) => {
  const validationMessage = normalizeValidationErrors(error?.data?.errors);

  return (
    validationMessage ||
    error?.data?.message ||
    error?.message ||
    fallback
  );
};

export default getApiErrorMessage;
