import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { Ionicons } from "@expo/vector-icons";

import { Button, Card, Input } from "../components";
import FeedbackModal from "../components/FeedbackModal";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { useFeedback } from "../hooks/useFeedback";
import { profileService } from "../services/api";
import logger from "../utils/logger";

const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;

const splitFullName = (fullName = "") => {
  const parts = String(fullName).trim().split(/\s+/).filter(Boolean);

  return {
    firstName: parts[0] || "",
    lastName: parts.slice(1).join(" "),
  };
};

const getImageTypeFromUri = (uri = "") => {
  const cleanUri = String(uri).split("?")[0];
  const extension = cleanUri.split(".").pop()?.toLowerCase();

  if (extension === "png") return "image/png";
  if (extension === "webp") return "image/webp";
  if (extension === "jpg" || extension === "jpeg") return "image/jpeg";

  return null;
};

const getImageName = (asset) => {
  if (asset?.fileName) {
    return asset.fileName;
  }

  const type = asset?.mimeType || getImageTypeFromUri(asset?.uri);

  const extension =
    type === "image/png"
      ? "png"
      : type === "image/webp"
        ? "webp"
        : "jpg";

  return `profile-image.${extension}`;
};

const EditProfileScreen = ({ navigation, route }) => {
  const { colors, spacing, typography, borderRadius } = useTheme();
  const { user, updateUser } = useAuth();
  const { feedback, showFeedback, hideFeedback } = useFeedback();

  const routeProfileUser = route.params?.profile?.user;
  const initialUser = routeProfileUser || user || {};
  const initialName = splitFullName(initialUser.fullName);

  const [profileUser, setProfileUser] = useState(initialUser);
  const [firstName, setFirstName] = useState(initialName.firstName);
  const [lastName, setLastName] = useState(initialName.lastName);
  const [phoneNumber, setPhoneNumber] = useState(
    initialUser.phoneNumber || "",
  );

  const [selectedImage, setSelectedImage] = useState(null);
  const [avatarLoadFailed, setAvatarLoadFailed] = useState(false);

  const [loading, setLoading] = useState(!routeProfileUser);
  const [saving, setSaving] = useState(false);

  const [errors, setErrors] = useState({});
  const [apiError, setApiError] = useState("");

  const displayName =
    `${firstName.trim()} ${lastName.trim()}`.trim() || "Utilisateur";

  const initials = useMemo(
    () =>
      displayName
        .split(" ")
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase())
        .join(""),
    [displayName],
  );

  const existingProfileImageUrl = profileUser?.profileImageUrl;
  const avatarUri = selectedImage?.uri || existingProfileImageUrl;
  const showAvatarImage = Boolean(avatarUri) && !avatarLoadFailed;

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          flex: 1,
          backgroundColor: colors.background,
        },
        contentContainer: {
          padding: spacing.lg,
          paddingBottom: spacing.xxl,
          gap: spacing.lg,
        },
        loadingContainer: {
          flex: 1,
          minHeight: 360,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: colors.background,
        },
        loadingText: {
          marginTop: spacing.md,
          fontSize: typography.sm,
          color: colors.textSecondary,
        },
        card: {
          borderRadius: borderRadius.lg,
        },
        imageCard: {
          padding: spacing.lg,
          alignItems: "center",
        },
        avatarWrap: {
          width: 112,
          height: 112,
          borderRadius: 56,
          backgroundColor: colors.primary,
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
          marginBottom: spacing.md,
        },
        avatarImage: {
          width: 112,
          height: 112,
          borderRadius: 56,
        },
        avatarText: {
          fontSize: 34,
          fontWeight: typography.bold,
          color: "#FFFFFF",
        },
        imageButton: {
          minHeight: 44,
          borderRadius: borderRadius.md,
          paddingHorizontal: spacing.md,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: spacing.xs,
          backgroundColor: colors.surfaceMuted,
          borderWidth: 1,
          borderColor: colors.border,
        },
        imageButtonDisabled: {
          opacity: 0.6,
        },
        imageButtonText: {
          fontSize: typography.sm,
          fontWeight: typography.semibold,
          color: colors.primary,
        },
        formCard: {
          padding: spacing.lg,
        },
        sectionTitle: {
          fontSize: typography.lg,
          fontWeight: typography.semibold,
          color: colors.text,
          marginBottom: spacing.md,
        },
        readOnlyCard: {
          paddingVertical: spacing.md,
          paddingHorizontal: spacing.lg,
        },
        readOnlyText: {
          fontSize: typography.sm,
          lineHeight: 20,
          color: colors.textSecondary,
          marginBottom: spacing.md,
        },
        readOnlyRow: {
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          paddingVertical: spacing.sm,
          borderTopWidth: 1,
          borderTopColor: colors.border,
          gap: spacing.md,
        },
        readOnlyLabel: {
          flex: 1,
          fontSize: typography.sm,
          color: colors.text,
          fontWeight: typography.medium,
        },
        readOnlyValue: {
          flex: 1,
          textAlign: "right",
          fontSize: typography.sm,
          color: colors.textSecondary,
        },
        apiError: {
          marginTop: spacing.xs,
          marginBottom: spacing.sm,
          fontSize: typography.sm,
          lineHeight: 20,
          color: colors.error,
        },
        actions: {
          gap: spacing.sm,
        },
      }),
    [colors, spacing, typography, borderRadius],
  );

  const applyProfileUser = useCallback((nextUser) => {
    const safeUser = nextUser || {};
    const nextName = splitFullName(safeUser.fullName);

    setProfileUser(safeUser);
    setFirstName(nextName.firstName);
    setLastName(nextName.lastName);
    setPhoneNumber(safeUser.phoneNumber || "");
    setSelectedImage(null);
    setAvatarLoadFailed(false);
    setErrors({});
    setApiError("");
  }, []);

  useEffect(() => {
    if (routeProfileUser) {
      setLoading(false);
      return undefined;
    }

    let isActive = true;

    const fetchProfile = async () => {
      try {
        setLoading(true);
        setApiError("");

        const response = await profileService.getProfile();

        if (!isActive) return;

        if (response?.success) {
          applyProfileUser(response.data?.user || {});
        } else {
          setApiError(
            response?.message || "Impossible de charger le profil.",
          );
        }
      } catch (error) {
        logger.error("Error loading profile for edit", error);

        if (isActive) {
          setApiError(
            error?.message || "Impossible de charger le profil.",
          );
        }
      } finally {
        if (isActive) {
          setLoading(false);
        }
      }
    };

    fetchProfile();

    return () => {
      isActive = false;
    };
  }, [applyProfileUser, routeProfileUser]);

  useEffect(() => {
    setAvatarLoadFailed(false);
  }, [avatarUri]);

  useEffect(() => {
    const unsubscribe = navigation.addListener("beforeRemove", (event) => {
      if (!saving) {
        return;
      }

      event.preventDefault();
    });

    return unsubscribe;
  }, [navigation, saving]);

  const clearFieldError = useCallback((fieldName) => {
    setErrors((previousErrors) => {
      if (!previousErrors[fieldName]) {
        return previousErrors;
      }

      const nextErrors = { ...previousErrors };
      delete nextErrors[fieldName];

      return nextErrors;
    });
  }, []);

  const handleFirstNameChange = (value) => {
    setFirstName(value);
    clearFieldError("firstName");
    setApiError("");
  };

  const handleLastNameChange = (value) => {
    setLastName(value);
    clearFieldError("lastName");
    setApiError("");
  };

  const handlePhoneChange = (value) => {
    setPhoneNumber(value);
    clearFieldError("phoneNumber");
    setApiError("");
  };

  const validateForm = () => {
    const nextErrors = {};

    const trimmedFirstName = firstName.trim();
    const trimmedLastName = lastName.trim();
    const trimmedPhone = phoneNumber.trim();

    if (!trimmedFirstName) {
      nextErrors.firstName = "Le prénom est obligatoire.";
    } else if (trimmedFirstName.length > 100) {
      nextErrors.firstName = "Le prénom ne doit pas dépasser 100 caractères.";
    }

    if (!trimmedLastName) {
      nextErrors.lastName = "Le nom est obligatoire.";
    } else if (trimmedLastName.length > 100) {
      nextErrors.lastName = "Le nom ne doit pas dépasser 100 caractères.";
    }

    if (trimmedPhone && !/^[0-9+\s().-]{6,20}$/.test(trimmedPhone)) {
      nextErrors.phoneNumber = "Le format du téléphone est invalide.";
    }

    setErrors(nextErrors);

    return Object.keys(nextErrors).length === 0;
  };

  const pickImage = async () => {
    if (saving) return;

    setApiError("");

    try {
      const permission =
        await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permission.granted) {
        setApiError(
          "L'autorisation d'accéder à la galerie est nécessaire.",
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.82,
      });

      if (result.canceled) {
        return;
      }

      const asset = result.assets?.[0];

      if (!asset?.uri) {
        setApiError("L'image sélectionnée est invalide.");
        return;
      }

      if (
        typeof asset.fileSize === "number" &&
        asset.fileSize > MAX_IMAGE_SIZE_BYTES
      ) {
        setApiError("L'image ne doit pas dépasser 5 Mo.");
        return;
      }

      const mimeType =
        asset.mimeType || getImageTypeFromUri(asset.uri);

      if (!mimeType || !ALLOWED_IMAGE_TYPES.includes(mimeType)) {
        setApiError("Formats acceptés : JPG, PNG ou WebP.");
        return;
      }

      setSelectedImage({
        uri: asset.uri,
        fileName: getImageName({
          ...asset,
          mimeType,
        }),
        mimeType,
        fileSize: asset.fileSize,
      });

      setAvatarLoadFailed(false);
    } catch (error) {
      logger.error("Error selecting profile image", error);
      setApiError("Impossible de sélectionner l'image.");
    }
  };

  const handleSave = async () => {
    if (saving) {
      return;
    }

    if (!validateForm()) {
      return;
    }

    setSaving(true);
    setApiError("");

    const formData = new FormData();

    formData.append("FirstName", firstName.trim());
    formData.append("LastName", lastName.trim());

    // Always submit the phone value so the user can also remove it.
    formData.append("PhoneNumber", phoneNumber.trim());

    if (selectedImage) {
      formData.append("ProfileImage", {
        uri: selectedImage.uri,
        name: selectedImage.fileName || "profile-image.jpg",
        type: selectedImage.mimeType || "image/jpeg",
      });
    }

    try {
      const response =
        await profileService.updateMyProfile(formData);

      if (!response?.success) {
        throw new Error(
          response?.message || "Impossible de modifier le profil.",
        );
      }

      const updatedUser = response.data?.user;

      if (!updatedUser) {
        throw new Error(
          "Le serveur n'a pas retourné le profil mis à jour.",
        );
      }

      await updateUser(updatedUser);
      applyProfileUser(updatedUser);

      showFeedback({
        type: "success",
        title: "Profil mis à jour",
        message:
          "Vos informations personnelles ont été enregistrées.",
        confirmText: "Terminer",
        onConfirm: () => {
          hideFeedback();
          navigation.goBack();
        },
      });
    } catch (error) {
      logger.error("Error updating profile", error);

      setApiError(
        error?.message || "Impossible de modifier le profil.",
      );
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    if (!saving) {
      navigation.goBack();
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />

        <Text style={styles.loadingText}>
          Chargement du profil...
        </Text>
      </View>
    );
  }

  return (
    <>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Card style={[styles.card, styles.imageCard]}>
          <View style={styles.avatarWrap}>
            {showAvatarImage ? (
              <Image
                source={{ uri: avatarUri }}
                style={styles.avatarImage}
                resizeMode="cover"
                onError={() => setAvatarLoadFailed(true)}
              />
            ) : (
              <Text style={styles.avatarText}>
                {initials || "U"}
              </Text>
            )}
          </View>

          <TouchableOpacity
            style={[
              styles.imageButton,
              saving && styles.imageButtonDisabled,
            ]}
            activeOpacity={0.84}
            onPress={pickImage}
            disabled={saving}
            accessibilityRole="button"
            accessibilityLabel={
              avatarUri
                ? "Modifier la photo de profil"
                : "Choisir une photo de profil"
            }
          >
            <Ionicons
              name="camera-outline"
              size={18}
              color={colors.primary}
            />

            <Text style={styles.imageButtonText}>
              {avatarUri
                ? "Modifier la photo"
                : "Choisir une image"}
            </Text>
          </TouchableOpacity>
        </Card>

        <Card style={[styles.card, styles.formCard]}>
          <Text style={styles.sectionTitle}>
            Informations personnelles
          </Text>

          <Input
            label="Prénom"
            value={firstName}
            onChangeText={handleFirstNameChange}
            placeholder="Prénom"
            autoCapitalize="words"
            autoCorrect={false}
            editable={!saving}
            error={errors.firstName}
            maxLength={100}
          />

          <Input
            label="Nom"
            value={lastName}
            onChangeText={handleLastNameChange}
            placeholder="Nom"
            autoCapitalize="words"
            autoCorrect={false}
            editable={!saving}
            error={errors.lastName}
            maxLength={100}
          />

          <Input
            label="Téléphone"
            value={phoneNumber}
            onChangeText={handlePhoneChange}
            placeholder="Numéro de téléphone"
            keyboardType="phone-pad"
            editable={!saving}
            error={errors.phoneNumber}
            maxLength={20}
          />

          {!!apiError && (
            <Text style={styles.apiError}>{apiError}</Text>
          )}
        </Card>

        <View style={styles.actions}>
          <Button
            title="Enregistrer"
            onPress={handleSave}
            loading={saving}
            disabled={saving}
          />

          <Button
            title="Annuler"
            variant="secondary"
            onPress={handleCancel}
            disabled={saving}
          />
        </View>
      </ScrollView>

      <FeedbackModal
        visible={feedback.visible}
        type={feedback.type}
        title={feedback.title}
        message={feedback.message}
        confirmText={feedback.confirmText}
        cancelText={feedback.cancelText}
        onConfirm={feedback.onConfirm || hideFeedback}
        onCancel={feedback.onCancel || hideFeedback}
      />
    </>
  );
};

export default EditProfileScreen;