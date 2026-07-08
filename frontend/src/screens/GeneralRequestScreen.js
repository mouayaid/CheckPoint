import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
  TextInput,
  Modal,
  KeyboardAvoidingView,
  Platform,
  Pressable,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Picker } from "@react-native-picker/picker";
import {
  useFocusEffect,
  useNavigation,
  useRoute,
} from "@react-navigation/native";

import { requestService } from "../services/api";
import { useTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import FeedbackModal from "../components/FeedbackModal";
import { useFeedback } from "../hooks/useFeedback";
import { formatDate as formatDateOnlyLocal } from "../utils/helpers";

const CATEGORIES = [
  { label: "Autorisation de sortie", value: 1, name: "ExitAuthorization", icon: "exit-outline" },
  { label: "Récupération", value: 2, name: "Recovery", icon: "refresh-circle-outline" },
  { label: "Télétravail", value: 3, name: "RemoteWork", icon: "home-outline" },
  { label: "Documents", value: 4, name: "Document", icon: "document-attach-outline" },
];

const STATUS_LABELS = {
  1: "En attente",
  2: "Approuvée",
  3: "Rejetée",
  Pending: "En attente",
  Approved: "Approuvée",
  Rejected: "Rejetée",
};

const EXIT_AUTHORIZATION_CATEGORY = 1;
const RECOVERY_CATEGORY = 2;
const REMOTE_WORK_CATEGORY = 3;
const DOCUMENT_CATEGORY = 4;

const DOCUMENT_TYPES = [
  "Attestation de salaire",
  "Attestation de travail",
  "Attestation de fiche de paie",
  "Attestation de stage",
  "STC",
  "Autre",
];

const RECOVERY_PERMUTATION_TYPES = [
  {
    label: "Permutation de congés",
    value: "Leave",
  },
  {
    label: "Permutation des autorisations",
    value: "Authorization",
  },
];

const RECOVERY_NATURES = [
  {
    label: "Récupération",
    value: "Recovery",
  },
  {
    label: "Demi-journée",
    value: "HalfDay",
  },
  {
    label: "Congé spécial",
    value: "SpecialLeave",
  },
];

const normalizePayload = (response) => {
  if (Array.isArray(response)) return response;
  if (Array.isArray(response?.data)) return response.data;
  if (Array.isArray(response?.data?.data)) return response.data.data;
  return [];
};

const getCategoryLabel = (category) => {
  const item = CATEGORIES.find(
    (entry) =>
      entry.value === category ||
      entry.name.toLowerCase() === String(category).toLowerCase() ||
      entry.label.toLowerCase() === String(category).toLowerCase(),
  );

  return item?.label ?? "Autre";
};

const getCategoryValue = (category) => {
  const item = CATEGORIES.find(
    (entry) =>
      entry.value === category ||
      entry.name.toLowerCase() === String(category).toLowerCase() ||
      entry.label.toLowerCase() === String(category).toLowerCase(),
  );

  return item?.value ?? CATEGORIES[0].value;
};

const getStatusLabel = (status) => STATUS_LABELS[status] ?? String(status);

const getStatusTone = (status) => {
  const normalized = String(status).toLowerCase();

  if (normalized === "2" || normalized === "approved") return "success";
  if (normalized === "3" || normalized === "rejected") return "error";

  return "warning";
};

const formatDate = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);

  return date.toLocaleDateString("fr-FR", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

const formatDateValue = (date) => {
  if (!date) return "";
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${d}/${m}/${y}`;
};

const formatTimeValue = (date) => {
  if (!date) return "";
  const h = String(date.getHours()).padStart(2, "0");
  const m = String(date.getMinutes()).padStart(2, "0");
  return `${h}:${m}`;
};

const formatTimePayload = (date) => {
  if (!date) return null;
  return `${formatTimeValue(date)}:00`;
};

const normalizeDateOnly = (date) => {
  const normalized = new Date(date);
  normalized.setHours(0, 0, 0, 0);
  return normalized;
};

export const calculateDurationMinutes = (startTime, endTime) => {
  if (!startTime || !endTime) return null;
  const start = startTime.getHours() * 60 + startTime.getMinutes();
  const end = endTime.getHours() * 60 + endTime.getMinutes();
  return end - start;
};

export const formatDuration = (minutes) => {
  if (!minutes || minutes <= 0) return "";
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  if (hours === 0) return `${remainingMinutes}min`;
  if (remainingMinutes === 0) return `${hours}h`;
  return `${hours}h ${remainingMinutes}min`;
};

const formatDurationClock = (minutes) => {
  if (!minutes || minutes <= 0) return "00:00";
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(remainingMinutes).padStart(
    2,
    "0",
  )}`;
};

export default function GeneralRequestScreen() {
  const { colors, spacing, typography, borderRadius, shadows } = useTheme();
  const { triggerRefresh } = useAuth();
  const { feedback, showFeedback, hideFeedback } = useFeedback();
  const route = useRoute();
  const navigation = useNavigation();

  const styles = useMemo(
    () => createStyles(colors, spacing, typography, borderRadius, shadows),
    [colors, spacing, typography, borderRadius, shadows],
  );

  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  const [submitAttempted, setSubmitAttempted] = useState(false);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState(
    getCategoryValue(route?.params?.category),
  );

  const [authorizedDate, setAuthorizedDate] = useState(() => new Date());
  const [startTime, setStartTime] = useState(null);
  const [endTime, setEndTime] = useState(null);
  const [motif, setMotif] = useState("");

  const [remoteWorkRequestText, setRemoteWorkRequestText] = useState("");
  const [documentType, setDocumentType] = useState("");
  const [documentSubject, setDocumentSubject] = useState("");
  const [documentRequestText, setDocumentRequestText] = useState("");

  const [showAuthorizedDatePicker, setShowAuthorizedDatePicker] = useState(false);
  const [showStartTimePicker, setShowStartTimePicker] = useState(false);
  const [showEndTimePicker, setShowEndTimePicker] = useState(false);

  const [editingRecoverySlot, setEditingRecoverySlot] = useState(null);
  const [recoveryPickerMode, setRecoveryPickerMode] = useState(null);
  const [recoveryPermutationType, setRecoveryPermutationType] =
    useState("Leave");
  const [recoveryNature, setRecoveryNature] = useState("");
  const [shouldPlanRecovery, setShouldPlanRecovery] = useState(false);
  const [recoveryStartDate, setRecoveryStartDate] = useState(() => new Date());
  const [recoveryEndDate, setRecoveryEndDate] = useState(() => new Date());
  const [showRecoveryStartDatePicker, setShowRecoveryStartDatePicker] =
    useState(false);
  const [showRecoveryEndDatePicker, setShowRecoveryEndDatePicker] =
    useState(false);
  const [recoverySlots, setRecoverySlots] = useState([
    {
      id: Date.now(),
      date: new Date(),
      startTime: null,
      endTime: null,
    },
  ]);

  const openCreateModal = route?.params?.openCreateModal === true;
  const routeCategory = route?.params?.category;
  const selectedCategoryLabel = getCategoryLabel(category);

  const isExitAuthorization = category === EXIT_AUTHORIZATION_CATEGORY;
  const isRecovery = category === RECOVERY_CATEGORY;
  const isRemoteWork = category === REMOTE_WORK_CATEGORY;
  const isDocumentRequest = category === DOCUMENT_CATEGORY;
  const isOtherDocument = documentType === "Autre";
  const isRecoveryAuthorization = recoveryPermutationType === "Authorization";

  const totalMinutes = calculateDurationMinutes(startTime, endTime);
  const formattedTotalDuration = formatDuration(totalMinutes);

  const totalRecoveryMinutes = recoverySlots.reduce((total, slot) => {
    if (!slot.startTime || !slot.endTime) return total;
    return total + Math.max(0, calculateDurationMinutes(slot.startTime, slot.endTime));
  }, 0);

  const recoveryDayCount = useMemo(() => {
    if (!recoveryStartDate || !recoveryEndDate) return 0;
    const diff =
      normalizeDateOnly(recoveryEndDate) - normalizeDateOnly(recoveryStartDate);
    return Math.max(1, Math.floor(diff / (1000 * 60 * 60 * 24)) + 1);
  }, [recoveryStartDate, recoveryEndDate]);

  const requiredRecoveryMinutes = useMemo(() => {
    if (isRecoveryAuthorization) {
      const authorizationMinutes = calculateDurationMinutes(startTime, endTime);
      return authorizationMinutes && authorizationMinutes > 0
        ? authorizationMinutes
        : 0;
    }

    if (!recoveryStartDate || !recoveryEndDate || !recoveryNature) return 0;
    if (recoveryNature === "HalfDay") return 4 * 60;
    return recoveryDayCount * 8 * 60;
  }, [
    endTime,
    isRecoveryAuthorization,
    recoveryDayCount,
    recoveryEndDate,
    recoveryNature,
    recoveryStartDate,
    startTime,
  ]);

  const loadRequests = useCallback(
    async (isRefresh = false) => {
      try {
        if (isRefresh) setRefreshing(true);
        else setLoading(true);

        const response = await requestService.getMyGeneralRequests();
        setRequests(normalizePayload(response));
      } catch (error) {
        showFeedback({
          type: "error",
          title: "Chargement impossible",
          message: error?.message || "Impossible de charger vos demandes.",
          confirmText: "OK",
        });
        setRequests([]);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [showFeedback],
  );

  useFocusEffect(
    useCallback(() => {
      loadRequests();
    }, [loadRequests]),
  );

  const resetFormFields = useCallback(() => {
    setSubmitAttempted(false);
    setTitle("");
    setDescription("");
    setAuthorizedDate(new Date());
    setStartTime(null);
    setEndTime(null);
    setMotif("");
    setRemoteWorkRequestText("");
    setDocumentType("");
    setDocumentSubject("");
    setDocumentRequestText("");
    setRecoveryPermutationType("Leave");
    setRecoveryNature("");
    setShouldPlanRecovery(false);
    setRecoveryStartDate(new Date());
    setRecoveryEndDate(new Date());
    setShowAuthorizedDatePicker(false);
    setShowStartTimePicker(false);
    setShowEndTimePicker(false);
    setShowRecoveryStartDatePicker(false);
    setShowRecoveryEndDatePicker(false);
    setEditingRecoverySlot(null);
    setRecoveryPickerMode(null);
    setRecoverySlots([
      {
        id: Date.now(),
        date: new Date(),
        startTime: null,
        endTime: null,
      },
    ]);
  }, []);

  useEffect(() => {
    if (openCreateModal) {
      resetFormFields();
      setCategory(getCategoryValue(routeCategory));
      setModalVisible(true);
      navigation.setParams({ openCreateModal: false, category: undefined });
    }
  }, [openCreateModal, routeCategory, navigation, resetFormFields]);

  const resetForm = () => {
    resetFormFields();
    setModalVisible(false);
  };

  const updateRecoverySlot = (slotId, field, value) => {
    setRecoverySlots((current) =>
      current.map((slot) =>
        slot.id === slotId ? { ...slot, [field]: value } : slot,
      ),
    );
  };

  const addRecoverySlot = () => {
    setRecoverySlots((current) => [
      ...current,
      {
        id: Date.now() + Math.random(),
        date: new Date(),
        startTime: null,
        endTime: null,
      },
    ]);
  };

  const removeRecoverySlot = (id) => {
    setRecoverySlots((current) => current.filter((slot) => slot.id !== id));
  };

  const openRecoveryPicker = (slotId, mode) => {
    setEditingRecoverySlot(slotId);
    setRecoveryPickerMode(mode);
  };

  const closeRecoveryPicker = () => {
    setEditingRecoverySlot(null);
    setRecoveryPickerMode(null);
  };

  const selectedRecoverySlot = recoverySlots.find(
    (slot) => slot.id === editingRecoverySlot,
  );

  const validationErrors = useMemo(() => {
    if (isExitAuthorization) {
      const errors = {};
      const cleanMotif = motif.trim();

      if (!authorizedDate) {
        errors.authorizedDate = "La date de l'autorisation est obligatoire.";
      } else if (normalizeDateOnly(authorizedDate) < normalizeDateOnly(new Date())) {
        errors.authorizedDate =
          "La date de l'autorisation ne peut pas être dans le passé.";
      }

      if (!startTime) errors.startTime = "L'heure de début est obligatoire.";
      if (!endTime) errors.endTime = "L'heure de fin est obligatoire.";

      if (startTime && endTime) {
        if (totalMinutes <= 0) {
          errors.endTime = "L'heure de fin doit être supérieure à l'heure de début.";
        } else if (totalMinutes > 120) {
          errors.totalMinutes = "Le temps global ne peut pas dépasser 2 heures.";
        }
      }

      if (!cleanMotif) {
        errors.motif = "Le motif est obligatoire.";
      } else if (cleanMotif.length < 10) {
        errors.motif = "Le motif doit contenir au moins 10 caractères.";
      }

      return errors;
    }

    if (isRecovery) {
      const errors = {};
      const cleanMotif = motif.trim();

      if (isRecoveryAuthorization) {
        if (!authorizedDate) {
          errors.authorizedDate = "La date de l'autorisation est obligatoire.";
        }

        if (!startTime) errors.startTime = "L'heure de début est obligatoire.";
        if (!endTime) errors.endTime = "L'heure de fin est obligatoire.";

        if (startTime && endTime && requiredRecoveryMinutes <= 0) {
          errors.endTime =
            "L'heure de fin doit être supérieure à l'heure de début.";
        }
      } else {
        if (!recoveryStartDate) {
          errors.recoveryStartDate = "La date de début est obligatoire.";
        }

        if (!recoveryEndDate) {
          errors.recoveryEndDate = "La date de fin est obligatoire.";
        } else if (
          recoveryStartDate &&
          normalizeDateOnly(recoveryEndDate) < normalizeDateOnly(recoveryStartDate)
        ) {
          errors.recoveryEndDate =
            "La date de fin doit être après la date de début.";
        }

        if (!recoveryNature) {
          errors.recoveryNature =
            "Veuillez sélectionner la nature de la demande.";
        }
      }

      if (!cleanMotif) {
        errors.motif = "Le motif est obligatoire.";
      } else if (cleanMotif.length < 10) {
        errors.motif = "Le motif doit contenir au moins 10 caractères.";
      }

      const invalidSlot = recoverySlots.some(
        (slot) =>
          !slot.date ||
          !slot.startTime ||
          !slot.endTime ||
          calculateDurationMinutes(slot.startTime, slot.endTime) <= 0,
      );

      if (shouldPlanRecovery && invalidSlot) {
        errors.recoverySlots =
          "Chaque créneau doit contenir une date, une heure de début et une heure de fin valide.";
      }

      if (shouldPlanRecovery && totalRecoveryMinutes <= 0) {
        errors.totalRecoveryMinutes =
          "Le temps total récupéré doit être supérieur à 0.";
      } else if (
        shouldPlanRecovery &&
        requiredRecoveryMinutes > 0 &&
        totalRecoveryMinutes !== requiredRecoveryMinutes
      ) {
        errors.totalRecoveryMinutes = `Le total planifié doit être égal au temps à récupérer (${formatDurationClock(
          requiredRecoveryMinutes,
        )}).`;
      }

      return errors;
    }

    if (isRemoteWork) {
      const errors = {};
      const cleanRequestText = remoteWorkRequestText.trim();

      if (!cleanRequestText) {
        errors.remoteWorkRequestText = "La demande est obligatoire.";
      } else if (cleanRequestText.length < 10) {
        errors.remoteWorkRequestText =
          "La demande doit contenir au moins 10 caractères.";
      }

      return errors;
    }

    if (isDocumentRequest) {
      const errors = {};
      const cleanSubject = documentSubject.trim();
      const cleanRequestText = documentRequestText.trim();

      if (!documentType) {
        errors.documentType = "Veuillez sélectionner un type de document.";
      }

      if (isOtherDocument) {
        if (!cleanSubject) {
          errors.documentSubject = "L'objet est obligatoire.";
        } else if (cleanSubject.length < 5) {
          errors.documentSubject = "L'objet doit contenir au moins 5 caractères.";
        }

        if (!cleanRequestText) {
          errors.documentRequestText = "La demande est obligatoire.";
        } else if (cleanRequestText.length < 10) {
          errors.documentRequestText =
            "La demande doit contenir au moins 10 caractères.";
        }
      }

      return errors;
    }

    const cleanTitle = title.trim();
    const cleanDescription = description.trim();
    const errors = {};

    if (!cleanTitle || !cleanDescription) {
      errors.form = "Veuillez remplir le titre, la catégorie et la description.";
      return errors;
    }

    if (cleanTitle.length < 3) {
      errors.title = "Le titre doit contenir au moins 3 caractères.";
    }

    if (cleanDescription.length < 10) {
      errors.description = "La description doit contenir au moins 10 caractères.";
    }

    return errors;
  }, [
    authorizedDate,
    startTime,
    endTime,
    isExitAuthorization,
    isRecovery,
    isRemoteWork,
    isDocumentRequest,
    isOtherDocument,
    motif,
    remoteWorkRequestText,
    documentType,
    documentSubject,
    documentRequestText,
    title,
    description,
    totalMinutes,
    authorizedDate,
    isRecoveryAuthorization,
    recoveryNature,
    recoveryEndDate,
    recoveryStartDate,
    requiredRecoveryMinutes,
    recoverySlots,
    shouldPlanRecovery,
    totalRecoveryMinutes,
  ]);

  const validationMessage = useMemo(
    () => Object.values(validationErrors)[0] ?? null,
    [validationErrors],
  );

  const handleSubmit = async () => {
    setSubmitAttempted(true);

    if (validationMessage) {
      showFeedback({
        type: "error",
        title: "Vérification requise",
        message: validationMessage,
        confirmText: "Ok",
      });
      return;
    }

    try {
      setSaving(true);
      let payload;

      if (isExitAuthorization) {
        payload = {
          title: "Autorisation de sortie",
          description: motif.trim(),
          category,
          authorizedDate: formatDateOnlyLocal(authorizedDate),
          startTime: formatTimePayload(startTime),
          endTime: formatTimePayload(endTime),
          totalMinutes,
          motif: motif.trim(),
        };
      } else if (isRecovery) {
        payload = {
          title: "Demande de récupération",
          description: motif.trim(),
          category,
          requestType: "Recovery",
          recoveryPermutationType,
          requiredRecoveryMinutes,
          ...(isRecoveryAuthorization
            ? {
                authorizedDate: formatDateOnlyLocal(authorizedDate),
                startTime: formatTimePayload(startTime),
                endTime: formatTimePayload(endTime),
              }
            : {
                startDate: formatDateOnlyLocal(recoveryStartDate),
                endDate: formatDateOnlyLocal(recoveryEndDate),
                numberOfDays: recoveryDayCount,
                recoveryNature,
              }),
          motif: motif.trim(),
          totalRecoveryMinutes: shouldPlanRecovery ? totalRecoveryMinutes : 0,
          recoverySlots: shouldPlanRecovery
            ? recoverySlots.map((slot) => ({
                date: formatDateOnlyLocal(slot.date),
                startTime: formatTimePayload(slot.startTime),
                endTime: formatTimePayload(slot.endTime),
                minutes: calculateDurationMinutes(slot.startTime, slot.endTime),
              }))
            : [],
        };
      } else if (isRemoteWork) {
        payload = {
          title: "Télétravail",
          description: remoteWorkRequestText.trim(),
          category,
          requestType: "RemoteWork",
          requestText: remoteWorkRequestText.trim(),
        };
      } else if (isDocumentRequest) {
        payload = {
          title: documentType === "Autre" ? documentSubject.trim() : documentType,
          description:
            documentType === "Autre"
              ? documentRequestText.trim()
              : `Demande de document : ${documentType}`,
          category,
          requestType: "Documents",
          documentType,
          ...(documentType === "Autre"
            ? {
                subject: documentSubject.trim(),
                requestText: documentRequestText.trim(),
              }
            : {}),
        };
      } else {
        payload = {
          title: title.trim(),
          description: description.trim(),
          category,
        };
      }

      const response = await requestService.createGeneralRequest(payload);

      if (response?.success === false) {
        showFeedback({
          type: "error",
          title: "Envoi impossible",
          message: response?.message || "Impossible de créer la demande.",
          confirmText: "OK",
        });
        return;
      }

      resetForm();
      triggerRefresh?.();
      await loadRequests();
      showFeedback({
        type: "success",
        title: "Demande envoyée",
        message: "Votre demande a été envoyée.",
        confirmText: "OK",
      });
    } catch (error) {
      showFeedback({
        type: "error",
        title: "Envoi impossible",
        message: error?.message || "Impossible de créer la demande.",
        confirmText: "OK",
      });
    } finally {
      setSaving(false);
    }
  };

  const pendingCount = requests.filter((item) => {
    const status = String(item.status ?? item.Status).toLowerCase();
    return status === "1" || status === "pending";
  }).length;

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => loadRequests(true)}
            tintColor={colors.primary}
          />
        }
      >
        <View style={styles.hero}>
          <View style={styles.heroIcon}>
            <Ionicons
              name="document-text-outline"
              size={24}
              color={colors.textOnPrimary}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.heroTitle}>Demandes générales</Text>
            <Text style={styles.heroSubtitle}>
              Créez une demande et suivez son traitement par l'équipe admin.
            </Text>
          </View>
        </View>

        <View style={styles.summaryRow}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryValue}>{requests.length}</Text>
            <Text style={styles.summaryLabel}>Total</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryValue}>{pendingCount}</Text>
            <Text style={styles.summaryLabel}>En attente</Text>
          </View>
        </View>

        <TouchableOpacity
          testID="generalRequest.openCreateButton"
          style={styles.createButton}
          onPress={() => {
            setSubmitAttempted(false);
            setModalVisible(true);
          }}
          activeOpacity={0.86}
        >
          <Ionicons name="add-circle-outline" size={20} color="#fff" />
          <Text style={styles.createButtonText}>Nouvelle demande</Text>
        </TouchableOpacity>

        <Text style={styles.sectionTitle}>Mes demandes</Text>

        {loading ? (
          <View style={styles.loader}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={styles.loaderText}>Chargement des demandes...</Text>
          </View>
        ) : requests.length === 0 ? (
          <View style={styles.emptyCard}>
            <Ionicons
              name="file-tray-outline"
              size={28}
              color={colors.textSecondary}
            />
            <Text style={styles.emptyTitle}>Aucune demande</Text>
            <Text style={styles.emptyBody}>
              Vos demandes générales apparaîtront ici après création.
            </Text>
          </View>
        ) : (
          requests.map((item) => {
            const id = item.id ?? item.Id;
            const itemTitle = item.title ?? item.Title ?? "Sans titre";
            const itemDescription = item.description ?? item.Description ?? "";
            const itemCategory = item.category ?? item.Category;
            const itemStatus = item.status ?? item.Status;
            const createdAt = item.createdAt ?? item.CreatedAt;
            const tone = getStatusTone(itemStatus);

            return (
              <View key={id} style={styles.requestCard}>
                <View style={styles.requestHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.requestTitle} numberOfLines={2}>
                      {itemTitle}
                    </Text>
                    <Text style={styles.requestMeta}>
                      {getCategoryLabel(itemCategory)}
                      {createdAt ? ` - ${formatDate(createdAt)}` : ""}
                    </Text>
                  </View>

                  <View style={[styles.statusBadge, styles[`${tone}Badge`]]}>
                    <Text style={[styles.statusText, styles[`${tone}Text`]]}>
                      {getStatusLabel(itemStatus)}
                    </Text>
                  </View>
                </View>

                <Text style={styles.requestDescription} numberOfLines={4}>
                  {itemDescription}
                </Text>
              </View>
            );
          })
        )}
      </ScrollView>

      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent
        onRequestClose={resetForm}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.modalOverlay}
        >
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{selectedCategoryLabel}</Text>
              <View
                testID={`generalRequest.category.${category}`}
                style={styles.e2eHiddenMarker}
              />
              <TouchableOpacity
                style={styles.closeButton}
                onPress={resetForm}
                disabled={saving}
              >
                <Ionicons name="close" size={22} color={colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.modalScrollContent}
            >
              {isExitAuthorization ? (
                <>
                  <Text style={styles.inputLabel}>Autorisé le</Text>
                  <Pressable
                    testID="generalRequest.authorizedDatePicker"
                    style={styles.pickerField}
                    onPress={() => setShowAuthorizedDatePicker(true)}
                  >
                    <Ionicons
                      name="calendar-outline"
                      size={18}
                      color={colors.textSecondary}
                    />
                    <Text
                      style={[
                        styles.pickerText,
                        !authorizedDate && styles.placeholderText,
                      ]}
                    >
                      {authorizedDate
                        ? formatDateValue(authorizedDate)
                        : "Sélectionner une date"}
                    </Text>
                  </Pressable>
                  {submitAttempted && !!validationErrors.authorizedDate && (
                    <Text style={styles.fieldErrorText}>
                      {validationErrors.authorizedDate}
                    </Text>
                  )}

                  {showAuthorizedDatePicker && (
                    <DateTimePicker
                      value={authorizedDate || new Date()}
                      mode="date"
                      display={Platform.OS === "ios" ? "spinner" : "default"}
                      minimumDate={new Date()}
                      onChange={(event, date) => {
                        setShowAuthorizedDatePicker(false);
                        if (event.type === "dismissed") return;
                        setAuthorizedDate(date);
                      }}
                    />
                  )}

                  <View style={styles.timeRow}>
                    <View style={styles.timeColumn}>
                      <Text style={styles.inputLabel}>De</Text>
                      <Pressable
                        testID="generalRequest.startTimePicker"
                        style={styles.pickerField}
                        onPress={() => setShowStartTimePicker(true)}
                      >
                        <Ionicons
                          name="time-outline"
                          size={18}
                          color={colors.textSecondary}
                        />
                        <Text
                          style={[
                            styles.pickerText,
                            !startTime && styles.placeholderText,
                          ]}
                        >
                          {startTime ? formatTimeValue(startTime) : "Début"}
                        </Text>
                      </Pressable>
                      {submitAttempted && !!validationErrors.startTime && (
                        <Text style={styles.fieldErrorText}>
                          {validationErrors.startTime}
                        </Text>
                      )}
                    </View>

                    <View style={styles.timeColumn}>
                      <Text style={styles.inputLabel}>À</Text>
                      <Pressable
                        testID="generalRequest.endTimePicker"
                        style={styles.pickerField}
                        onPress={() => setShowEndTimePicker(true)}
                      >
                        <Ionicons
                          name="time-outline"
                          size={18}
                          color={colors.textSecondary}
                        />
                        <Text
                          style={[
                            styles.pickerText,
                            !endTime && styles.placeholderText,
                          ]}
                        >
                          {endTime ? formatTimeValue(endTime) : "Fin"}
                        </Text>
                      </Pressable>
                      {submitAttempted && !!validationErrors.endTime && (
                        <Text style={styles.fieldErrorText}>
                          {validationErrors.endTime}
                        </Text>
                      )}
                    </View>
                  </View>

                  {showStartTimePicker && (
                    <DateTimePicker
                      value={startTime || new Date()}
                      mode="time"
                      display={Platform.OS === "ios" ? "spinner" : "default"}
                      onChange={(event, date) => {
                        setShowStartTimePicker(false);
                        if (event.type === "dismissed") return;
                        setStartTime(date);
                      }}
                    />
                  )}

                  {showEndTimePicker && (
                    <DateTimePicker
                      value={endTime || startTime || new Date()}
                      mode="time"
                      display={Platform.OS === "ios" ? "spinner" : "default"}
                      onChange={(event, date) => {
                        setShowEndTimePicker(false);
                        if (event.type === "dismissed") return;
                        setEndTime(date);
                      }}
                    />
                  )}

                  <Text style={styles.inputLabel}>Temps global</Text>
                  <TextInput
                    testID="generalRequest.totalTimeInput"
                    value={formattedTotalDuration}
                    editable={false}
                    placeholder="Calcul automatique"
                    placeholderTextColor={colors.placeholder}
                    style={[styles.input, styles.readOnlyInput]}
                  />
                  {submitAttempted && !!validationErrors.totalMinutes && (
                    <Text style={styles.fieldErrorText}>
                      {validationErrors.totalMinutes}
                    </Text>
                  )}

                  <Text style={styles.inputLabel}>Motif</Text>
                  <TextInput
                    testID="generalRequest.motifInput"
                    value={motif}
                    onChangeText={setMotif}
                    placeholder="Expliquez le motif de sortie..."
                    placeholderTextColor={colors.placeholder}
                    style={[styles.input, styles.textArea]}
                    multiline
                    textAlignVertical="top"
                    maxLength={600}
                  />
                  {submitAttempted && !!validationErrors.motif && (
                    <Text style={styles.fieldErrorText}>
                      {validationErrors.motif}
                    </Text>
                  )}
                </>
              ) : isRecovery ? (
                <>
                  <View style={styles.recoveryHeaderCard}>
                    <View style={styles.recoveryHeaderIcon}>
                      <Ionicons
                        name="refresh-circle-outline"
                        size={26}
                        color={colors.primary}
                      />
                    </View>
                    <View style={styles.recoveryHeaderText}>
                      <Text style={styles.recoveryTitle}>
                        Demande de récupération
                      </Text>
                      <Text style={styles.recoverySubtitle}>
                        Saisissez les informations de votre demande de
                        récupération
                      </Text>
                    </View>
                  </View>

                  <View style={styles.recoverySegmentedControl}>
                    {RECOVERY_PERMUTATION_TYPES.map((item) => {
                      const selected = recoveryPermutationType === item.value;

                      return (
                        <TouchableOpacity
                          key={item.value}
                          style={[
                            styles.recoverySegmentButton,
                            selected && styles.recoverySegmentButtonActive,
                          ]}
                          activeOpacity={0.86}
                          onPress={() => setRecoveryPermutationType(item.value)}
                        >
                          <Text
                            style={[
                              styles.recoverySegmentText,
                              selected && styles.recoverySegmentTextActive,
                            ]}
                          >
                            {item.label}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  <View style={styles.recoveryTotalCard}>
                    <View>
                      <Text style={styles.recoveryTotalLabel}>
                        Temps total
                      </Text>
                      <Text style={styles.recoveryTotalValue}>
                        {formatDurationClock(totalRecoveryMinutes)}
                      </Text>
                    </View>
                    <Ionicons
                      name="time-outline"
                      size={24}
                      color={colors.warning}
                    />
                  </View>

                  {isRecoveryAuthorization && (
                    <>
                      <Text style={styles.inputLabel}>Autorisé le</Text>
                      <Pressable
                        style={styles.pickerField}
                        onPress={() => setShowAuthorizedDatePicker(true)}
                      >
                        <Ionicons
                          name="calendar-outline"
                          size={18}
                          color={colors.textSecondary}
                        />
                        <Text
                          style={[
                            styles.pickerText,
                            !authorizedDate && styles.placeholderText,
                          ]}
                        >
                          {authorizedDate
                            ? formatDateValue(authorizedDate)
                            : "Sélectionner une date"}
                        </Text>
                      </Pressable>
                      {submitAttempted && !!validationErrors.authorizedDate && (
                        <Text style={styles.fieldErrorText}>
                          {validationErrors.authorizedDate}
                        </Text>
                      )}

                      {showAuthorizedDatePicker && (
                        <DateTimePicker
                          value={authorizedDate || new Date()}
                          mode="date"
                          display={Platform.OS === "ios" ? "spinner" : "default"}
                          minimumDate={new Date()}
                          onChange={(event, date) => {
                            setShowAuthorizedDatePicker(false);
                            if (event.type === "dismissed") return;
                            setAuthorizedDate(date);
                          }}
                        />
                      )}

                      <View style={styles.timeRow}>
                        <View style={styles.timeColumn}>
                          <Text style={styles.inputLabel}>De</Text>
                          <Pressable
                            style={styles.pickerField}
                            onPress={() => setShowStartTimePicker(true)}
                          >
                            <Ionicons
                              name="time-outline"
                              size={18}
                              color={colors.textSecondary}
                            />
                            <Text
                              style={[
                                styles.pickerText,
                                !startTime && styles.placeholderText,
                              ]}
                            >
                              {startTime ? formatTimeValue(startTime) : "Début"}
                            </Text>
                          </Pressable>
                          {submitAttempted && !!validationErrors.startTime && (
                            <Text style={styles.fieldErrorText}>
                              {validationErrors.startTime}
                            </Text>
                          )}
                        </View>

                        <View style={styles.timeColumn}>
                          <Text style={styles.inputLabel}>À</Text>
                          <Pressable
                            style={styles.pickerField}
                            onPress={() => setShowEndTimePicker(true)}
                          >
                            <Ionicons
                              name="time-outline"
                              size={18}
                              color={colors.textSecondary}
                            />
                            <Text
                              style={[
                                styles.pickerText,
                                !endTime && styles.placeholderText,
                              ]}
                            >
                              {endTime ? formatTimeValue(endTime) : "Fin"}
                            </Text>
                          </Pressable>
                          {submitAttempted && !!validationErrors.endTime && (
                            <Text style={styles.fieldErrorText}>
                              {validationErrors.endTime}
                            </Text>
                          )}
                        </View>
                      </View>

                      {showStartTimePicker && (
                        <DateTimePicker
                          value={startTime || new Date()}
                          mode="time"
                          display={Platform.OS === "ios" ? "spinner" : "default"}
                          onChange={(event, date) => {
                            setShowStartTimePicker(false);
                            if (event.type === "dismissed") return;
                            setStartTime(date);
                          }}
                        />
                      )}

                      {showEndTimePicker && (
                        <DateTimePicker
                          value={endTime || startTime || new Date()}
                          mode="time"
                          display={Platform.OS === "ios" ? "spinner" : "default"}
                          onChange={(event, date) => {
                            setShowEndTimePicker(false);
                            if (event.type === "dismissed") return;
                            setEndTime(date);
                          }}
                        />
                      )}
                    </>
                  )}

                  {!isRecoveryAuthorization && (
                    <>
                  <View style={styles.recoveryDateGrid}>
                    <View style={styles.recoveryDateField}>
                      <Text style={styles.inputLabel}>Date début</Text>
                      <Pressable
                        style={styles.pickerField}
                        onPress={() => setShowRecoveryStartDatePicker(true)}
                      >
                        <Ionicons
                          name="calendar-outline"
                          size={18}
                          color={colors.textSecondary}
                        />
                        <Text style={styles.pickerText}>
                          {formatDateValue(recoveryStartDate)}
                        </Text>
                      </Pressable>
                    </View>

                    <View style={styles.recoveryDateField}>
                      <Text style={styles.inputLabel}>Date fin</Text>
                      <Pressable
                        style={styles.pickerField}
                        onPress={() => setShowRecoveryEndDatePicker(true)}
                      >
                        <Ionicons
                          name="calendar-outline"
                          size={18}
                          color={colors.textSecondary}
                        />
                        <Text style={styles.pickerText}>
                          {formatDateValue(recoveryEndDate)}
                        </Text>
                      </Pressable>
                    </View>
                  </View>

                  {showRecoveryStartDatePicker && (
                    <DateTimePicker
                      value={recoveryStartDate || new Date()}
                      mode="date"
                      display={Platform.OS === "ios" ? "spinner" : "default"}
                      minimumDate={new Date()}
                      onChange={(event, date) => {
                        setShowRecoveryStartDatePicker(false);
                        if (event.type === "dismissed") return;
                        setRecoveryStartDate(date);
                        if (recoveryEndDate && date && recoveryEndDate < date) {
                          setRecoveryEndDate(date);
                        }
                      }}
                    />
                  )}

                  {showRecoveryEndDatePicker && (
                    <DateTimePicker
                      value={recoveryEndDate || recoveryStartDate || new Date()}
                      mode="date"
                      display={Platform.OS === "ios" ? "spinner" : "default"}
                      minimumDate={recoveryStartDate || new Date()}
                      onChange={(event, date) => {
                        setShowRecoveryEndDatePicker(false);
                        if (event.type === "dismissed") return;
                        setRecoveryEndDate(date);
                      }}
                    />
                  )}

                  <View style={styles.recoveryNatureGrid}>
                    <View style={styles.recoveryDayCountBox}>
                      <Text style={styles.inputLabel}>Nombre de jours</Text>
                      <View style={styles.recoveryReadOnlyDuration}>
                        <Text style={styles.recoveryReadOnlyDurationText}>
                          {recoveryDayCount}{" "}
                          {recoveryDayCount === 1 ? "jour" : "jours"}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.recoveryNatureField}>
                      <Text style={styles.inputLabel}>Nature de demande</Text>
                      <View style={styles.pickerWrap}>
                        <Picker
                          selectedValue={recoveryNature}
                          onValueChange={setRecoveryNature}
                          style={styles.picker}
                        >
                          <Picker.Item
                            label="Sélectionner une nature"
                            value=""
                          />
                          {RECOVERY_NATURES.map((item) => (
                            <Picker.Item
                              key={item.value}
                              label={item.label}
                              value={item.value}
                            />
                          ))}
                        </Picker>
                      </View>
                      {submitAttempted && !!validationErrors.recoveryNature && (
                        <Text style={styles.fieldErrorText}>
                          {validationErrors.recoveryNature}
                        </Text>
                      )}
                    </View>
                  </View>
                    </>
                  )}

                  <View style={styles.recoveryRequiredBadge}>
                    <Ionicons
                      name="stopwatch-outline"
                      size={16}
                      color={colors.warning}
                    />
                    <Text style={styles.recoveryRequiredBadgeText}>
                      Temps à récupérer{" "}
                      {formatDurationClock(requiredRecoveryMinutes)}
                    </Text>
                  </View>

                  <Text style={styles.inputLabel}>Motif</Text>
                  <TextInput
                    testID="generalRequest.recoveryMotifInput"
                    value={motif}
                    onChangeText={setMotif}
                    placeholder="Expliquez le motif de récupération..."
                    placeholderTextColor={colors.placeholder}
                    style={[styles.input, styles.textArea]}
                    multiline
                    textAlignVertical="top"
                    maxLength={600}
                  />
                  {submitAttempted && !!validationErrors.motif && (
                    <Text style={styles.fieldErrorText}>
                      {validationErrors.motif}
                    </Text>
                  )}

                  <TouchableOpacity
                    style={styles.recoveryPlanSection}
                    activeOpacity={0.85}
                    onPress={() => setShouldPlanRecovery((current) => !current)}
                  >
                    <View
                      style={[
                        styles.recoveryPlanCheck,
                        !shouldPlanRecovery && styles.recoveryPlanCheckEmpty,
                      ]}
                    >
                      <Ionicons
                        name={shouldPlanRecovery ? "checkmark" : "square-outline"}
                        size={shouldPlanRecovery ? 14 : 18}
                        color={
                          shouldPlanRecovery
                            ? colors.textOnPrimary
                            : colors.textSecondary
                        }
                      />
                    </View>
                    <View style={styles.recoveryHeaderText}>
                      <Text style={styles.recoveryPlannerTitle}>
                        Planifier la période de récupération
                      </Text>
                      <Text style={styles.recoveryPlanText}>
                        Ajoutez un ou plusieurs créneaux jusqu'à atteindre le
                        temps à récupérer.
                      </Text>
                    </View>
                  </TouchableOpacity>

                  {shouldPlanRecovery && (
                    <>
                      <View style={styles.recoveryPlannerHeader}>
                        <Text style={styles.recoveryPlannerTitle}>
                          Créneaux à récupérer
                        </Text>
                        <Text style={styles.recoveryPlannerCount}>
                          {recoverySlots.length} créneau
                          {recoverySlots.length > 1 ? "x" : ""}
                        </Text>
                      </View>

                      {recoverySlots.map((slot, index) => {
                        const slotMinutes =
                          slot.startTime && slot.endTime
                            ? calculateDurationMinutes(slot.startTime, slot.endTime)
                            : 0;
                        const validSlotMinutes = Math.max(0, slotMinutes || 0);

                        return (
                        <View key={slot.id} style={styles.recoverySlotCard}>
                          <View style={styles.recoverySlotHeader}>
                            <Text style={styles.recoverySlotTitle}>
                              Créneau {index + 1}
                            </Text>
                            <View style={styles.recoveryDurationChip}>
                              <Ionicons
                                name="hourglass-outline"
                                size={14}
                                color={colors.warning}
                              />
                              <Text style={styles.recoveryDurationText}>
                                Durée : {formatDurationClock(validSlotMinutes)}
                              </Text>
                            </View>
                          </View>

                          <View style={styles.recoveryDateRow}>
                            <Text style={styles.inputLabel}>Le</Text>
                            <Pressable
                              style={styles.pickerField}
                              onPress={() => openRecoveryPicker(slot.id, "date")}
                            >
                              <Ionicons
                                name="calendar-outline"
                                size={18}
                                color={colors.textSecondary}
                              />
                              <Text style={styles.pickerText}>
                                {formatDateValue(slot.date)}
                              </Text>
                            </Pressable>
                          </View>

                          <View style={styles.recoveryTimeGrid}>
                            <View style={styles.recoveryTimeField}>
                              <Text style={styles.inputLabel}>De</Text>
                              <Pressable
                                style={styles.pickerField}
                                onPress={() =>
                                  openRecoveryPicker(slot.id, "startTime")
                                }
                              >
                                <Ionicons
                                  name="time-outline"
                                  size={18}
                                  color={colors.textSecondary}
                                />
                                <Text
                                  style={[
                                    styles.pickerText,
                                    !slot.startTime && styles.placeholderText,
                                  ]}
                                >
                                  {slot.startTime
                                    ? formatTimeValue(slot.startTime)
                                    : "Début"}
                                </Text>
                              </Pressable>
                            </View>

                            <View style={styles.recoveryTimeField}>
                              <Text style={styles.inputLabel}>À</Text>
                              <Pressable
                                style={styles.pickerField}
                                onPress={() =>
                                  openRecoveryPicker(slot.id, "endTime")
                                }
                              >
                                <Ionicons
                                  name="time-outline"
                                  size={18}
                                  color={colors.textSecondary}
                                />
                                <Text
                                  style={[
                                    styles.pickerText,
                                    !slot.endTime && styles.placeholderText,
                                  ]}
                                >
                                  {slot.endTime
                                    ? formatTimeValue(slot.endTime)
                                    : "Fin"}
                                </Text>
                              </Pressable>
                            </View>

                            <View style={styles.recoveryTimeField}>
                              <Text style={styles.inputLabel}>Durée</Text>
                              <View style={styles.recoveryReadOnlyDuration}>
                                <Text style={styles.recoveryReadOnlyDurationText}>
                                  {formatDurationClock(validSlotMinutes)}
                                </Text>
                              </View>
                            </View>
                          </View>

                          <TouchableOpacity
                            style={[
                              styles.deleteSlotButton,
                              recoverySlots.length === 1 &&
                                styles.deleteSlotButtonDisabled,
                            ]}
                            onPress={() => removeRecoverySlot(slot.id)}
                            disabled={recoverySlots.length === 1}
                          >
                            <Ionicons
                              name="trash-outline"
                              size={18}
                              color={colors.textOnPrimary}
                            />
                            <Text style={styles.deleteSlotButtonText}>
                              Supprimer
                            </Text>
                          </TouchableOpacity>
                        </View>
                        );
                      })}

                      {editingRecoverySlot && recoveryPickerMode && (
                        <DateTimePicker
                          value={
                            selectedRecoverySlot?.[
                              recoveryPickerMode === "date"
                                ? "date"
                                : recoveryPickerMode
                            ] || new Date()
                          }
                          mode={recoveryPickerMode === "date" ? "date" : "time"}
                          display={Platform.OS === "ios" ? "spinner" : "default"}
                          minimumDate={
                            recoveryPickerMode === "date" ? new Date() : undefined
                          }
                          onChange={(event, selectedValue) => {
                            if (event.type === "dismissed") {
                              closeRecoveryPicker();
                              return;
                            }

                            if (selectedValue) {
                              updateRecoverySlot(
                                editingRecoverySlot,
                                recoveryPickerMode,
                                selectedValue,
                              );
                            }

                            closeRecoveryPicker();
                          }}
                        />
                      )}

                      {submitAttempted && !!validationErrors.recoverySlots && (
                        <Text style={styles.fieldErrorText}>
                          {validationErrors.recoverySlots}
                        </Text>
                      )}

                      {submitAttempted && !!validationErrors.totalRecoveryMinutes && (
                        <Text style={styles.fieldErrorText}>
                          {validationErrors.totalRecoveryMinutes}
                        </Text>
                      )}

                      <TouchableOpacity
                        style={styles.addSlotButton}
                        onPress={addRecoverySlot}
                        activeOpacity={0.86}
                      >
                        <Ionicons
                          name="add-circle-outline"
                          size={20}
                          color={colors.textOnPrimary}
                        />
                        <Text style={styles.addSlotButtonText}>
                          Ajouter un créneau
                        </Text>
                      </TouchableOpacity>

                      <View style={styles.recoveryFinalSummary}>
                        <Text style={styles.recoveryFinalSummaryLabel}>
                          Total planifié
                        </Text>
                        <Text style={styles.recoveryFinalSummaryValue}>
                          {formatDurationClock(totalRecoveryMinutes)}
                        </Text>
                      </View>
                    </>
                  )}
                </>
              ) : isRemoteWork ? (
                <>
                  <Text style={styles.inputLabel}>Demande</Text>
                  <TextInput
                    testID="generalRequest.remoteWorkRequestInput"
                    value={remoteWorkRequestText}
                    onChangeText={setRemoteWorkRequestText}
                    placeholder="Expliquez votre demande de télétravail..."
                    placeholderTextColor={colors.placeholder}
                    style={[styles.input, styles.textArea]}
                    multiline
                    textAlignVertical="top"
                    maxLength={600}
                  />
                  {submitAttempted && !!validationErrors.remoteWorkRequestText && (
                    <Text style={styles.fieldErrorText}>
                      {validationErrors.remoteWorkRequestText}
                    </Text>
                  )}
                </>
              ) : isDocumentRequest ? (
                <>
                  <Text style={styles.inputLabel}>Type de document</Text>
                  <View style={styles.pickerWrap}>
                    <Picker
                      testID="generalRequest.documentTypePicker"
                      selectedValue={documentType}
                      onValueChange={setDocumentType}
                      dropdownIconColor={colors.textSecondary}
                      style={styles.picker}
                    >
                      <Picker.Item
                        label="Sélectionner un type de document"
                        value=""
                      />
                      {DOCUMENT_TYPES.map((item) => (
                        <Picker.Item key={item} label={item} value={item} />
                      ))}
                    </Picker>
                  </View>
                  {submitAttempted && !!validationErrors.documentType && (
                    <Text style={styles.fieldErrorText}>
                      {validationErrors.documentType}
                    </Text>
                  )}

                  {isOtherDocument && (
                    <>
                      <Text style={styles.inputLabel}>Objet</Text>
                      <TextInput
                        testID="generalRequest.documentSubjectInput"
                        value={documentSubject}
                        onChangeText={setDocumentSubject}
                        placeholder="Objet de votre demande"
                        placeholderTextColor={colors.placeholder}
                        style={styles.input}
                        maxLength={120}
                      />
                      {submitAttempted && !!validationErrors.documentSubject && (
                        <Text style={styles.fieldErrorText}>
                          {validationErrors.documentSubject}
                        </Text>
                      )}

                      <Text style={styles.inputLabel}>Demande</Text>
                      <TextInput
                        testID="generalRequest.documentRequestInput"
                        value={documentRequestText}
                        onChangeText={setDocumentRequestText}
                        placeholder="Expliquez votre demande..."
                        placeholderTextColor={colors.placeholder}
                        style={[styles.input, styles.textArea]}
                        multiline
                        textAlignVertical="top"
                        maxLength={600}
                      />
                      {submitAttempted && !!validationErrors.documentRequestText && (
                        <Text style={styles.fieldErrorText}>
                          {validationErrors.documentRequestText}
                        </Text>
                      )}
                    </>
                  )}
                </>
              ) : (
                <>
                  <Text style={styles.inputLabel}>Titre</Text>
                  <TextInput
                    testID="generalRequest.titleInput"
                    value={title}
                    onChangeText={setTitle}
                    placeholder="Ex: Problème d'accès badge"
                    placeholderTextColor={colors.placeholder}
                    style={styles.input}
                    maxLength={100}
                  />
                  {submitAttempted && !!validationErrors.title && (
                    <Text style={styles.fieldErrorText}>
                      {validationErrors.title}
                    </Text>
                  )}

                  <Text style={styles.inputLabel}>Description</Text>
                  <TextInput
                    testID="generalRequest.descriptionInput"
                    value={description}
                    onChangeText={setDescription}
                    placeholder="Expliquez votre demande..."
                    placeholderTextColor={colors.placeholder}
                    style={[styles.input, styles.textArea]}
                    multiline
                    textAlignVertical="top"
                    maxLength={600}
                  />
                  {submitAttempted && !!validationErrors.description && (
                    <Text style={styles.fieldErrorText}>
                      {validationErrors.description}
                    </Text>
                  )}
                </>
              )}

              {submitAttempted && !!validationErrors.form && (
                <Text style={styles.validationText}>
                  {validationErrors.form}
                </Text>
              )}

              <TouchableOpacity
                testID="generalRequest.submitButton"
                style={[
                  styles.submitButton,
                  saving && styles.submitButtonDisabled,
                ]}
                onPress={handleSubmit}
                disabled={saving}
                activeOpacity={0.86}
              >
                {saving ? (
                  <ActivityIndicator
                    size="small"
                    color={colors.textOnPrimary}
                  />
                ) : (
                  <>
                    <Ionicons
                      name="send-outline"
                      size={18}
                      color={colors.textOnPrimary}
                    />
                    <Text style={styles.submitButtonText}>Envoyer</Text>
                  </>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <FeedbackModal
        visible={feedback.visible}
        type={feedback.type}
        title={feedback.title}
        message={feedback.message}
        confirmText={feedback.confirmText}
        cancelText={feedback.cancelText}
        onConfirm={() => {
          feedback.onConfirm?.();
          hideFeedback();
        }}
        onCancel={() => {
          feedback.onCancel?.();
          hideFeedback();
        }}
      />
    </View>
  );
}

const createStyles = (colors, spacing, typography, borderRadius, shadows) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    e2eHiddenMarker: {
      width: 0,
      height: 0,
    },
    content: {
      padding: spacing.lg,
      paddingBottom: spacing.xxxl,
    },
    hero: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.md,
      backgroundColor: colors.surface,
      borderRadius: borderRadius.lg,
      padding: spacing.lg,
      marginBottom: spacing.md,
      ...shadows.sm,
    },
    heroIcon: {
      width: 48,
      height: 48,
      borderRadius: borderRadius.lg,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.primary,
    },
    heroTitle: {
      fontSize: typography.xl,
      fontFamily: typography.fontFamily?.bold,
      color: colors.text,
      marginBottom: 4,
    },
    heroSubtitle: {
      fontSize: typography.sm,
      fontFamily: typography.fontFamily?.regular,
      color: colors.textSecondary,
      lineHeight: 20,
    },
    summaryRow: {
      flexDirection: "row",
      gap: spacing.md,
      marginBottom: spacing.md,
    },
    summaryCard: {
      flex: 1,
      backgroundColor: colors.surface,
      borderRadius: borderRadius.lg,
      padding: spacing.md,
      ...shadows.sm,
    },
    summaryValue: {
      fontSize: 28,
      fontFamily: typography.fontFamily?.bold,
      color: colors.primary,
      lineHeight: 34,
    },
    summaryLabel: {
      fontSize: typography.sm,
      fontFamily: typography.fontFamily?.regular,
      color: colors.textSecondary,
    },
    createButton: {
      height: 48,
      borderRadius: borderRadius.md,
      backgroundColor: colors.primary,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: spacing.sm,
      marginBottom: spacing.xl,
    },
    createButtonText: {
      fontSize: typography.base,
      fontFamily: typography.fontFamily?.semibold,
      color: colors.textOnPrimary,
    },
    sectionTitle: {
      fontSize: typography.lg,
      fontFamily: typography.fontFamily?.bold,
      color: colors.text,
      marginBottom: spacing.md,
    },
    loader: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      backgroundColor: colors.surface,
      borderRadius: borderRadius.lg,
      padding: spacing.lg,
    },
    loaderText: {
      fontSize: typography.sm,
      color: colors.textSecondary,
    },
    emptyCard: {
      alignItems: "center",
      backgroundColor: colors.surface,
      borderRadius: borderRadius.lg,
      padding: spacing.xl,
      ...shadows.sm,
    },
    emptyTitle: {
      fontSize: typography.base,
      fontFamily: typography.fontFamily?.semibold,
      color: colors.text,
      marginTop: spacing.sm,
    },
    emptyBody: {
      fontSize: typography.sm,
      color: colors.textSecondary,
      textAlign: "center",
      marginTop: spacing.xs,
      lineHeight: 20,
    },
    requestCard: {
      backgroundColor: colors.surface,
      borderRadius: borderRadius.lg,
      padding: spacing.lg,
      marginBottom: spacing.md,
      borderWidth: 1,
      borderColor: colors.border,
      ...shadows.sm,
    },
    requestHeader: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: spacing.md,
      marginBottom: spacing.sm,
    },
    requestTitle: {
      fontSize: typography.base,
      fontFamily: typography.fontFamily?.semibold,
      color: colors.text,
      marginBottom: 4,
    },
    requestMeta: {
      fontSize: typography.xs,
      color: colors.textSecondary,
    },
    requestDescription: {
      fontSize: typography.sm,
      color: colors.textSecondary,
      lineHeight: 20,
    },
    statusBadge: {
      borderRadius: borderRadius.full,
      paddingHorizontal: spacing.sm,
      paddingVertical: 5,
    },
    statusText: {
      fontSize: 11,
      fontFamily: typography.fontFamily?.semibold,
    },
    successBadge: {
      backgroundColor: colors.successLight,
    },
    successText: {
      color: colors.success,
    },
    errorBadge: {
      backgroundColor: colors.errorLight,
    },
    errorText: {
      color: colors.error,
    },
    warningBadge: {
      backgroundColor: colors.warningLight,
    },
    warningText: {
      color: colors.warning,
    },
    infoBadge: {
      backgroundColor: colors.infoLight,
    },
    infoText: {
      color: colors.info,
    },
    modalOverlay: {
      flex: 1,
      justifyContent: "flex-end",
      backgroundColor: colors.overlay,
    },
    modalCard: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: borderRadius.xl,
      borderTopRightRadius: borderRadius.xl,
      padding: spacing.lg,
      maxHeight: "92%",
    },
    modalScrollContent: {
      paddingBottom: spacing.sm,
    },
    modalHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: spacing.lg,
    },
    modalTitle: {
      fontSize: typography.xl,
      fontFamily: typography.fontFamily?.bold,
      color: colors.text,
    },
    closeButton: {
      width: 36,
      height: 36,
      borderRadius: borderRadius.full,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.surfaceMuted,
    },
    inputLabel: {
      fontSize: typography.sm,
      fontFamily: typography.fontFamily?.semibold,
      color: colors.text,
      marginBottom: spacing.xs,
    },
    input: {
      minHeight: 46,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: borderRadius.md,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      color: colors.text,
      backgroundColor: colors.inputBackground,
      fontSize: typography.sm,
      fontFamily: typography.fontFamily?.regular,
      marginBottom: spacing.md,
    },
    readOnlyInput: {
      backgroundColor: colors.surfaceMuted,
      color: colors.textSecondary,
    },
    pickerField: {
      minHeight: 46,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: borderRadius.md,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      backgroundColor: colors.inputBackground,
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      marginBottom: spacing.xs,
    },
    pickerText: {
      flex: 1,
      color: colors.text,
      fontSize: typography.sm,
      fontFamily: typography.fontFamily?.regular,
    },
    pickerWrap: {
      minHeight: 46,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: borderRadius.md,
      backgroundColor: colors.inputBackground,
      justifyContent: "center",
      marginBottom: spacing.xs,
      overflow: "hidden",
    },
    picker: {
      color: colors.text,
      backgroundColor: colors.inputBackground,
    },
    placeholderText: {
      color: colors.placeholder,
    },
    timeRow: {
      flexDirection: "row",
      gap: spacing.sm,
      marginBottom: spacing.md,
    },
    timeColumn: {
      flex: 1,
    },
    textArea: {
      minHeight: 120,
    },
    fieldErrorText: {
      fontSize: typography.xs,
      color: colors.warning,
      marginTop: -spacing.xs,
      marginBottom: spacing.sm,
      lineHeight: 18,
    },
    validationText: {
      fontSize: typography.xs,
      color: colors.warning,
      marginBottom: spacing.md,
    },
    submitButton: {
      height: 48,
      borderRadius: borderRadius.md,
      backgroundColor: colors.primary,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: spacing.sm,
    },
    submitButtonDisabled: {
      opacity: 0.55,
    },
    submitButtonText: {
      fontSize: typography.base,
      fontFamily: typography.fontFamily?.semibold,
      color: colors.textOnPrimary,
    },
    recoveryHeaderCard: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.md,
      backgroundColor: colors.surfaceMuted,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: borderRadius.md,
      padding: spacing.lg,
      marginBottom: spacing.md,
    },

    recoveryHeaderIcon: {
      width: 48,
      height: 48,
      borderRadius: borderRadius.md,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.primaryLight ?? `${colors.primary}18`,
    },

    recoveryHeaderText: {
      flex: 1,
    },

    recoveryTitle: {
      fontSize: typography.base,
      fontFamily: typography.fontFamily?.bold,
      color: colors.text,
      marginBottom: 4,
    },

    recoverySubtitle: {
      fontSize: typography.sm,
      fontFamily: typography.fontFamily?.regular,
      color: colors.textSecondary,
      lineHeight: 20,
    },

    recoverySegmentedControl: {
      flexDirection: "row",
      backgroundColor: colors.surfaceMuted,
      borderRadius: borderRadius.full,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 4,
      gap: 4,
      marginBottom: spacing.md,
    },

    recoverySegmentButton: {
      flex: 1,
      minHeight: 40,
      borderRadius: borderRadius.full,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.sm,
    },

    recoverySegmentButtonActive: {
      backgroundColor: colors.primary,
    },

    recoverySegmentText: {
      fontSize: typography.xs,
      fontFamily: typography.fontFamily?.semibold,
      color: colors.text,
      textAlign: "center",
    },

    recoverySegmentTextActive: {
      color: colors.textOnPrimary,
    },

    recoveryTotalCard: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      backgroundColor: colors.warningLight,
      borderWidth: 1,
      borderColor: colors.warning,
      borderRadius: borderRadius.md,
      padding: spacing.lg,
      marginBottom: spacing.md,
    },

    recoveryTotalLabel: {
      fontSize: typography.sm,
      fontFamily: typography.fontFamily?.semibold,
      color: colors.warning,
      marginBottom: 4,
    },

    recoveryTotalValue: {
      fontSize: 28,
      fontFamily: typography.fontFamily?.bold,
      color: colors.text,
      lineHeight: 34,
    },

    recoveryDateGrid: {
      flexDirection: "row",
      gap: spacing.sm,
      marginBottom: spacing.md,
    },

    recoveryDateField: {
      flex: 1,
    },

    recoveryNatureGrid: {
      flexDirection: "row",
      gap: spacing.sm,
      marginBottom: spacing.md,
    },

    recoveryDayCountBox: {
      flex: 0.9,
    },

    recoveryNatureField: {
      flex: 1.35,
    },

    recoveryRequiredBadge: {
      flexDirection: "row",
      alignItems: "center",
      alignSelf: "flex-start",
      gap: spacing.xs,
      backgroundColor: colors.warningLight,
      borderRadius: borderRadius.full,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      marginBottom: spacing.md,
    },

    recoveryRequiredBadgeText: {
      fontSize: typography.sm,
      fontFamily: typography.fontFamily?.semibold,
      color: colors.warning,
    },

    recoveryPlanSection: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.md,
      backgroundColor: colors.surfaceMuted,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: borderRadius.md,
      padding: spacing.md,
      marginBottom: spacing.md,
    },

    recoveryPlanCheck: {
      width: 26,
      height: 26,
      borderRadius: borderRadius.full,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.primary,
    },

    recoveryPlanCheckEmpty: {
      backgroundColor: "transparent",
    },

    recoveryPlanText: {
      fontSize: typography.xs,
      fontFamily: typography.fontFamily?.regular,
      color: colors.textSecondary,
      lineHeight: 18,
      marginTop: 2,
    },

    recoveryPlannerHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: spacing.sm,
    },

    recoveryPlannerTitle: {
      fontSize: typography.sm,
      fontFamily: typography.fontFamily?.semibold,
      color: colors.text,
    },

    recoveryPlannerCount: {
      fontSize: typography.xs,
      fontFamily: typography.fontFamily?.semibold,
      color: colors.textSecondary,
    },

    recoverySlotCard: {
      backgroundColor: colors.surfaceMuted,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: borderRadius.md,
      padding: spacing.md,
      marginBottom: spacing.md,
    },

    recoverySlotHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: spacing.sm,
      marginBottom: spacing.md,
    },

    recoverySlotTitle: {
      fontSize: typography.sm,
      fontFamily: typography.fontFamily?.bold,
      color: colors.text,
    },

    recoveryDurationChip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      backgroundColor: colors.warningLight,
      borderRadius: borderRadius.full,
      paddingHorizontal: spacing.sm,
      paddingVertical: 5,
    },

    recoveryDurationText: {
      fontSize: typography.xs,
      fontFamily: typography.fontFamily?.semibold,
      color: colors.warning,
    },

    recoveryDateRow: {
      marginBottom: spacing.sm,
    },

    recoveryTimeGrid: {
      flexDirection: "row",
      gap: spacing.sm,
      marginBottom: spacing.sm,
    },

    recoveryTimeField: {
      flex: 1,
    },

    recoveryReadOnlyDuration: {
      minHeight: 46,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: borderRadius.md,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      backgroundColor: colors.surface,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: spacing.xs,
    },

    recoveryReadOnlyDurationText: {
      fontSize: typography.sm,
      fontFamily: typography.fontFamily?.semibold,
      color: colors.text,
    },

    deleteSlotButton: {
      height: 46,
      borderRadius: borderRadius.md,
      backgroundColor: colors.error,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: spacing.xs,
      marginTop: spacing.xs,
    },

    deleteSlotButtonText: {
      fontSize: typography.sm,
      fontFamily: typography.fontFamily?.semibold,
      color: colors.textOnPrimary,
    },

    deleteSlotButtonDisabled: {
      opacity: 0.45,
    },

    addSlotButton: {
      height: 48,
      borderRadius: borderRadius.md,
      backgroundColor: colors.primary,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: spacing.sm,
      marginBottom: spacing.md,
    },

    addSlotButtonText: {
      fontSize: typography.sm,
      fontFamily: typography.fontFamily?.semibold,
      color: colors.textOnPrimary,
    },

    recoveryFinalSummary: {
      backgroundColor: colors.warningLight,
      borderWidth: 1,
      borderColor: colors.warning,
      borderRadius: borderRadius.md,
      padding: spacing.md,
      marginBottom: spacing.md,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },

    recoveryFinalSummaryLabel: {
      fontSize: typography.sm,
      fontFamily: typography.fontFamily?.semibold,
      color: colors.warning,
    },

    recoveryFinalSummaryValue: {
      fontSize: typography.lg,
      fontFamily: typography.fontFamily?.bold,
      color: colors.text,
    },
  });
