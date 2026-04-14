import React, { useCallback, useMemo, useState } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  Alert,
  TouchableOpacity,
  RefreshControl,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import api from "../services/api/axiosInstance";
import { useTheme } from "../context/ThemeContext";

const PendingRoomReservationsScreen = () => {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState(null);

  const fetchPendingRequests = async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);

      const response = await api.get("/RoomReservation/pending");
      const data = Array.isArray(response.data)
        ? response.data
        : response.data?.data || [];

      setRequests(data);
    } catch (error) {
      console.log("Fetch pending room requests error:", {
        message: error?.message,
        status: error?.response?.status,
        data: error?.response?.data,
        url: error?.config?.url,
        baseURL: error?.config?.baseURL,
      });

      Alert.alert(
        "Erreur",
        error?.response?.data?.message ||
          "Impossible de charger les demandes de réservation de salle en attente."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchPendingRequests();
    }, [])
  );

  const handleApprove = async (id) => {
    try {
      setActionLoadingId(id);

      await api.put(`/RoomReservation/${id}/approve`);

      setRequests((prev) => prev.filter((req) => req.id !== id));
      Alert.alert("Succès", "Réservation de salle approuvée.");
    } catch (error) {
      console.log("Approve room error:", {
        message: error?.message,
        status: error?.response?.status,
        data: error?.response?.data,
        url: error?.config?.url,
        baseURL: error?.config?.baseURL,
      });

      Alert.alert(
        "Erreur",
        error?.response?.data?.message ||
          "Impossible d'approuver la réservation de salle."
      );
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleReject = async (id) => {
    try {
      setActionLoadingId(id);

      await api.put(`/RoomReservation/${id}/reject`, {
        reason: "Rejeté par le responsable",
      });

      setRequests((prev) => prev.filter((req) => req.id !== id));
      Alert.alert("Succès", "Réservation de salle rejetée.");
    } catch (error) {
      console.log("Reject room error:", {
        message: error?.message,
        status: error?.response?.status,
        data: error?.response?.data,
        url: error?.config?.url,
        baseURL: error?.config?.baseURL,
      });

      Alert.alert(
        "Erreur",
        error?.response?.data?.message ||
          "Impossible de rejeter la réservation de salle."
      );
    } finally {
      setActionLoadingId(null);
    }
  };

  const confirmApprove = (id) => {
    Alert.alert(
      "Approuver la demande",
      "Êtes-vous sûr de vouloir approuver cette réservation de salle ?",
      [
        { text: "Annuler", style: "cancel" },
        { text: "Approuver", onPress: () => handleApprove(id) },
      ]
    );
  };

  const confirmReject = (id) => {
    Alert.alert(
      "Rejeter la demande",
      "Êtes-vous sûr de vouloir rejeter cette réservation de salle ?",
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Rejeter",
          style: "destructive",
          onPress: () => handleReject(id),
        },
      ]
    );
  };

  const renderItem = ({ item }) => {
    const isBusy = actionLoadingId === item.id;

    return (
      <View style={styles.card}>
        <Text style={styles.title}>
          {item.roomName || `Room #${item.roomId || "-"}`}
        </Text>

        <Text style={styles.text}>
          Utilisateur : {item.userName || `Utilisateur #${item.userId || "-"}`}
        </Text>

        <Text style={styles.text}>
          Date : {item.reservationDate?.split("T")[0] || "-"}
        </Text>

        <Text style={styles.text}>
          Heure : {item.startTime || "-"} - {item.endTime || "-"}
        </Text>

        {!!item.purpose && (
          <Text style={styles.text}>Objet : {item.purpose}</Text>
        )}

        <Text style={styles.status}>Statut : {item.status || "En attente"}</Text>

        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.button, styles.approveButton]}
            onPress={() => confirmApprove(item.id)}
            disabled={isBusy}
          >
            <Text style={styles.buttonText}>
              {isBusy ? "Traitement..." : "Approuver"}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.rejectButton]}
            onPress={() => confirmReject(item.id)}
            disabled={isBusy}
          >
            <Text style={styles.buttonText}>
              {isBusy ? "Traitement..." : "Rejeter"}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>
          Chargement des demandes de salle en attente...
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {requests.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyText}>Aucune demande de salle en attente</Text>
        </View>
      ) : (
        <FlatList
          data={requests}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderItem}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => fetchPendingRequests(true)}
            />
          }
          contentContainerStyle={styles.listContent}
        />
      )}
    </View>
  );
};

export default PendingRoomReservationsScreen;

const createStyles = (colors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    listContent: {
      padding: 16,
    },
    center: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      paddingHorizontal: 24,
      backgroundColor: colors.background,
    },
    loadingText: {
      marginTop: 10,
      color: colors.textSecondary,
    },
    emptyText: {
      fontSize: 16,
      color: colors.textSecondary,
      textAlign: "center",
    },
    card: {
      backgroundColor: colors.surface,
      borderRadius: 12,
      padding: 16,
      marginBottom: 14,
      borderWidth: 1,
      borderColor: colors.border,
    },
    title: {
      fontSize: 18,
      fontWeight: "700",
      marginBottom: 8,
      color: colors.textPrimary,
    },
    text: {
      fontSize: 14,
      marginBottom: 4,
      color: colors.textSecondary,
    },
    status: {
      marginTop: 8,
      marginBottom: 12,
      fontWeight: "600",
      color: colors.textPrimary,
    },
    actions: {
      flexDirection: "row",
      gap: 10,
    },
    button: {
      flex: 1,
      paddingVertical: 12,
      borderRadius: 8,
      alignItems: "center",
    },
    approveButton: {
      backgroundColor: "#2e7d32",
    },
    rejectButton: {
      backgroundColor: "#c62828",
    },
    buttonText: {
      color: "#fff",
      fontWeight: "700",
    },
  });