import { useCallback, useState } from "react";

const initialFeedback = {
  visible: false,
  type: "info",
  title: "",
  message: "",
  confirmText: "OK",
  cancelText: "",
  showCancel: false,
  onConfirm: null,
  onCancel: null,
};

export const useFeedback = () => {
  const [feedback, setFeedback] = useState(initialFeedback);

  const hideFeedback = useCallback(() => {
    setFeedback((current) => ({
      ...current,
      visible: false,
    }));
  }, []);

  const showFeedback = useCallback((config = {}) => {
    setFeedback({
      ...initialFeedback,
      ...config,
      visible: true,
      type: config.type || "info",
      confirmText: config.confirmText || "OK",
      showCancel: !!config.cancelText || !!config.onCancel,
    });
  }, []);

  return {
    feedback,
    showFeedback,
    hideFeedback,
  };
};

export default useFeedback;
