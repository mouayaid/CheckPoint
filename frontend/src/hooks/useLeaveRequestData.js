import { useCallback, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { leaveService, profileService } from "../services/api";
import {
  leaveTypeToString,
  requestStatusToString,
} from "../utils/helpers";
import logger from "../utils/logger";

const normalizeStatus = (status) =>
  String(status || "")
    .trim()
    .toLowerCase();

export const useLeaveRequestData = ({
  canUseReviewMode,
  onLoadError,
  user,
}) => {
  const [refreshing, setRefreshing] = useState(false);
  const [requests, setRequests] = useState([]);
  const [loadingRequests, setLoadingRequests] = useState(false);
  const [leaveBalance, setLeaveBalance] = useState(null);
  const [loadingBalance, setLoadingBalance] = useState(false);

  const loadLeaveBalance = useCallback(async () => {
    if (canUseReviewMode) {
      setLeaveBalance(null);
      setLoadingBalance(false);
      return;
    }

    setLoadingBalance(true);
    try {
      const res = await profileService.getProfile();

      const payload = res?.data?.data || res?.data || null;

      const userProfile =
        payload?.user ??
        payload?.User ??
        payload?.userDto ??
        payload?.UserDto ??
        payload ??
        null;

      const rawBalance =
        userProfile?.leaveBalance ??
        userProfile?.LeaveBalance ??
        payload?.leaveBalance ??
        payload?.LeaveBalance ??
        0;

      const balance = Number(rawBalance);
      setLeaveBalance(Number.isNaN(balance) ? 0 : balance);
    } catch (error) {
      logger.debug("LOAD BALANCE status:", error?.status);
      logger.debug("LOAD BALANCE body:", error?.data);
      logger.debug("LOAD BALANCE message:", error?.message);
      setLeaveBalance(0);
    } finally {
      setLoadingBalance(false);
    }
  }, [canUseReviewMode]);

  const loadRequests = useCallback(async () => {
    setLoadingRequests(true);

    try {
      const res = canUseReviewMode
        ? await leaveService.getPendingReviewRequests()
        : await leaveService.getMyLeaveRequests();

      if (res?.success) {
        const normalized = (res.data || []).map((request) => ({
          ...request,
          normalizedStatus: normalizeStatus(
            requestStatusToString(request.status),
          ),
          statusLabel: requestStatusToString(request.status),
          typeLabel: leaveTypeToString(request.type),
        }));

        setRequests(normalized);
      } else {
        onLoadError?.(
          "Erreur",
          res?.message || "Impossible de charger les demandes",
        );
      }
    } catch (error) {
      logger.debug("LOAD LEAVES status:", error?.status);
      logger.debug("LOAD LEAVES body:", error?.data);
      logger.debug("LOAD LEAVES message:", error?.message);

      onLoadError?.(
        "Erreur",
        error?.message || "Impossible de charger les demandes",
      );
    } finally {
      setLoadingRequests(false);
    }
  }, [canUseReviewMode, onLoadError]);

  const reloadLeaveData = useCallback(async () => {
    await Promise.all([loadRequests(), loadLeaveBalance()]);
  }, [loadRequests, loadLeaveBalance]);

  const userFocusKey = user?.id ?? user?.email ?? user?.employeeId ?? null;

  useFocusEffect(
    useCallback(() => {
      if (user) {
        reloadLeaveData();
      }
    }, [userFocusKey, reloadLeaveData]),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await reloadLeaveData();
    } finally {
      setRefreshing(false);
    }
  }, [reloadLeaveData]);

  const createLeaveRequest = useCallback(
    (payload) => leaveService.createLeaveRequest(payload),
    [],
  );

  const reviewLeaveRequest = useCallback(
    (id, payload) => leaveService.review(id, payload),
    [],
  );

  const cancelLeaveRequest = useCallback(
    (id) => leaveService.cancelLeaveRequest(id),
    [],
  );

  return {
    refreshing,
    requests,
    loadingRequests,
    leaveBalance,
    loadingBalance,
    loadRequests,
    loadLeaveBalance,
    reloadLeaveData,
    onRefresh,
    createLeaveRequest,
    reviewLeaveRequest,
    cancelLeaveRequest,
  };
};
